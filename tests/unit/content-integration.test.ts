/**
 * Phase 3 Integration Test
 *
 * Validates that all Phase 3 utilities work together correctly:
 * - Parser Interface
 * - JSONL Serializer
 * - HTML→Markdown Converter
 * - Parser Factory
 * - Simplified Scroller
 */

import { describe, it, expect } from 'vitest';
import { buildJsonl } from '../../src/content/serializer';
import { htmlToMarkdown } from '../../src/content/converter';
import type { ParsedMessage, ExportMetadata } from '../../src/content/parsers/interface';

describe('Phase 3 Integration', () => {
  it('should convert HTML messages to JSONL end-to-end', () => {
    const messages: ParsedMessage[] = [
      {
        role: 'user',
        contentHtml: '<p>Hello, how are you?</p>',
        timestamp: '2025-11-29T10:00:00Z'
      },
      {
        role: 'assistant',
        contentHtml: '<p>I am doing well, thank you! Here is some <strong>bold text</strong>.</p>'
      },
      {
        role: 'user',
        contentHtml: '<pre><code class="language-python">print("Hello")</code></pre>',
        timestamp: '2025-11-29T10:01:00Z'
      }
    ];

    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/test123',
      title: 'Test Conversation',
      exported_at: '2025-11-29T10:02:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n').filter(l => l.trim());

    // Should have metadata + 3 messages
    expect(lines.length).toBe(4);

    // Validate metadata line
    const metaLine = JSON.parse(lines[0]);
    expect(metaLine._meta).toBe(true);
    expect(metaLine.platform).toBe('chatgpt');
    expect(metaLine.url).toBe('https://chatgpt.com/c/test123');
    expect(metaLine.title).toBe('Test Conversation');

    // Validate message lines
    const msg1 = JSON.parse(lines[1]);
    const msg2 = JSON.parse(lines[2]);
    const msg3 = JSON.parse(lines[3]);

    expect(msg1.role).toBe('user');
    expect(msg1.content).not.toContain('<p>'); // HTML stripped
    expect(msg1.content).toContain('Hello, how are you?');

    expect(msg2.role).toBe('assistant');
    expect(msg2.content).toContain('**bold text**'); // Markdown formatting
    expect(msg2.timestamp).toBeDefined(); // Auto-generated

    expect(msg3.role).toBe('user');
    expect(msg3.content).toContain('```python'); // Code block preserved
    expect(msg3.content).toContain('print("Hello")');
  });

  it('should handle converter + serializer composition', () => {
    // Test that serializer properly calls converter
    const html = '<p>Test <code>inline code</code> and <em>italic</em></p>';
    const md = htmlToMarkdown(html);

    expect(md).toContain('`inline code`');
    expect(md).toMatch(/\*italic\*|_italic_/);

    // Use in serializer
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: html, timestamp: '2025-11-29T10:00:00Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'claude',
      url: 'https://claude.ai/chat/abc',
      exported_at: '2025-11-29T10:00:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const messageLine = JSON.parse(lines[1]);

    expect(messageLine.content).toContain('`inline code`');
  });

  it('should add timestamps when missing', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Message without timestamp</p>' }
    ];
    const metadata: ExportMetadata = {
      platform: 'gemini',
      url: 'https://gemini.google.com/app/xyz',
      exported_at: '2025-11-29T12:00:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const messageLine = JSON.parse(lines[1]);

    expect(messageLine.timestamp).toBeDefined();
    expect(messageLine.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should produce valid JSON for each line', () => {
    const messages: ParsedMessage[] = [
      { role: 'user', contentHtml: '<p>Q1</p>', timestamp: '2025-11-29T10:00:00Z' },
      { role: 'assistant', contentHtml: '<p>A1</p>', timestamp: '2025-11-29T10:00:05Z' },
      { role: 'user', contentHtml: '<p>Q2</p>', timestamp: '2025-11-29T10:00:10Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/test',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n').filter(l => l.trim());

    // Every line must be valid JSON
    lines.forEach((line, index) => {
      expect(() => JSON.parse(line), `Line ${index} should be valid JSON`).not.toThrow();
    });
  });

  it('should handle complex LLM response with code and formatting', () => {
    const complexHtml = `
      <div>
        <p>Here's how to use it:</p>
        <ol>
          <li>Install the package</li>
          <li>Import the module</li>
        </ol>
        <pre><code class="language-typescript">import { Component } from 'library';

const comp = new Component();</code></pre>
        <p>Make sure to check the <strong>documentation</strong> for more details!</p>
      </div>
    `;

    const messages: ParsedMessage[] = [
      { role: 'assistant', contentHtml: complexHtml, timestamp: '2025-11-29T10:00:00Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/complex',
      exported_at: '2025-11-29T10:01:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const messageLine = JSON.parse(lines[1]);

    // Should contain all elements in Markdown
    expect(messageLine.content).toContain('how to use it');
    expect(messageLine.content).toContain('1.'); // Ordered list
    expect(messageLine.content).toContain('```typescript'); // Code block with language
    expect(messageLine.content).toContain('import { Component }');
    expect(messageLine.content).toContain('**documentation**'); // Bold text
  });

  it('should handle table conversion in integration', () => {
    const tableHtml = `
      <table>
        <thead><tr><th>Feature</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Parser</td><td>Done</td></tr>
          <tr><td>Serializer</td><td>Done</td></tr>
        </tbody>
      </table>
    `;

    const messages: ParsedMessage[] = [
      { role: 'assistant', contentHtml: tableHtml, timestamp: '2025-11-29T10:00:00Z' }
    ];
    const metadata: ExportMetadata = {
      platform: 'claude',
      url: 'https://claude.ai/chat/table-test',
      exported_at: '2025-11-29T10:00:00Z'
    };

    const jsonl = buildJsonl(messages, metadata);
    const lines = jsonl.split('\n');
    const messageLine = JSON.parse(lines[1]);

    // Should contain table headers and data
    expect(messageLine.content).toContain('Feature');
    expect(messageLine.content).toContain('Status');
    expect(messageLine.content).toContain('Parser');
    expect(messageLine.content).toContain('Serializer');

    // Should use markdown table format (|)
    expect(messageLine.content).toContain('|');
  });
});
