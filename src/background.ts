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

interface WaitForVisualizationReadyMessage {
  type: 'WAIT_FOR_VISUALIZATION_READY';
  frameUrl: string;
}

interface CaptureVisibleTabResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

interface WaitForVisualizationReadyResponse {
  success: boolean;
  ready: boolean;
  error?: string;
}

type BackgroundMessage = CaptureVisibleTabMessage | WaitForVisualizationReadyMessage;

const CAPTURE_INTERVAL_MS = 550;
const VISUALIZATION_FRAME_TIMEOUT_MS = 30000;
const VISUALIZATION_MUTATION_QUIET_MS = 2000;
let lastCaptureAt = 0;

/** Wait inside the exact Claude visualization frame until its DOM is ready. */
async function waitForVisualizationFrame(
  sender: chrome.runtime.MessageSender,
  frameUrl: string
): Promise<WaitForVisualizationReadyResponse> {
  if (!sender.tab?.id || !frameUrl) {
    return { success: false, ready: false, error: 'Missing tab or visualization URL' };
  }

  let parsedFrameUrl: URL;
  try {
    parsedFrameUrl = new URL(frameUrl);
  } catch {
    return { success: false, ready: false, error: 'Invalid visualization URL' };
  }
  if (
    parsedFrameUrl.protocol !== 'https:' ||
    !parsedFrameUrl.hostname.endsWith('.claudemcpcontent.com')
  ) {
    return { success: false, ready: false, error: 'Unexpected visualization host' };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, allFrames: true },
    args: [frameUrl, VISUALIZATION_FRAME_TIMEOUT_MS, VISUALIZATION_MUTATION_QUIET_MS],
    func: async (expectedUrl: string, timeoutMs: number, quietMs: number) => {
      if (window.location.href !== expectedUrl) {
        return { matched: false, ready: false };
      }

      const startedAt = Date.now();
      let lastMutationAt = Date.now();
      const observer = new MutationObserver(() => {
        lastMutationAt = Date.now();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });

      try {
        while (Date.now() - startedAt < timeoutMs) {
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
          const quiet = Date.now() - lastMutationAt >= quietMs;

          if (hasSize && hasContent && imagesReady && fontsReady && quiet) {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
            return { matched: true, ready: true };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return { matched: true, ready: false };
      } finally {
        observer.disconnect();
      }
    },
  });

  const matched = results.find((result) => result.result?.matched === true);
  if (!matched) {
    return {
      success: false,
      ready: false,
      error: 'Claude visualization frame was not accessible',
    };
  }
  return { success: true, ready: matched.result?.ready === true };
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
      response: CaptureVisibleTabResponse | WaitForVisualizationReadyResponse
    ) => void
  ) => {
    if (message.type === 'WAIT_FOR_VISUALIZATION_READY') {
      waitForVisualizationFrame(sender, message.frameUrl)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            success: false,
            ready: false,
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
  // Content Script 주입
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['dist/content.js'],
  });

  // 메시지 전송
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
