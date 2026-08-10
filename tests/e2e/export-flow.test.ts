/**
 * E2E 테스트: Extension 로딩 및 Export 플로우
 *
 * 주의: 이 테스트는 headless: false로 실행되며,
 * 실제 Chrome 창이 열립니다.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Browser, HTTPRequest, Page } from 'puppeteer';
import { setupBrowser, createPage, closeBrowser } from './setup';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIRTUALIZED_CHATGPT_URL = 'https://chatgpt.com/c/e2e-virtualized-regression';

/**
 * Real-browser fixture that mounts only two of fourteen turns at a time.
 * Turn 11 mirrors ChatGPT's rich pasted-message DOM (`.markdown` on a user
 * turn), which caused the production capture to emit an empty string.
 */
function getVirtualizedChatGptHtml(): string {
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>ChatGPT - Virtualized Regression</title>
        <style>
          #chat { height: 500px; overflow-y: auto; position: relative; }
          #spacer { height: 7000px; position: relative; }
          #mounted { position: absolute; inset: 0; }
          section { position: absolute; width: 100%; height: 500px; }
        </style>
      </head>
      <body>
        <main>
          <div id="chat">
            <div id="spacer"><div id="mounted"></div></div>
          </div>
        </main>
        <script>
          const total = 14;
          const turnHeight = 500;
          const chat = document.getElementById('chat');
          const mounted = document.getElementById('mounted');

          function turnHtml(turn) {
            const role = turn % 2 === 1 ? 'user' : 'assistant';
            let content;
            if (role === 'assistant') {
              content = '<div class="markdown prose"><p>Assistant turn ' + turn + '</p></div>';
            } else if (turn === 11) {
              content = '<div class="markdown prose"><p>Rich pasted user turn 11</p><h2>Details</h2></div>';
            } else {
              content = '<div class="whitespace-pre-wrap">User turn ' + turn + '</div>';
            }
            return '<section style="top:' + ((turn - 1) * turnHeight) + 'px" ' +
              'data-turn="' + role + '" data-testid="conversation-turn-' + turn + '">' +
              '<h4 class="sr-only">Message</h4>' + content + '</section>';
          }

          function mount() {
            const first = Math.min(
              Math.max(Math.floor(chat.scrollTop / turnHeight) + 1, 1),
              total - 1
            );
            mounted.innerHTML = turnHtml(first) + turnHtml(first + 1);
          }

          chat.addEventListener('scroll', mount, { passive: true });
          chat.scrollTop = chat.scrollHeight - chat.clientHeight;
          mount();
          window.__virtualizedChatReady = true;
        </script>
      </body>
    </html>`;
}

describe('E2E: Export Flow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    // Extension이 로드된 브라우저 시작
    browser = await setupBrowser();
    page = await createPage(browser);
  }, 30000); // 30초 타임아웃

  afterAll(async () => {
    await closeBrowser(browser);
  });

  it('should load the browser with extension', async () => {
    expect(browser).toBeDefined();
    expect(page).toBeDefined();
  });

  it('should navigate to a test page', async () => {
    // 간단한 테스트 페이지로 이동
    await page.goto('about:blank');
    const url = page.url();
    expect(url).toBe('about:blank');
  });

  it('should have manifest.json in extension directory', async () => {
    const fs = await import('fs/promises');
    const manifestPath = path.resolve(__dirname, '../../manifest.json');
    const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
    expect(manifestExists).toBe(true);
  });

  it('should verify extension files exist', async () => {
    const fs = await import('fs/promises');

    const files = [
      'manifest.json',
      'dist/background.js',
      'dist/content.js',
    ];

    for (const file of files) {
      const filePath = path.resolve(__dirname, '../../', file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('should export every virtualized ChatGPT turn through the loaded extension', async () => {
    await page.setRequestInterception(true);
    const intercept = (request: HTTPRequest) => {
      if (request.isNavigationRequest() && request.url() === VIRTUALIZED_CHATGPT_URL) {
        void request.respond({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: getVirtualizedChatGptHtml(),
        });
        return;
      }
      void request.continue();
    };
    page.on('request', intercept);

    try {
      await page.goto(VIRTUALIZED_CHATGPT_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction('window.__virtualizedChatReady === true');

      const serviceWorkerTarget =
        browser.targets().find(
          (target) =>
            target.type() === 'service_worker' &&
            target.url().startsWith('chrome-extension://')
        ) ??
        (await browser.waitForTarget(
          (target) =>
            target.type() === 'service_worker' &&
            target.url().startsWith('chrome-extension://'),
          { timeout: 10000 }
        ));
      const serviceWorker = await serviceWorkerTarget.worker();
      expect(serviceWorker).not.toBeNull();

      const response = await serviceWorker!.evaluate(async (expectedUrl) => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs.find((candidate) => candidate.url === expectedUrl);
        if (!tab?.id) {
          throw new Error(`Could not find active fixture tab for ${expectedUrl}`);
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['dist/content.js'],
        });
        return await chrome.tabs.sendMessage(tab.id, {
          type: 'EXPORT_CONVERSATION',
        });
      }, VIRTUALIZED_CHATGPT_URL) as { success: boolean; data?: string; error?: string };

      expect(response.success, response.error).toBe(true);
      const records = response.data!
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const messages = records.slice(1);

      expect(messages).toHaveLength(14);
      expect(messages.map((message) => message.role)).toEqual(
        Array.from({ length: 14 }, (_, index) =>
          index % 2 === 0 ? 'user' : 'assistant'
        )
      );
      expect(messages[10].content).toContain('Rich pasted user turn 11');
      expect(messages.every((message) => message.content.length > 0)).toBe(true);
    } finally {
      page.off('request', intercept);
      await page.setRequestInterception(false);
    }
  }, 30000);

  // The command/download layer is covered by background utility tests; the
  // regression above executes the built content script through Chrome's real
  // extension service worker and validates the returned JSONL end to end.
});

describe('E2E: Platform Detection', () => {
  it('should identify supported platform URLs', () => {
    const supportedUrls = [
      'https://chatgpt.com/c/123',
      'https://claude.ai/chat/456',
      'https://gemini.google.com/app/789',
    ];

    supportedUrls.forEach((url) => {
      expect(url).toMatch(/(chatgpt\.com|claude\.ai|gemini\.google\.com)/);
    });
  });

  it('should reject unsupported platform URLs', () => {
    const unsupportedUrls = [
      'https://example.com',
      'https://google.com',
      'https://github.com',
    ];

    unsupportedUrls.forEach((url) => {
      expect(url).not.toMatch(/(chatgpt\.com|claude\.ai|gemini\.google\.com)/);
    });
  });
});
