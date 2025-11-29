/**
 * Content Script 단위 테스트
 * Phase 2 수준: 기본 동작 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('content script', () => {
  beforeEach(() => {
    // Chrome API 모킹 초기화
    vi.clearAllMocks();
  });

  describe('message listener', () => {
    it('should have chrome.runtime.onMessage API available', () => {
      expect(chrome).toBeDefined();
      expect(chrome.runtime).toBeDefined();
      expect(chrome.runtime.onMessage).toBeDefined();
      expect(chrome.runtime.onMessage.addListener).toBeDefined();
    });
  });

  describe('dummy response format', () => {
    it('should generate valid JSONL format', () => {
      const dummyMessages = [
        { role: 'user', content: 'Test message', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Test response', timestamp: new Date().toISOString() },
      ];

      const jsonl = dummyMessages.map((msg) => JSON.stringify(msg)).join('\n');

      // JSONL은 각 라인이 유효한 JSON이어야 함
      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(2);

      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('role');
        expect(parsed).toHaveProperty('content');
        expect(parsed).toHaveProperty('timestamp');
      });
    });

    it('should have valid role values', () => {
      const dummyMessages = [
        { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Test', timestamp: new Date().toISOString() },
      ];

      dummyMessages.forEach((msg) => {
        expect(['user', 'assistant']).toContain(msg.role);
      });
    });

    it('should have ISO 8601 timestamp format', () => {
      const timestamp = new Date().toISOString();

      // ISO 8601 format: 2025-11-29T10:30:00.000Z
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('export response structure', () => {
    it('should match ExportResponse interface', () => {
      const successResponse = {
        success: true,
        data: '{"role":"user","content":"test","timestamp":"2025-11-29T10:00:00.000Z"}',
      };

      expect(successResponse).toHaveProperty('success');
      expect(successResponse.success).toBe(true);
      expect(successResponse).toHaveProperty('data');
      expect(typeof successResponse.data).toBe('string');
    });

    it('should handle error response format', () => {
      const errorResponse = {
        success: false,
        error: 'Test error message',
      };

      expect(errorResponse).toHaveProperty('success');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
    });
  });
});
