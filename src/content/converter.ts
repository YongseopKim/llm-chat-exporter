/**
 * HTML to Markdown Converter
 *
 * Uses Turndown library to convert LLM conversation HTML to Markdown.
 * Includes custom rules for code blocks, tables, KaTeX math, and complex structures.
 *
 * Features:
 * - Code blocks: ✅ Works with language preservation
 * - ChatGPT/Grok code block cleaning: ✅ Removes UI elements (copy buttons, language labels)
 * - KaTeX math: ✅ Extracts LaTeX source from rendered formulas
 * - Lists: ✅ Works with nesting
 * - Emphasis: ✅ Works
 * - Links: ✅ Works
 * - Tables: ✅ Custom rule for proper conversion
 */

import TurndownService from 'turndown';

/**
 * Clean code block HTML from ChatGPT and Grok
 *
 * These platforms wrap code blocks in complex structures with UI elements
 * (language labels, copy buttons) that need to be removed before conversion.
 *
 * Also handles Mermaid Preserving Renderer output:
 * - Removes rendered SVG diagrams (.mpr-rendered)
 * - Removes toggle buttons (.mpr-toggle)
 * - Preserves original source code (.mpr-source)
 *
 * @param html - Raw HTML string
 * @returns Cleaned HTML with simplified <pre><code> structure
 */
function cleanCodeBlockHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Mermaid Preserving Renderer: Remove rendered diagrams and toggle buttons
  // Keep only the original source (.mpr-source)
  doc.querySelectorAll('.mpr-rendered').forEach((el) => el.remove());
  doc.querySelectorAll('.mpr-toggle').forEach((el) => el.remove());

  // Also remove any standalone SVG elements (mermaid diagrams without mpr wrapper)
  doc.querySelectorAll('svg').forEach((el) => el.remove());

  // Remove standalone style tags (may contain mermaid CSS)
  doc.querySelectorAll('style').forEach((el) => el.remove());

  // ChatGPT: <pre> contains divs with language label, copy button, and code
  // Structure: <pre><div>...<code class="language-X">content</code>...</div></pre>
  doc.querySelectorAll('pre').forEach((pre) => {
    const codeEl = pre.querySelector('code');
    if (codeEl && pre.querySelector('div')) {
      // This is a ChatGPT-style wrapped code block
      const langMatch = codeEl.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      // Create clean structure with just the code content
      const cleanCode = document.createElement('code');
      cleanCode.className = lang ? `language-${lang}` : '';
      cleanCode.textContent = codeEl.textContent || '';

      // Replace pre content with clean code
      pre.innerHTML = '';
      pre.appendChild(cleanCode);
    }
  });

  // Grok: [data-testid="code-block"] contains header, buttons, and shiki pre/code
  // Shiki wraps each line in <span class="line">, which may lose newlines when
  // innerHTML is captured from the browser DOM
  doc.querySelectorAll('[data-testid="code-block"]').forEach((block) => {
    const codeEl = block.querySelector('pre code');
    if (codeEl) {
      // Get language from the language label span
      const langSpan = block.querySelector('.text-secondary');
      const lang = langSpan?.textContent?.trim() || '';

      // Extract content preserving newlines from Shiki's .line structure
      const lines = codeEl.querySelectorAll('.line');
      let content: string;
      if (lines.length > 0) {
        // Shiki structure: join each .line element's text with newlines
        content = Array.from(lines)
          .map((line) => line.textContent || '')
          .join('\n');
      } else {
        // Fallback: use textContent directly
        content = codeEl.textContent || '';
      }

      // Create clean pre/code structure
      const cleanPre = document.createElement('pre');
      const cleanCode = document.createElement('code');
      cleanCode.className = lang ? `language-${lang}` : '';
      cleanCode.textContent = content;
      cleanPre.appendChild(cleanCode);

      // Replace the entire block with clean pre
      block.replaceWith(cleanPre);
    }
  });

  return doc.body.innerHTML;
}

// Configure Turndown service
const turndownService = new TurndownService({
  headingStyle: 'atx',        // Use # for headings
  codeBlockStyle: 'fenced',   // Use ``` for code blocks
  fence: '```',               // Fence character
  bulletListMarker: '-',      // Use - for lists
  emDelimiter: '_',           // Use _ for italic
  strongDelimiter: '**'       // Use ** for bold
});

