/**
 * Background Script (Service Worker)
 * 단축키 이벤트를 리스닝하고 Content Script와 통신
 */

import { isSupportedUrl, generateFilename } from './utils/background-utils';
import {
  executeVersionedContentScript,
  type ExportResponse,
} from './content-script-loader';

declare const __LLM_CHAT_EXPORTER_BUILD_ID__: string;

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
  return executeVersionedContentScript(tabId, __LLM_CHAT_EXPORTER_BUILD_ID__, {
    sendMessage: (targetTabId, message) => chrome.tabs.sendMessage(targetTabId, message),
    inject: async (targetTabId) => {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['dist/content.js'],
      });
    },
  });
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

      // Show success notification, flagging an export that may not match the page
      const title = extractTitleFromJsonl(response.data);
      const warnings = response.warnings ?? [];
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: warnings.length > 0 ? 'Exported with warnings' : 'Export Successful',
        message:
          `Exported ${response.messageCount ?? 0} messages to ${generateFilename(tab.url, title)}` +
          (warnings.length > 0 ? `\n${warnings.join('\n')}` : ''),
        priority: warnings.length > 0 ? 2 : 1
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
