import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/content/converter';
import { buildJsonl } from '../../src/content/serializer';
import capturedBlocks from '../fixtures/chatgpt-current-code-blocks.json';

// Code text and wrappers captured from the original Circle conversation,
// before this fix. Presentation attributes and SVG icons are omitted; code
// text, language classes and structural copy attributes remain unchanged.
describe('current ChatGPT code blocks', () => {
  it.each(capturedBlocks)('preserves $message_id block $index exactly inside a fence', ({ html, code }) => {
    expect(htmlToMarkdown(html)).toBe('```\n' + code + '\n```');
  });

  it('preserves code block line breaks through JSONL serialization', async () => {
    const block = capturedBlocks.find(block => block.message_id === '24c3d69a-f2fa-4795-b665-f1ca7cdcf076' && block.code.startsWith('2013'))!;
    expect(block).toBeDefined();
    const jsonl = await buildJsonl([{ role: 'assistant', contentHtml: block.html }], {
      platform: 'chatgpt', url: 'https://chatgpt.com/c/code-block-regression', exported_at: '2026-09-29T00:00:00Z',
    });
    expect(jsonl.split('\n')).toHaveLength(2);
    const message = JSON.parse(jsonl.split('\n')[1]);
    expect(message.content).toBe('```\n' + block.code + '\n```');
  });

  it('keeps code whitespace, literal Markdown and embedded fences', () => {
    const code = '  # heading\n\n\t**literal** & <tag>\n```nested\n  ending  \n';
    const html = '<div data-markdown-copy="code-block"><div data-markdown-copy="exclude">python<button>Copy</button></div><div><code class="language-python">  # heading\n\n\t**literal** &amp; &lt;tag&gt;\n```nested\n  ending  \n</code></div></div>';
    expect(htmlToMarkdown(html)).toBe('````python\n' + code + '\n````');
  });
});
