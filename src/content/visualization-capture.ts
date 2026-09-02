/** Request sent to the service worker for a screenshot of the active tab. */
interface CaptureVisibleTabRequest {
  type: 'CAPTURE_VISIBLE_TAB';
}

interface InspectVisualizationFrameRequest {
  type: 'INSPECT_VISUALIZATION_FRAME';
  frameUrl: string;
}

interface CaptureVisibleTabResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

interface InspectVisualizationFrameResponse {
  success: boolean;
  ready: boolean;
  signature: string;
  error?: string;
}

export interface ScreenshotCrop {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface VisualizationFrame {
  dataUrl: string;
  /** Downscaled RGBA pixels used only for blank/stability detection. */
  pixels: Uint8ClampedArray;
}

interface StableVisualizationOptions {
  maxWaitMs?: number;
  now?: () => number;
}

const VISUALIZATION_RENDER_TIMEOUT_MS = 30000;
const UNIFORM_CHANNEL_SPREAD = 6;
const STABLE_MEAN_CHANNEL_DIFFERENCE = 2;
const ANALYSIS_SIZE_PX = 32;
const REQUIRED_STABLE_FRAMES = 4;
const FRAME_INSPECTION_INTERVAL_MS = 500;

interface FrameInspectionOptions {
  maxWaitMs?: number;
  now?: () => number;
  wait?: () => Promise<void>;
}

type SendRuntimeMessage = (
  message: InspectVisualizationFrameRequest
) => Promise<InspectVisualizationFrameResponse>;

/** Ask the service worker to observe readiness inside the cross-origin frame. */
export async function requestVisualizationReady(
  frameUrl: string,
  sendMessage: SendRuntimeMessage = (message) => chrome.runtime.sendMessage(message),
  options: FrameInspectionOptions = {}
): Promise<boolean> {
  if (!frameUrl) {
    return false;
  }

  try {
    const url = new URL(frameUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.claudemcpcontent.com')) {
      return false;
    }
  } catch {
    return false;
  }

  const maxWaitMs = options.maxWaitMs ?? VISUALIZATION_RENDER_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const wait =
    options.wait ??
    (() =>
      new Promise<void>((resolve) =>
        window.setTimeout(resolve, FRAME_INSPECTION_INTERVAL_MS)
      ));
  const startedAt = now();
  let previousSignature = '';
  let stableInspections = 0;

  while (now() - startedAt < maxWaitMs) {
    try {
      const response = await sendMessage({
        type: 'INSPECT_VISUALIZATION_FRAME',
        frameUrl,
      });
      if (!response?.success) {
        previousSignature = '';
        stableInspections = 0;
        await wait();
        continue;
      }
      if (response.ready && response.signature) {
        stableInspections =
          response.signature === previousSignature ? stableInspections + 1 : 1;
        previousSignature = response.signature;
        if (stableInspections >= REQUIRED_STABLE_FRAMES) {
          return true;
        }
      } else {
        previousSignature = '';
        stableInspections = 0;
      }
      await wait();
    } catch (error) {
      console.warn('LLM Chat Exporter: Could not inspect Claude visualization frame', error);
      previousSignature = '';
      stableInspections = 0;
      await wait();
    }
  }
  return false;
}

/**
 * Convert a CSS-pixel element rectangle into screenshot pixel coordinates.
 *
 * captureVisibleTab() returns device pixels, while getBoundingClientRect()
 * returns CSS pixels. Deriving independent X/Y scales from the captured image
 * also covers browser zoom and non-integer display scale factors.
 */
export function calculateScreenshotCrop(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  viewport: { width: number; height: number },
  screenshot: { width: number; height: number }
): ScreenshotCrop | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    screenshot.width <= 0 ||
    screenshot.height <= 0
  ) {
    return null;
  }

  // A partial capture is worse than the explicit fallback marker because it
  // looks complete. Leave oversized or clipped visualizations as placeholders.
  if (
    rect.left < 0 ||
    rect.top < 0 ||
    rect.left + rect.width > viewport.width ||
    rect.top + rect.height > viewport.height
  ) {
    return null;
  }

  const scaleX = screenshot.width / viewport.width;
  const scaleY = screenshot.height / viewport.height;

  return {
    sourceX: Math.round(rect.left * scaleX),
    sourceY: Math.round(rect.top * scaleY),
    sourceWidth: Math.round(rect.width * scaleX),
    sourceHeight: Math.round(rect.height * scaleY),
  };
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode captured tab image'));
    image.src = dataUrl;
  });
}

/** True when every color channel changes too little to contain useful content. */
function isNearUniform(pixels: Uint8ClampedArray): boolean {
  if (pixels.length < 4) {
    return true;
  }

  const minimum = [255, 255, 255];
  const maximum = [0, 0, 0];
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      minimum[channel] = Math.min(minimum[channel], pixels[offset + channel]);
      maximum[channel] = Math.max(maximum[channel], pixels[offset + channel]);
    }
  }

  return maximum.every(
    (value, channel) => value - minimum[channel] <= UNIFORM_CHANNEL_SPREAD
  );
}

