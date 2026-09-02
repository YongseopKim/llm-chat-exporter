/** Request sent to the service worker for a screenshot of the active tab. */
interface CaptureVisibleTabRequest {
  type: 'CAPTURE_VISIBLE_TAB';
}

interface CaptureVisibleTabResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface ScreenshotCrop {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
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

/** Capture a fully visible iframe and return a cropped PNG data URI. */
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
    return canvas.toDataURL('image/png');
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