/**
 * Custom Rule 1: Preserve code block language
 * Ensures code blocks maintain their language attribute for syntax highlighting
 */
turndownService.addRule('codeBlock', {
  filter: (node) => {
    return node.nodeName === 'CODE' && node.parentNode?.nodeName === 'PRE';
  },
  replacement: (content, node) => {
    const codeNode = node as HTMLElement;
    // Extract language from class (e.g., "language-python" -> "python")
    const className = codeNode.className || '';
    const language = className.match(/language-(\w+)/)?.[1] || '';

    return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
  }
});

/**
 * Custom Rule 2: Table conversion
 * Converts HTML tables to Markdown table format
 *
 * Note: This is a basic implementation. Complex tables with colspan/rowspan
 * may not convert perfectly.
 */
turndownService.addRule('table', {
  filter: 'table',
  replacement: (content, node) => {
    const tableNode = node as HTMLElement;

    try {
      const rows: string[][] = [];

      // Extract all rows (from thead and tbody)
      const trElements = tableNode.querySelectorAll('tr');
      trElements.forEach((tr) => {
        const cells: string[] = [];
        const tdElements = tr.querySelectorAll('th, td');
        tdElements.forEach((td) => {
          // Clean cell content (strip HTML tags)
          const cellContent = td.textContent?.trim() || '';
          cells.push(cellContent);
        });
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length === 0) {
        // Fallback: return content as-is
        return content;
      }

      // Build markdown table
      const markdownRows: string[] = [];

      // Header row
      if (rows.length > 0) {
        markdownRows.push('| ' + rows[0].join(' | ') + ' |');

        // Separator row
        const separator = rows[0].map(() => '---').join(' | ');
        markdownRows.push('| ' + separator + ' |');

        // Data rows
        for (let i = 1; i < rows.length; i++) {
          markdownRows.push('| ' + rows[i].join(' | ') + ' |');
        }
      }

      return '\n' + markdownRows.join('\n') + '\n';

    } catch (error) {
      // If table parsing fails, fall back to content
      console.warn('Table conversion failed:', error);
      return content;
    }
  }
});

/**
 * Custom Rule 3: KaTeX Block Math ($$...$$)
 * Extracts LaTeX source from rendered KaTeX display math
 */
turndownService.addRule('mathBlockKatex', {
  filter: (node) => {
    return (
      node.nodeName === 'SPAN' &&
      (node as HTMLElement).classList.contains('katex-display')
    );
  },
  replacement: (_content, node) => {
    const element = node as HTMLElement;
    const annotation = element.querySelector(
      'annotation[encoding="application/x-tex"]'
    );
    const latex = annotation?.textContent || '';
    return latex ? `\n$$${latex}$$\n` : '';
  }
});

/**
 * Custom Rule 4: KaTeX Inline Math ($...$)
 * Extracts LaTeX source from rendered KaTeX inline math
 * Only matches .katex that is NOT inside .katex-display (to avoid double processing)
 */
turndownService.addRule('mathInlineKatex', {
  filter: (node) => {
    if (node.nodeName !== 'SPAN') return false;
    const element = node as HTMLElement;
    // Must have .katex class but NOT be inside .katex-display
    return (
      element.classList.contains('katex') &&
      !element.closest('.katex-display')
    );
  },
  replacement: (_content, node) => {
    const element = node as HTMLElement;
    const annotation = element.querySelector(
      'annotation[encoding="application/x-tex"]'
    );
    const latex = annotation?.textContent || '';
    return latex ? `$${latex}$` : '';
  }
});

/**
 * Convert HTML to Markdown
 *
 * @param html - HTML string to convert
 * @returns Markdown string
 *
 * @example
 * const md = htmlToMarkdown('<p>Hello <strong>world</strong></p>');
 * // Returns: "Hello **world**"
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '') {
    return '';
  }

  try {
    // Preprocess: Clean code blocks from ChatGPT/Grok UI elements
    const cleanedHtml = cleanCodeBlockHtml(html);
    return turndownService.turndown(cleanedHtml);
  } catch (error) {
    console.error('Turndown conversion failed:', error);
    // Fallback: return plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || html;
  }
}