/** Mean RGB difference between two downscaled frames. */
function meanChannelDifference(
  left: Uint8ClampedArray,
  right: Uint8ClampedArray
): number {
  if (left.length !== right.length || left.length < 4) {
    return Number.POSITIVE_INFINITY;
  }

  let difference = 0;
  let channels = 0;
  for (let offset = 0; offset + 3 < left.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      difference += Math.abs(left[offset + channel] - right[offset + channel]);
      channels += 1;
    }
  }
  return channels > 0 ? difference / channels : Number.POSITIVE_INFINITY;
}

/**
 * Reject blank frames and require four consecutive rendered frames to agree.
 * captureVisibleTab() is already rate-limited by the service worker, so each
 * loop naturally waits at least 550 ms without a second timer here.
 */
export async function waitForStableVisualization(
  captureFrame: () => Promise<VisualizationFrame | null>,
  isIframeConnected: () => boolean,
  options: StableVisualizationOptions = {}
): Promise<VisualizationFrame | null> {
  const maxWaitMs = options.maxWaitMs ?? VISUALIZATION_RENDER_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let previousRendered: VisualizationFrame | null = null;
  let stableFrames = 0;

  while (isIframeConnected() && now() - startedAt < maxWaitMs) {
    const current = await captureFrame();
    if (!current) {
      return null;
    }

    if (isNearUniform(current.pixels)) {
      previousRendered = null;
      stableFrames = 0;
      continue;
    }

    if (previousRendered) {
      if (
        meanChannelDifference(previousRendered.pixels, current.pixels) <=
        STABLE_MEAN_CHANNEL_DIFFERENCE
      ) {
        stableFrames += 1;
        if (stableFrames >= REQUIRED_STABLE_FRAMES) {
          return current;
        }
      } else {
        stableFrames = 1;
      }
    } else {
      stableFrames = 1;
    }
    previousRendered = current;
  }

  return null;
}

/** Capture one iframe frame and retain a small pixel sample for analysis. */
async function captureVisualizationFrame(
  iframe: HTMLIFrameElement
): Promise<VisualizationFrame | null> {
  const rect = iframe.getBoundingClientRect();
  const request: CaptureVisibleTabRequest = { type: 'CAPTURE_VISIBLE_TAB' };
  const response = (await chrome.runtime.sendMessage(request)) as CaptureVisibleTabResponse;
  if (!response?.success || !response.dataUrl) {
    console.warn(
      'LLM Chat Exporter: Visible-tab capture failed',
      response?.error || 'No PNG data returned'
    );
    return null;
  }

  const screenshot = await loadImage(response.dataUrl);
  const crop = calculateScreenshotCrop(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    { width: screenshot.naturalWidth, height: screenshot.naturalHeight }
  );
  if (!crop) {
    console.warn('LLM Chat Exporter: Visualization does not fit fully in the visible viewport');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = crop.sourceWidth;
  canvas.height = crop.sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.drawImage(
    screenshot,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    crop.sourceWidth,
    crop.sourceHeight
  );

  const analysisCanvas = document.createElement('canvas');
  analysisCanvas.width = Math.min(ANALYSIS_SIZE_PX, crop.sourceWidth);
  analysisCanvas.height = Math.min(ANALYSIS_SIZE_PX, crop.sourceHeight);
  const analysisContext = analysisCanvas.getContext('2d');
  if (!analysisContext) {
    return null;
  }
  analysisContext.drawImage(canvas, 0, 0, analysisCanvas.width, analysisCanvas.height);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    pixels: analysisContext.getImageData(
      0,
      0,
      analysisCanvas.width,
      analysisCanvas.height
    ).data,
  };
}

/** Capture a fully visible iframe after its rendered pixels become stable. */
export async function captureVisualizationIframe(
  iframe: HTMLIFrameElement
): Promise<string | null> {
  // jsdom and older/non-browser hosts do not implement this layout method.
  if (typeof iframe.scrollIntoView !== 'function') {
    return null;
  }

  const ancestorScrollPositions: Array<{ element: HTMLElement; left: number; top: number }> = [];
  let ancestor = iframe.parentElement;
  while (ancestor) {
    ancestorScrollPositions.push({
      element: ancestor,
      left: ancestor.scrollLeft,
      top: ancestor.scrollTop,
    });
    ancestor = ancestor.parentElement;
  }
  const windowScroll = { left: window.scrollX, top: window.scrollY };

  try {
    iframe.scrollIntoView({ block: 'center', inline: 'nearest' });
    await waitForPaint();
    const ready = await requestVisualizationReady(iframe.src);
    if (!ready || !iframe.isConnected) {
      console.warn('LLM Chat Exporter: Claude visualization frame was not ready');
      return null;
    }
    const stable = await waitForStableVisualization(
      () => captureVisualizationFrame(iframe),
      () => iframe.isConnected
    );
    if (!stable) {
      console.warn('LLM Chat Exporter: Claude visualization did not finish rendering');
      return null;
    }
    return stable.dataUrl;
  } catch (error) {
    console.warn('LLM Chat Exporter: Could not capture Claude visualization', error);
    return null;
  } finally {
    for (const saved of ancestorScrollPositions) {
      saved.element.scrollLeft = saved.left;
      saved.element.scrollTop = saved.top;
    }
    window.scrollTo(windowScroll.left, windowScroll.top);
  }
}
