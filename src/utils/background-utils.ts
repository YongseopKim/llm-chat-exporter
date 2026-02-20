/**
 * Background Script Utility Functions
 * URL 검증, 플랫폼 추출, 파일명 생성 등의 유틸리티 함수
 */

export const SUPPORTED_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'grok.com', 'perplexity.ai'];

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
  if (hostname.includes('grok.com')) return 'grok';
  if (hostname.includes('perplexity.ai')) return 'perplexity';
  return 'unknown';
}

/**
 * 파일명에 사용할 수 없는 문자를 _로 대체
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * 파일명 생성 (platform_{title}.jsonl 또는 platform_timestamp.jsonl)
 */
export function generateFilename(url: string, title?: string): string {
  const platform = getPlatformName(url);

  if (title) {
    const sanitizedTitle = sanitizeFilename(title);
    return `${platform}_${sanitizedTitle}.jsonl`;
  }

  // Fallback to timestamp if no title
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
  return `${platform}_${timestamp}.jsonl`;
}
