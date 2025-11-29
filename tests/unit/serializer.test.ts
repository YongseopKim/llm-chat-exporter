import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildJsonl } from '../../src/content/serializer';
import type { ParsedMessage, ExportMetadata } from '../../src/content/parsers/interface';

// Mock the converter module
vi.mock('../../src/content/converter', () => ({
  htmlToMarkdown: vi.fn((html: string) => `[MD]${html}[/MD]`)
}));

describe('buildJsonl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should serialize single message to JSONL', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Hello</p>', timestamp: '2025-11-29T10:00:00Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');

    expect(lines.length).toBe(2); // metadata + 1 message

    const metaLine = JSON.parse(lines[0]);
    expect(metaLine).toHaveProperty('_meta', true);
    expect(metaLine.platform).toBe('chatgpt');
    expect(metaLine.url).toBe('https://chatgpt.com/c/123');

    const messageLine = JSON.parse(lines[1]);
    expect(messageLine.role).toBe('user');
    expect(messageLine.content).toBe('[MD]<p>Hello</p>[/MD]');
    expect(messageLine.timestamp).toBe('2025-11-29T10:00:00Z');
  });

  it('should handle multiple messages', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Q1</p>', timestamp: '2025-11-29T10:00:00Z' },
      { role: 'assistant', contentHtml: '<p>A1</p>', timestamp: '2025-11-29T10:00:05Z' },
      { role: 'user', contentHtml: '<p>Q2</p>', timestamp: '2025-11-29T10:00:10Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'claude',
      url: 'https://claude.ai/chat/abc',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');

    expect(lines.length).toBe(4); // metadata + 3 messages

    const msg1 = JSON.parse(lines[1]);
    const msg2 = JSON.parse(lines[2]);
    const msg3 = JSON.parse(lines[3]);

    expect(msg1.role).toBe('user');
    expect(msg2.role).toBe('assistant');
    expect(msg3.role).toBe('user');
  });

  it('should handle content with newlines', () => {
    const messages: ParsedMessage[] = [
      {
        role: 'user',
        contentHtml: '<p>Line 1\nLine 2\nLine 3</p>',
        timestamp: '2025-11-29T10:00:00Z'
      }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');

    // Each line should be valid JSON
    lines.forEach(line => {
      if (line.trim()) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    const messageLine = JSON.parse(lines[1]);
    expect(messageLine.content).toContain('[MD]');
  });

  it('should add timestamp if missing', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Hello</p>' } // No timestamp
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const messageLine = JSON.parse(lines[1]);

    expect(messageLine.timestamp).toBeDefined();
    expect(messageLine.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601 format
  });

  it('should call htmlToMarkdown for each message', async () => {
    // Get the mocked function
    const converterModule = await import('../../src/content/converter');
    const htmlToMarkdown = converterModule.htmlToMarkdown as ReturnType<typeof vi.fn>;

    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Message 1</p>', timestamp: '2025-11-29T10:00:00Z' },
      { role: 'assistant', contentHtml: '<p>Message 2</p>', timestamp: '2025-11-29T10:00:05Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    buildJsonl(messages, metadata);

    expect(htmlToMarkdown).toHaveBeenCalledTimes(2);
    expect(htmlToMarkdown).toHaveBeenCalledWith('<p>Message 1</p>');
    expect(htmlToMarkdown).toHaveBeenCalledWith('<p>Message 2</p>');
  });

  it('should handle empty message array', () => {
    const messages: ParsedMessage[] = [];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');

    expect(lines.length).toBe(1); // Only metadata
    const metaLine = JSON.parse(lines[0]);
    expect(metaLine._meta).toBe(true);
  });

  it('should include optional title in metadata', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Hello</p>', timestamp: '2025-11-29T10:00:00Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'claude',
      url: 'https://claude.ai/chat/abc',
      title: 'My Conversation',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const metaLine = JSON.parse(lines[0]);

    expect(metaLine.title).toBe('My Conversation');
  });

  it('should produce valid JSON for each line', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Q1</p>', timestamp: '2025-11-29T10:00:00Z' },
      { role: 'assistant', contentHtml: '<p>A1</p>', timestamp: '2025-11-29T10:00:05Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/123',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');

    // Every line must be valid JSON
    lines.forEach((line, index) => {
      if (line.trim()) {
        expect(() => JSON.parse(line), `Line ${index} should be valid JSON`).not.toThrow();
      }
    });
  });

  it('should include all metadata fields in meta line', () => {
    const messages: ParsedMessage[] = [];
    const metadata: ExportMetadata = {
      platform: 'gemini',
      url: 'https://gemini.google.com/app/xyz',
      title: 'Test Chat',
      exported_at: '2025-11-29T12:00:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const metaLine = JSON.parse(lines[0]);

    expect(metaLine._meta).toBe(true);
    expect(metaLine.platform).toBe('gemini');
    expect(metaLine.url).toBe('https://gemini.google.com/app/xyz');
    expect(metaLine.title).toBe('Test Chat');
    expect(metaLine.exported_at).toBe('2025-11-29T12:00:00Z');
  });
});
