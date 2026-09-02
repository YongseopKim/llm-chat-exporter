/**
 * Background Script (Service Worker)
 * 단축키 이벤트를 리스닝하고 Content Script와 통신
 */

import { isSupportedUrl, generateFilename } from './utils/background-utils';

interface ExportResponse {
  success: boolean;
  data?: string;
  error?: string;
}

interface CaptureVisibleTabMessage {
  type: 'CAPTURE_VISIBLE_TAB';
}

interface InspectVisualizationFrameMessage {
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

type BackgroundMessage = CaptureVisibleTabMessage | InspectVisualizationFrameMessage;

const CAPTURE_INTERVAL_MS = 550;
let lastCaptureAt = 0;

/** Read one immediate readiness snapshot from the exact visualization frame. */
async function inspectVisualizationFrame(
  sender: chrome.runtime.MessageSender,
  frameUrl: string
): Promise<InspectVisualizationFrameResponse> {
  if (!sender.tab?.id || !frameUrl) {
    return {
      success: false,
      ready: false,
      signature: '',
      error: 'Missing tab or visualization URL',
    };
  }

  let parsedFrameUrl: URL;
  try {
    parsedFrameUrl = new URL(frameUrl);
  } catch {
    return {
      success: false,
      ready: false,
      signature: '',
      error: 'Invalid visualization URL',
    };
  }
  if (
    parsedFrameUrl.protocol !== 'https:' ||
    !parsedFrameUrl.hostname.endsWith('.claudemcpcontent.com')
  ) {
    return {
      success: false,
      ready: false,
      signature: '',
      error: 'Unexpected visualization host',
    };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, allFrames: true },
    args: [frameUrl],
    func: (expectedUrl: string) => {
      if (window.location.href !== expectedUrl) {
        return { matched: false, ready: false, signature: '' };
      }

      const body = document.body;
      const rect = body?.getBoundingClientRect();
      const hasSize = Boolean(rect && rect.width >= 16 && rect.height >= 16);
      const hasContent = Boolean(
        body &&
          ((body.innerText || '').trim() ||
            body.querySelector('svg, canvas, img, video, [role="img"]'))
      );
      const imagesReady = Array.from(document.images).every(
        (image) => image.complete && image.naturalWidth > 0
      );
      const fontsReady = !('fonts' in document) || document.fonts.status === 'loaded';
      const serialized = document.documentElement.outerHTML;
      let hash = 2166136261;
      for (let index = 0; index < serialized.length; index += 1) {
        hash ^= serialized.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return {
        matched: true,
        ready: hasSize && hasContent && imagesReady && fontsReady,
        signature: `${hash >>> 0}:${serialized.length}`,
      };
    },
  });

  const matched = results.find((result) => result.result?.matched === true);
  if (!matched) {
    return {
      success: false,
      ready: false,
      signature: '',
      error: 'Claude visualization frame was not accessible',
    };
  }
  return {
    success: true,
    ready: matched.result?.ready === true,
    signature: matched.result?.signature || '',
  };
}

/** Capture only the tab that requested the image, never another active tab. */
async function captureRequestingTab(
  sender: chrome.runtime.MessageSender
): Promise<CaptureVisibleTabResponse> {
  if (!sender.tab?.id || sender.tab.windowId === undefined) {
    return { success: false, error: 'Capture request did not come from a tab' };
  }

  const [activeTab] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
  if (activeTab?.id !== sender.tab.id) {
    return { success: false, error: 'The exporting tab is no longer active' };
  }

  const remaining = CAPTURE_INTERVAL_MS - (Date.now() - lastCaptureAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
  lastCaptureAt = Date.now();
  return { success: true, dataUrl };
}

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (
      response: CaptureVisibleTabResponse | InspectVisualizationFrameResponse
    ) => void
  ) => {
    if (message.type === 'INSPECT_VISUALIZATION_FRAME') {
      inspectVisualizationFrame(sender, message.frameUrl)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            success: false,
            ready: false,
            signature: '',
            error: error instanceof Error ? error.message : String(error),
          })
        );
      return true;
    }

    if (message.type === 'CAPTURE_VISIBLE_TAB') {
      captureRequestingTab(sender)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      return true;
    }
    return undefined;
  }
);

/**
 * JSONL 데이터의 첫 줄(메타데이터)에서 title 추출
 */
function extractTitleFromJsonl(data: string): string | undefined {
  try {
    const firstLine = data.split('\n')[0];
    const meta = JSON.parse(firstLine);
    return meta.title;
  } catch {
    return undefined;
  }
}

/**
 * JSONL 데이터를 파일로 다운로드
 * Service Worker에서는 URL.createObjectURL을 사용할 수 없으므로 Data URL 사용
 */
async function downloadJsonl(data: string, url: string): Promise<void> {
  const title = extractTitleFromJsonl(data);
  const filename = generateFilename(url, title);
  const dataUrl = 'data:application/jsonl;charset=utf-8,' + encodeURIComponent(data);

  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false,
  });
}

/**
 * Content Script를 동적으로 주입하고 실행
 */
async function executeContentScript(tabId: number): Promise<ExportResponse> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING_EXPORTER' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content.js'],
    });
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: 'EXPORT_CONVERSATION',
  });

  return response as ExportResponse;
}

/**
 * 단축키 명령 리스너
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'export-conversation') return;

  // 현재 활성 탭 가져오기
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.id || !tab.url) {
    console.log('No active tab found');
    return;
  }

  if (!isSupportedUrl(tab.url)) {
    console.log('Unsupported site:', tab.url);
    // Show user-friendly notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LLM Chat Exporter',
      message: 'This site is not supported. Please use on ChatGPT, Claude, Gemini, Grok, or Perplexity.',
      priority: 1
    });
    return;
  }

  console.log('Exporting conversation from:', tab.url);

  try {
    const response = await executeContentScript(tab.id);

    if (response.success && response.data) {
      // Success: download JSONL data
      await downloadJsonl(response.data, tab.url);
      console.log('Export completed successfully');

      // Show success notification
      const messageCount = response.data.split('\n').filter(line => line.trim()).length - 1; // -1 for metadata line
      const title = extractTitleFromJsonl(response.data);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Export Successful',
        message: `Exported ${messageCount} messages to ${generateFilename(tab.url, title)}`,
        priority: 1
      });
    } else {
      // Error: show user-friendly notification and download error details
      console.error('Export failed:', response.error);

      // User-friendly error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Export Failed',
        message: response.error || 'An unknown error occurred. Check downloaded error file for details.',
        priority: 2
      });

      // Still download error details for debugging
      const errorData = JSON.stringify({
        success: false,
        error: response.error,
        timestamp: new Date().toISOString(),
        url: tab.url
      }, null, 2);
      await downloadJsonl(errorData, tab.url);
      console.log('Error details downloaded for debugging');
    }
  } catch (error) {
    console.error('Failed to execute content script:', error);

    // Show error notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Export Failed',
      message: 'Failed to initialize export. This may happen if the page is not fully loaded.',
      priority: 2
    });

    // Download error info for debugging
    const errorData = JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      url: tab.url
    }, null, 2);
    await downloadJsonl(errorData, tab.url);
  }
});

console.log('LLM Chat Exporter background script loaded');
