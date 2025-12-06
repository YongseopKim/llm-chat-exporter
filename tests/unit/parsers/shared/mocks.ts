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

/**
 * Create a mock user message element for Grok
 *
 * @param content - HTML content of the message
 * @returns HTMLElement with Grok user message structure
 */
export function createMockGrokUserMessage(content: string): HTMLElement {
  const dom = new JSDOM(`
    <div class="relative group flex flex-col justify-center w-full">
      <div class="message-bubble relative rounded-3xl text-primary prose">${content}</div>
      <div class="order-first sticky hidden top-1"></div>
      <div class="action-buttons h-8 mt-0.5 flex flex-row flex-wrap">
        <button aria-label="Edit">Edit</button>
        <button aria-label="Copy">Copy</button>
      </div>
      <div></div>
    </div>
  `);
  return dom.window.document.querySelector('.message-bubble') as HTMLElement;
}

/**
 * Create a mock assistant message element for Grok
 *
 * @param content - HTML content of the message
 * @returns HTMLElement with Grok assistant message structure
 */
export function createMockGrokAssistantMessage(content: string): HTMLElement {
  const dom = new JSDOM(`
    <div class="relative group flex flex-col justify-center w-full">
      <div class="message-bubble relative rounded-3xl text-primary prose">${content}</div>
      <div class="order-first sticky hidden top-1"></div>
      <div class="action-buttons h-8 mt-0.5 flex flex-row flex-wrap">
        <button aria-label="Regenerate">Regenerate</button>
        <button aria-label="Read Aloud">Read</button>
        <button aria-label="Start thread">Thread</button>
        <button aria-label="Copy">Copy</button>
        <button aria-label="Share link">Share</button>
        <button aria-label="Like">Like</button>
        <button aria-label="Dislike">Dislike</button>
        <button aria-label="More actions">More</button>
      </div>
      <div></div>
    </div>
  `);
  return dom.window.document.querySelector('.message-bubble') as HTMLElement;
}
