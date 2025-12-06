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
 * @param platform - Platform name (chatgpt, claude, gemini, grok)
 * @returns HTML string content
 */
export function loadSampleHTML(platform: 'chatgpt' | 'claude' | 'gemini' | 'grok'): string {
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
 * Load edge case sample HTML file
 *
 * @param platform - Platform name (chatgpt, claude, gemini, grok)
 * @param caseId - Edge case identifier (e.g., '000', '001')
 * @returns HTML string content
 */
export function loadEdgeCaseHTML(platform: 'chatgpt' | 'claude' | 'gemini' | 'grok', caseId: string): string {
  const samplePath = path.join(__dirname, '../../../../samples/edges', `${platform}_${caseId}.html`);

  if (!fs.existsSync(samplePath)) {
    throw new Error(`Edge case sample file not found: ${samplePath}`);
  }

  return fs.readFileSync(samplePath, 'utf-8');
}

/**
 * Get message count from sample HTML (for validation)
 *
 * @param platform - Platform name
 * @param selector - CSS selector to count messages
 * @returns Number of messages found
 */
export function getMessageCount(platform: 'chatgpt' | 'claude' | 'gemini' | 'grok', selector: string): number {
  const html = loadSampleHTML(platform);
  const doc = createDOMFromHTML(html);
  return doc.querySelectorAll(selector).length;
}
