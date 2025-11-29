/**
 * Mock DOM Elements for Parser Testing
 *
 * Utilities for creating mock DOM nodes for edge case testing.
 */

import { JSDOM } from 'jsdom';

/**
 * Create a mock user message element for ChatGPT
 *
 * @param content - HTML content of the message
 * @returns HTMLElement with ChatGPT user message structure
 */
export function createMockChatGPTUserMessage(content: string): HTMLElement {
  const dom = new JSDOM(`
    <article data-message-author-role="user" data-turn="user">
      <div class="whitespace-pre-wrap">${content}</div>
    </article>
  `);
  return dom.window.document.querySelector('article') as HTMLElement;
}

/**
 * Create a mock assistant message element for ChatGPT
 *
 * @param content - HTML content of the message
 * @returns HTMLElement with ChatGPT assistant message structure
 */
export function createMockChatGPTAssistantMessage(content: string): HTMLElement {
  const dom = new JSDOM(`
    <article data-message-author-role="assistant" data-turn="assistant">
      <div class="markdown prose">${content}</div>
    </article>
  `);
  return dom.window.document.querySelector('article') as HTMLElement;
}

/**
 * Create a mock generating indicator button for ChatGPT
 *
 * @returns HTMLElement representing "Stop generating" button
 */
export function createMockGeneratingButton(): HTMLElement {
  const dom = new JSDOM(`
    <button aria-label="Stop generating">Stop</button>
  `);
  return dom.window.document.querySelector('button') as HTMLElement;
}

/**
 * Create a mock title element
 *
 * @param title - Title text
 * @returns HTMLElement with title
 */
export function createMockTitle(title: string): HTMLElement {
  const dom = new JSDOM(`<h1>${title}</h1>`);
  return dom.window.document.querySelector('h1') as HTMLElement;
}

/**
 * Create a mock empty content element
 *
 * @returns HTMLElement with empty content
 */
export function createMockEmptyMessage(): HTMLElement {
  const dom = new JSDOM(`
    <article data-message-author-role="user" data-turn="user">
      <div class="whitespace-pre-wrap"></div>
    </article>
  `);
  return dom.window.document.querySelector('article') as HTMLElement;
}

/**
 * Create a mock message with code block
 *
 * @param code - Code content
 * @param language - Programming language
 * @returns HTMLElement with code block
 */
export function createMockMessageWithCode(code: string, language: string = 'python'): HTMLElement {
  const dom = new JSDOM(`
    <article data-message-author-role="assistant" data-turn="assistant">
      <div class="markdown prose">
        <pre><code class="language-${language}">${code}</code></pre>
      </div>
    </article>
  `);
  return dom.window.document.querySelector('article') as HTMLElement;
}

/**
 * Create a mock message with table
 *
 * @param tableHTML - Table HTML content
 * @returns HTMLElement with table
 */
export function createMockMessageWithTable(tableHTML: string): HTMLElement {
  const dom = new JSDOM(`
    <article data-message-author-role="assistant" data-turn="assistant">
      <div class="markdown prose">
        ${tableHTML}
      </div>
    </article>
  `);
  return dom.window.document.querySelector('article') as HTMLElement;
}
