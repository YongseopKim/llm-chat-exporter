/**
 * Puppeteer E2E 테스트 설정
 * Chrome Extension 로딩 및 테스트 환경 구성
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Chrome Extension이 로드된 브라우저 인스턴스 생성
 */
export async function setupBrowser(): Promise<Browser> {
  // Extension 디렉토리 경로 (프로젝트 루트)
  const extensionPath = path.resolve(__dirname, '../../');

  const browser = await puppeteer.launch({
    headless: false, // Extension은 headless 모드에서 로드 불가
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  return browser;
}

/**
 * 새 페이지 생성 및 초기화
 */
export async function createPage(browser: Browser): Promise<Page> {
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // 타임아웃 설정
  page.setDefaultTimeout(5000);

  return page;
}

/**
 * 테스트용 더미 HTML 페이지 생성
 * ChatGPT/Claude/Gemini의 간단한 DOM 구조 모방
 */
export function getDummyHtml(platform: 'chatgpt' | 'claude' | 'gemini'): string {
  const platformUrls = {
    chatgpt: 'https://chatgpt.com/c/test-123',
    claude: 'https://claude.ai/chat/test-456',
    gemini: 'https://gemini.google.com/app/test-789',
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${platform.toUpperCase()} Test Page</title>
      </head>
      <body>
        <h1>${platform.toUpperCase()} Dummy Page</h1>
        <div id="messages">
          <div data-message-author-role="user">
            <div class="markdown">Hello, this is a test message.</div>
          </div>
          <div data-message-author-role="assistant">
            <div class="markdown">This is a test response.</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 브라우저 정리
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  if (browser) {
    await browser.close();
  }
}
