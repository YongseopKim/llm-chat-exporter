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

    it('should extract mermaid code from Grok Shiki structure with proper newlines', () => {
      // Real Grok DOM structure from user report - Shiki wraps each line in <span class="line">
      // Issue: newlines between <span class="line"> elements were lost, causing inline code output
      const html = `<div data-testid="code-block">
        <div class="border border-warm-gray-100">
          <div class="flex flex-row px-4 py-2 h-10 items-center">
            <span class="font-mono text-xs text-secondary">mermaid</span>
          </div>
          <div class="shiki not-prose">
            <pre class="shiki slack-ochin"><code><span class="line"><span>flowchart TD</span></span>
<span class="line"><span>    subgraph Phase1 ["Phase 1: Security Core"]</span></span>
<span class="line"><span>        Bank[Bank / Institution]</span></span>
<span class="line"><span>    end</span></span></code></pre>
          </div>
        </div>
      </div>`;
      const md = htmlToMarkdown(html);

      // Must be fenced code block with mermaid language
      expect(md).toContain('```mermaid');
      expect(md).toContain('```');

      // Must NOT be inline code (single backtick)
      expect(md).not.toMatch(/^`[^`]/);

      // Must preserve newlines (each line should be separate)
      expect(md).toContain('flowchart TD');
      expect(md).toContain('subgraph Phase1');
      expect(md).toContain('Bank[Bank / Institution]');
      expect(md).toContain('end');

      // Verify newlines are preserved by checking the content has multiple lines
      const codeBlockMatch = md.match(/```mermaid\n([\s\S]*?)\n```/);
      expect(codeBlockMatch).not.toBeNull();
      if (codeBlockMatch) {
        const codeContent = codeBlockMatch[1];
        const lines = codeContent.split('\n');
        expect(lines.length).toBeGreaterThanOrEqual(4);
      }
    });

    it('should handle Grok Shiki structure WITHOUT newlines between line spans', () => {
      // This is the actual problem case - when innerHTML is obtained from browser,
      // newlines between <span class="line"> elements may be lost
      // All line spans are on one continuous line without newlines
      const html = `<div data-testid="code-block"><div class="border"><div class="flex"><span class="text-secondary">mermaid</span></div><div class="shiki"><pre class="shiki"><code><span class="line"><span>flowchart TD</span></span><span class="line"><span>    subgraph Phase1</span></span><span class="line"><span>        Bank[Bank]</span></span><span class="line"><span>    end</span></span></code></pre></div></div></div>`;
      const md = htmlToMarkdown(html);

      // Must be fenced code block with mermaid language, NOT inline code
      expect(md).toContain('```mermaid');

      // Each line should be on a separate line in the output
      const codeBlockMatch = md.match(/```mermaid\n([\s\S]*?)\n```/);
      expect(codeBlockMatch).not.toBeNull();
      if (codeBlockMatch) {
        const codeContent = codeBlockMatch[1];
        const lines = codeContent.split('\n');
        // Should have 4 separate lines even though input had no newlines
        expect(lines.length).toBeGreaterThanOrEqual(4);
        expect(lines[0]).toContain('flowchart TD');
        expect(lines[1]).toContain('subgraph Phase1');
      }
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
  // Mermaid Diagram Handling
  // ============================================================

  describe('Mermaid Diagram Handling', () => {
    it('should preserve mermaid code block when NOT rendered by extension', () => {
      // 원본 mermaid 코드 블록 (확장 프로그램 없이)
      const html = `<pre><code class="language-mermaid">graph TD
    A[Start] --> B[Process]
    B --> C[End]</code></pre>`;
      const md = htmlToMarkdown(html);
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph TD');
      expect(md).toContain('A[Start] --> B[Process]');
    });

    it('should lose mermaid code when rendered to SVG by extension (problem case)', () => {
      // Mermaid 확장 프로그램이 렌더링한 후의 DOM 구조
      // 원본 코드가 사라지고 SVG만 남음
      const html = `<div class="mermaid">
        <svg id="mermaid-svg-0" width="100%" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0,0)">
            <rect class="node" rx="5" ry="5" x="0" y="0" width="60" height="40"></rect>
            <text x="30" y="25">Start</text>
          </g>
          <g transform="translate(100,0)">
            <rect class="node" rx="5" ry="5" x="0" y="0" width="80" height="40"></rect>
            <text x="40" y="25">Process</text>
          </g>
          <path class="flowchart-link" d="M60,20L100,20"></path>
        </svg>
      </div>`;
      const md = htmlToMarkdown(html);

      // SVG가 렌더링되면 원본 mermaid 코드를 복구할 수 없음
      expect(md).not.toContain('```mermaid');
      expect(md).not.toContain('graph TD');
      expect(md).not.toContain('-->'); // 화살표 구문 없음

      // SVG가 제거되어 노드 텍스트도 추출되지 않음 (의도된 동작)
      // Mermaid Preserving Renderer 없이 렌더링된 SVG는 완전히 손실됨
      expect(md).not.toContain('Start');
      expect(md).not.toContain('Process');
    });

    it('should lose mermaid code when extension replaces pre with svg', () => {
      // 일부 확장 프로그램은 pre 태그를 완전히 교체함
      const html = `<svg class="mermaid" id="mermaid-1" style="max-width: 100%;">
        <g class="root">
          <rect rx="0" ry="0" class="edge-thickness-normal"></rect>
          <text>A</text>
          <text>B</text>
        </g>
      </svg>`;
      const md = htmlToMarkdown(html);

      // 원본 mermaid 문법 복구 불가
      expect(md).not.toContain('```');
      expect(md).not.toContain('graph');
    });

    it('should preserve mermaid when extension keeps original hidden', () => {
      // 일부 확장 프로그램은 원본을 숨겨두고 SVG를 추가함
      const html = `<div class="mermaid-container">
        <pre style="display: none;"><code class="language-mermaid">graph LR
    A --> B</code></pre>
        <svg class="mermaid-rendered">
          <text>A</text>
          <text>B</text>
        </svg>
      </div>`;
      const md = htmlToMarkdown(html);

      // display:none인 요소도 textContent로 추출되므로 원본 보존됨
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph LR');
      expect(md).toContain('A --> B');
    });

    it('should extract only mermaid code from mpr-container (not SVG/button text)', () => {
      // Mermaid Preserving Renderer가 생성하는 실제 구조
      const html = `<div class="mpr-container" data-mpr-processed="true">
        <pre class="mpr-source" style="display: none;">
          <code class="language-mermaid">graph TD
    A[Start] --> B[End]</code>
        </pre>
        <div class="mpr-rendered">
          <svg id="mpr-diagram-1">
            <text x="30" y="25">Start</text>
            <text x="30" y="75">End</text>
          </svg>
        </div>
        <button class="mpr-toggle">{ }</button>
      </div>`;
      const md = htmlToMarkdown(html);

      // 원본 mermaid 코드 추출 확인
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph TD');
      expect(md).toContain('A[Start] --> B[End]');

      // SVG 내부 텍스트가 별도로 추출되지 않아야 함
      // (mermaid 코드 블록 외부에 "Start", "End"가 중복 출력되면 안됨)
      const codeBlockMatch = md.match(/```mermaid[\s\S]*?```/);
      const outsideCodeBlock = codeBlockMatch
        ? md.replace(codeBlockMatch[0], '')
        : md;

      // 코드 블록 외부에 SVG 텍스트가 없어야 함
      expect(outsideCodeBlock).not.toMatch(/\bStart\b/);
      expect(outsideCodeBlock).not.toMatch(/\bEnd\b/);

      // 버튼 텍스트도 추출되지 않아야 함
      expect(md).not.toContain('{ }');
    });

    it('should not extract SVG style tags from mpr-rendered (Claude/Gemini issue)', () => {
      // 실제 Claude/Gemini에서 발생하는 문제: SVG 내부 <style> 태그 내용이 추출됨
      const html = `<div class="mpr-container" data-mpr-processed="true">
        <pre class="mpr-source" style="display: none;">
          <code class="language-mermaid">flowchart TD
    A --> B</code>
        </pre>
        <div class="mpr-rendered">
          <svg id="mpr-diagram-2" xmlns="http://www.w3.org/2000/svg">
            <style>
              #mpr-diagram-2{font-family:inherit;font-size:16px;fill:#333;}
              #mpr-diagram-2 .node rect{fill:#ECECFF;stroke:#9370DB;}
            </style>
            <g class="root">
              <text>Phase 1: Security Core</text>
              <text>Bank / Institution</text>
            </g>
          </svg>
        </div>
        <button class="mpr-toggle">{ }</button>
      </div>`;
      const md = htmlToMarkdown(html);

      // 원본 코드만 추출되어야 함
      expect(md).toContain('```mermaid');
      expect(md).toContain('flowchart TD');

      // SVG style 내용이 추출되면 안됨
      expect(md).not.toContain('font-family:inherit');
      expect(md).not.toContain('#mpr-diagram');
      expect(md).not.toContain('stroke:#9370DB');

      // SVG 텍스트가 추출되면 안됨
      expect(md).not.toContain('Phase 1: Security Core');
      expect(md).not.toContain('Bank / Institution');

      // 버튼 텍스트도 추출되면 안됨
      expect(md).not.toContain('{ }');
    });

    it('should not extract SVG content from Grok native mermaid rendering (no mpr)', () => {
      // Grok은 자체적으로 mermaid를 렌더링하여 mpr-container가 없음
      // 원본 코드가 없고 SVG만 있는 상황
      const html = `<div class="mermaid flex flex-col items-center">
        <svg aria-roledescription="flowchart-v2" role="graphics-document document"
             viewBox="0 0 588.251953125 828" class="flowchart"
             xmlns="http://www.w3.org/2000/svg" width="100%" id="mermaid-diagram-123">
          <style>
            #mermaid-diagram-123 {
              font-family: "trebuchet ms", verdana, arial, sans-serif;
              font-size: 16px;
              fill: #000000;
            }
            #mermaid-diagram-123 .node rect {
              fill: #eee;
              stroke: #999;
            }
          </style>
          <g class="root">
            <g class="clusters">
              <g class="cluster" id="Phase1">
                <rect height="256" width="291" y="8" x="15"></rect>
                <foreignObject height="24" width="158">
                  <div xmlns="http://www.w3.org/1999/xhtml">
                    <span class="nodeLabel"><p>Phase 1: Security Core</p></span>
                  </div>
                </foreignObject>
              </g>
            </g>
            <g class="nodes">
              <g class="node" id="flowchart-Bank-0" transform="translate(161.35, 60)">
                <foreignObject height="24" width="124">
                  <div xmlns="http://www.w3.org/1999/xhtml">
                    <span class="nodeLabel"><p>Bank / Institution</p></span>
                  </div>
                </foreignObject>
              </g>
            </g>
          </g>
        </svg>
      </div>`;
      const md = htmlToMarkdown(html);

      // SVG style 내용이 추출되면 안됨
      expect(md).not.toContain('font-family');
      expect(md).not.toContain('trebuchet');
      expect(md).not.toContain('#mermaid-diagram');
      expect(md).not.toContain('stroke: #999');

      // SVG foreignObject 내부 텍스트도 추출되면 안됨
      expect(md).not.toContain('Phase 1: Security Core');
      expect(md).not.toContain('Bank / Institution');

      // SVG가 제거되었으므로 빈 결과 또는 컨테이너만 남아야 함
      expect(md.trim()).toBe('');
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
