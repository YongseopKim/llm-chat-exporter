/**
 * HTML to Markdown Converter
 *
 * Uses Turndown library to convert LLM conversation HTML to Markdown.
 * Includes custom rules for code blocks, tables, and complex structures.
 *
 * Based on validation results (78% success rate):
 * - Code blocks: ✅ Works with language preservation
 * - Lists: ✅ Works with nesting
 * - Emphasis: ✅ Works
 * - Links: ✅ Works
 * - Tables: ❌ Needs custom rule
 * - Complex HTML: ⚠️ May need improvement
 */

import TurndownService from 'turndown';

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
    return turndownService.turndown(html);
  } catch (error) {
    console.error('Turndown conversion failed:', error);
    // Fallback: return plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || html;
  }
}
