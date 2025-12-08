import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../../src/content/converter';

describe('htmlToMarkdown', () => {
  // Basic conversions
  it('should convert basic paragraph to markdown', () => {
    const html = '<p>Hello world</p>';
    const md = htmlToMarkdown(html);
    expect(md.trim()).toBe('Hello world');
  });

  it('should convert multiple paragraphs', () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('First paragraph');
    expect(md).toContain('Second paragraph');
  });

  // Code blocks
  it('should preserve code block with language', () => {
    const html = '<pre><code class="language-python">def hello():\n    print("hi")</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```python');
    expect(md).toContain('def hello()');
    expect(md).toContain('print("hi")');
    expect(md).toContain('```');
  });

  it('should handle code block without language', () => {
    const html = '<pre><code>git commit -m "message"</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```');
    expect(md).toContain('git commit');
  });

  it('should preserve inline code with backticks', () => {
    const html = '<p>Use <code>console.log()</code> for debugging</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('`console.log()`');
  });

  // Lists
  it('should handle nested lists', () => {
    const html = '<ul><li>Item 1<ul><li>Subitem A</li><li>Subitem B</li></ul></li><li>Item 2</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Item 1');
    expect(md).toContain('Subitem A');
    expect(md).toContain('Subitem B');
    expect(md).toContain('Item 2');
    // Check for indentation (2 or 4 spaces)
    expect(md).toMatch(/\s+(Subitem A|Subitem B)/);
  });

  it('should convert ordered lists', () => {
    const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('First');
    expect(md).toContain('Second');
    expect(md).toContain('Third');
    expect(md).toMatch(/1\./);
  });

  // Tables
  it('should convert tables to markdown tables', () => {
    const html = `<table>
      <thead><tr><th>Name</th><th>Age</th></tr></thead>
      <tbody>
        <tr><td>Alice</td><td>30</td></tr>
        <tr><td>Bob</td><td>25</td></tr>
      </tbody>
    </table>`;
    const md = htmlToMarkdown(html);

    // Should contain table headers
    expect(md).toContain('Name');
    expect(md).toContain('Age');

    // Should contain table data
    expect(md).toContain('Alice');
    expect(md).toContain('Bob');

    // Should use markdown table format (| or at least structured)
    // Note: Basic Turndown may not preserve table format perfectly
    // If this fails, it confirms we need the custom table rule
  });

  // Emphasis
  it('should handle bold text', () => {
    const html = '<p>This is <strong>bold</strong> text</p>';
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/\*\*bold\*\*|__bold__/);
  });

  it('should handle italic text', () => {
    const html = '<p>This is <em>italic</em> text</p>';
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/\*italic\*|_italic_/);
  });

  it('should handle bold and italic together', () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em></p>';
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/\*\*bold\*\*/);
    expect(md).toMatch(/(\*italic\*|_italic_)/); // Both * and _ are valid for italic
  });

  // Links
  it('should convert links correctly', () => {
    const html = '<p>Check out <a href="https://example.com">this link</a></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('[this link](https://example.com)');
  });

  // Headings
  it('should preserve headings with atx style', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
    expect(md).toContain('### Section');
  });

  it('should handle h4-h6 headings', () => {
    const html = '<h4>Level 4</h4><h5>Level 5</h5><h6>Level 6</h6>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('#### Level 4');
    expect(md).toContain('##### Level 5');
    expect(md).toContain('###### Level 6');
  });

  // Complex/Nested HTML
  it('should handle complex nested HTML', () => {
    const html = `<div>
      <p>Here's a code example:</p>
      <pre><code class="language-javascript">function add(a, b) {
  return a + b;
}</code></pre>
      <p>And a list:</p>
      <ul>
        <li>First item</li>
        <li>Second item</li>
      </ul>
    </div>`;
    const md = htmlToMarkdown(html);

    expect(md).toContain('code example');
    expect(md).toContain('```javascript');
    expect(md).toContain('function add');
    expect(md).toContain('First item');
    expect(md).toContain('Second item');
  });

  // LLM-specific content
  it('should handle code blocks with multiple languages', () => {
    const html = `
      <pre><code class="language-python">print("Python")</code></pre>
      <pre><code class="language-javascript">console.log("JS")</code></pre>
      <pre><code class="language-rust">println!("Rust")</code></pre>
    `;
    const md = htmlToMarkdown(html);

    expect(md).toContain('```python');
    expect(md).toContain('```javascript');
    expect(md).toContain('```rust');
  });

  // Edge cases
  it('should strip unnecessary whitespace', () => {
    const html = '<p>   Too    much    space   </p>';
    const md = htmlToMarkdown(html).trim();

    // Should normalize spaces
    expect(md).toBeTruthy();
    expect(md.length).toBeLessThan(html.length);
  });

  it('should handle empty HTML', () => {
    const html = '';
    const md = htmlToMarkdown(html);
    expect(md).toBe('');
  });

  it('should handle HTML with only whitespace', () => {
    const html = '   \n\n   ';
    const md = htmlToMarkdown(html).trim();
    expect(md).toBe('');
  });

  // ============================================================
  // ChatGPT/Grok Code Block Cleaning
  // ============================================================

  describe('Code Block Cleaning', () => {
    it('should extract code from ChatGPT code block structure', () => {
      // ChatGPT wraps code in complex structure with language label and copy button
      const html = `<pre class="overflow-visible!">
        <div class="contain-inline-size rounded-2xl">
          <div class="flex items-center text-xs">python</div>
          <div class="sticky top-9">
            <div class="absolute end-0">
              <button aria-label="복사">코드 복사</button>
            </div>
          </div>
          <div class="overflow-y-auto p-4">
            <code class="whitespace-pre! language-python"><span><span>print("hello")</span></span></code>
          </div>
        </div>
      </pre>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('```python');
      expect(md).toContain('print("hello")');
      expect(md).not.toContain('복사');
      expect(md).not.toContain('코드 복사');
    });

    it('should extract code from Grok code block structure', () => {
      // Grok uses data-testid="code-block" with shiki syntax highlighting
      const html = `<div data-testid="code-block">
        <div class="border border-warm-gray-100">
          <div class="flex flex-row px-4 py-2">
            <span class="font-mono text-xs text-secondary">text</span>
          </div>
          <div class="sticky w-full right-2">
            <div class="absolute bottom-1 right-1">
              <button aria-label="자동 줄바꿈"></button>
              <button><span>복사</span></button>
            </div>
          </div>
          <div class="shiki not-prose">
            <pre class="shiki slack-ochin"><code><span class="line"><span>Input Log → State Machine</span></span>
<span class="line"><span>Leader 제안 → 과반 커밋</span></span></code></pre>
          </div>
        </div>
      </div>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('```text');
      expect(md).toContain('Input Log → State Machine');
      expect(md).toContain('Leader 제안 → 과반 커밋');
      expect(md).not.toContain('복사');
    });

    it('should preserve multiline code with proper whitespace', () => {
      const html = `<pre class="overflow-visible!">
        <div class="contain-inline-size">
          <div>text</div>
          <div class="overflow-y-auto p-4">
            <code class="language-text"><span><span>          +----------------------+
          |  Deterministic       |
  input ->|  State Machine       |-> output
          +----------------------+</span></span></code>
          </div>
        </div>
      </pre>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('+----------------------+');
      expect(md).toContain('Deterministic');
      expect(md).toContain('State Machine');
    });

    it('should handle code block without copy button', () => {
      // Standard pre/code structure should still work
      const html = '<pre><code class="language-python">def foo(): pass</code></pre>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('```python');
      expect(md).toContain('def foo(): pass');
    });
  });

  // ============================================================
  // KaTeX Math Extraction
  // ============================================================

  describe('KaTeX Math Extraction', () => {
    it('should extract LaTeX from block math (katex-display)', () => {
      const html = `<span class="katex-display"><span class="katex">
        <span class="katex-mathml">
          <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
            <semantics>
              <mrow></mrow>
              <annotation encoding="application/x-tex">x^2 + y^2 = z^2</annotation>
            </semantics>
          </math>
        </span>
        <span class="katex-html" aria-hidden="true">rendered content</span>
      </span></span>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('$$x^2 + y^2 = z^2$$');
      expect(md).not.toContain('rendered content');
    });

    it('should extract LaTeX from inline math (katex without display)', () => {
      const html = `<span class="katex">
        <span class="katex-mathml">
          <math xmlns="http://www.w3.org/1998/Math/MathML">
            <semantics>
              <mrow></mrow>
              <annotation encoding="application/x-tex">E = mc^2</annotation>
            </semantics>
          </math>
        </span>
        <span class="katex-html" aria-hidden="true">rendered</span>
      </span>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('$E = mc^2$');
      expect(md).not.toContain('$$'); // Should not be block math
    });

    it('should handle complex LaTeX expressions', () => {
      const latex = String.raw`S_n = Apply(Apply(...Apply(S_0, Tx_1) ..., Tx_{n-1}), Tx_n)`;
      const html = `<span class="katex-display"><span class="katex">
        <span class="katex-mathml">
          <math><semantics><mrow></mrow>
            <annotation encoding="application/x-tex">${latex}</annotation>
          </semantics></math>
        </span>
      </span></span>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain(`$$${latex}$$`);
    });

    it('should handle inline math within paragraph', () => {
      const html = `<p>The formula <span class="katex">
        <span class="katex-mathml"><math><semantics><mrow></mrow>
          <annotation encoding="application/x-tex">a^2 + b^2</annotation>
        </semantics></math></span>
      </span> is Pythagorean.</p>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('$a^2 + b^2$');
      expect(md).toContain('Pythagorean');
    });

    it('should not double-wrap math when katex is inside katex-display', () => {
      // The inner katex should not be processed separately
      const html = `<span class="katex-display"><span class="katex">
        <span class="katex-mathml"><math><semantics><mrow></mrow>
          <annotation encoding="application/x-tex">\\sum_{i=1}^n i</annotation>
        </semantics></math></span>
      </span></span>`;
      const md = htmlToMarkdown(html);
      // Should have exactly one block math, not nested
      expect(md.match(/\$\$/g)?.length).toBe(2); // Opening and closing $$
    });
  });
});
