/**
 * Vitest 테스트 환경 설정
 * Chrome Extension API 모킹
 */

import { vi } from 'vitest';

// Chrome API 모킹
// @ts-ignore
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
  downloads: {
    download: vi.fn(),
  },
} as any;

console.log('Test setup complete: Chrome API mocked');
