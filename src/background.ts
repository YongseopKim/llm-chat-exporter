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

/**
 * JSONL 데이터를 파일로 다운로드
 * Service Worker에서는 URL.createObjectURL을 사용할 수 없으므로 Data URL 사용
 */
async function downloadJsonl(data: string, url: string): Promise<void> {
  const filename = generateFilename(url);
  const dataUrl = 'data:application/jsonl;charset=utf-8,' + encodeURIComponent(data);

  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true,
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
    return;
  }

  console.log('Exporting conversation from:', tab.url);

  try {
    const response = await executeContentScript(tab.id);

    if (response.success && response.data) {
      // Success: download JSONL data
      await downloadJsonl(response.data, tab.url);
      console.log('Export completed successfully');
    } else {
      // Error: download error message as JSON for debugging
      console.error('Export failed:', response.error);
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
    // Download error info
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
