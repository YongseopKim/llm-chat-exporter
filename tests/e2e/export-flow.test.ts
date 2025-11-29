/**
 * E2E 테스트: Extension 로딩 및 Export 플로우
 *
 * 주의: 이 테스트는 headless: false로 실행되며,
 * 실제 Chrome 창이 열립니다.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Browser, Page } from 'puppeteer';
import { setupBrowser, createPage, closeBrowser } from './setup';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // TODO: 실제 Extension 기능 테스트는 background script와 content script가
  // 완전히 구현된 후 추가
  // - Extension 로딩 확인
  // - 단축키 트리거 시뮬레이션
  // - 다운로드 발생 확인
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
