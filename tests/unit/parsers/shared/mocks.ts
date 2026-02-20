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
 * Create a mock user message element for Grok with Korean locale
 *
 * In Korean locale, "Edit" button becomes "편집"
 *
 * @param content - HTML content of the message
 * @returns HTMLElement with Grok user message structure (Korean locale)
 */
export function createMockGrokUserMessageKorean(content: string): HTMLElement {
  const dom = new JSDOM(`
    <div class="relative group flex flex-col justify-center w-full">
      <div class="message-bubble relative rounded-3xl text-primary prose">${content}</div>
      <div class="order-first sticky hidden top-1"></div>
      <div class="action-buttons h-8 mt-0.5 flex flex-row flex-wrap">
        <button aria-label="편집">편집</button>
        <button aria-label="복사">복사</button>
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

/**
 * Create a mock Grok assistant message with rendered Mermaid SVG
 *
 * This simulates Grok's native Mermaid rendering where the source code
 * is replaced with an SVG, but a "원본 보기" button is available.
 *
 * @param mermaidSource - Original Mermaid source code
 * @returns HTMLElement with rendered Mermaid structure
 */
export function createMockGrokMermaidRendered(mermaidSource: string): HTMLElement {
  const dom = new JSDOM(`
    <div class="relative group flex flex-col justify-center w-full">
      <div class="message-bubble relative rounded-3xl text-primary prose">
        <p>Here is a diagram:</p>
        <div dir="auto" class="not-prose">
          <div class="group/mermaid w-full relative bg-surface-l1 rounded-xl overflow-hidden border border-border p-4">
            <div class="mermaid flex flex-col items-center">
              <svg aria-roledescription="flowchart-v2" role="graphics-document document" viewBox="0 0 500 300">
                <text>Rendered SVG</text>
              </svg>
            </div>
            <div class="absolute top-2 right-2 flex flex-row gap-1">
              <button type="button" aria-label="원본 보기" data-mermaid-source="${mermaidSource.replace(/"/g, '&quot;')}">
                <svg width="16" height="16"></svg>
              </button>
              <button type="button" aria-label="다운로드">
                <svg width="16" height="16"></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="action-buttons h-8 mt-0.5 flex flex-row flex-wrap">
        <button aria-label="Regenerate">Regenerate</button>
      </div>
    </div>
  `);
  return dom.window.document.querySelector('.message-bubble') as HTMLElement;
}

/**
 * Create a mock Grok code block (after clicking "원본 보기")
 *
 * @param code - Code content
 * @param language - Language identifier
 * @returns HTMLElement with Grok code block structure
 */
export function createMockGrokCodeBlock(code: string, language: string = 'mermaid'): HTMLElement {
  const dom = new JSDOM(`
    <div class="relative group flex flex-col justify-center w-full">
      <div class="message-bubble relative rounded-3xl text-primary prose">
        <p>Here is a diagram:</p>
        <div data-testid="code-block">
          <div class="flex flex-row px-4 py-2 h-10 items-center">
            <span class="font-mono text-xs text-secondary">${language}</span>
          </div>
          <div class="shiki not-prose">
            <pre class="shiki"><code><span class="line"><span>${code}</span></span></code></pre>
          </div>
        </div>
      </div>
      <div class="action-buttons h-8 mt-0.5 flex flex-row flex-wrap">
        <button aria-label="Regenerate">Regenerate</button>
      </div>
    </div>
  `);
  return dom.window.document.querySelector('.message-bubble') as HTMLElement;
}

/**
 * Create a mock user message element for Perplexity
 *
 * @param content - Plain text content of the query
 * @returns HTMLElement with Perplexity user query structure (h1.group/query)
 */
export function createMockPerplexityUserMessage(content: string): HTMLElement {
  const dom = new JSDOM(`
    <div>
      <h1 class="group/query mb-lg text-3xl font-display">
        <span class="select-text whitespace-pre-line break-words">${content}</span>
      </h1>
    </div>
  `);
  return dom.window.document.querySelector('h1') as HTMLElement;
}

/**
 * Create a mock assistant message element for Perplexity
 *
 * @param content - HTML content of the response
 * @param index - Message index (used for id attribute)
 * @returns HTMLElement with Perplexity assistant response structure
 */
export function createMockPerplexityAssistantMessage(content: string, index: number = 0): HTMLElement {
  const dom = new JSDOM(`
    <div>
      <div id="markdown-content-${index}" class="relative default font-sans text-base">
        <div class="prose dark:prose-invert inline leading-normal break-words min-w-0">
          ${content}
        </div>
      </div>
    </div>
  `);
  return dom.window.document.querySelector('div[id^="markdown-content-"]') as HTMLElement;
}
