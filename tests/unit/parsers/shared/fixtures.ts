/**
 * Test Fixtures for Parser Testing
 *
 * Utilities for loading sample HTML files and creating DOM structures for testing.
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

/**
 * Load sample HTML file content
 *
 * @param platform - Platform name (chatgpt, claude, gemini)
 * @returns HTML string content
 */
export function loadSampleHTML(platform: 'chatgpt' | 'claude' | 'gemini'): string {
  const samplePath = path.join(__dirname, '../../../../samples', `${platform}.html`);

  if (!fs.existsSync(samplePath)) {
    throw new Error(`Sample file not found: ${samplePath}`);
  }

  return fs.readFileSync(samplePath, 'utf-8');
}

/**
 * Create a JSDOM Document from HTML string
 *
 * @param html - HTML string
 * @returns Document object for testing
 */
export function createDOMFromHTML(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

/**
 * Get message count from sample HTML (for validation)
 *
 * @param platform - Platform name
 * @param selector - CSS selector to count messages
 * @returns Number of messages found
 */
export function getMessageCount(platform: 'chatgpt' | 'claude' | 'gemini', selector: string): number {
  const html = loadSampleHTML(platform);
  const doc = createDOMFromHTML(html);
  return doc.querySelectorAll(selector).length;
}
