/**
 * Background Script Utility Functions
 * URL 검증, 플랫폼 추출, 파일명 생성 등의 유틸리티 함수
 */

export const SUPPORTED_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com'];

/**
 * URL이 지원되는 사이트인지 확인
 */
export function isSupportedUrl(url: string | undefined): boolean {
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
export function getPlatformName(url: string): string {
  const hostname = new URL(url).hostname;
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  return 'unknown';
}

/**
 * 파일명 생성 (platform_YYYYMMDDTHHMMSS.jsonl)
 */
export function generateFilename(url: string): string {
  const platform = getPlatformName(url);
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
  return `${platform}_${timestamp}.jsonl`;
}
