/**
 * Background Script (Service Worker)
 * 단축키 이벤트를 리스닝하고 Content Script와 통신
 */

const SUPPORTED_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com'];

interface ExportResponse {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * URL이 지원되는 사이트인지 확인
 */
function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_HOSTS.some((host) => hostname.includes(host));
  } catch {
    return false;
  }
}

/**
 * URL에서 플랫폼 이름 추출
 */
function getPlatformName(url: string): string {
  const hostname = new URL(url).hostname;
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  return 'unknown';
}

/**
 * 파일명 생성 (platform_YYYYMMDDTHHMMSS.jsonl)
 */
function generateFilename(url: string): string {
  const platform = getPlatformName(url);
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
  return `${platform}_${timestamp}.jsonl`;
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
      await downloadJsonl(response.data, tab.url);
      console.log('Export completed successfully');
    } else {
      console.error('Export failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to execute content script:', error);
  }
});

console.log('LLM Chat Exporter background script loaded');
