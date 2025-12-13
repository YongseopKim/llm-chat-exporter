/**
 * Content Script
 * Background Script의 메시지를 받아 대화 내용을 추출
 *
 * Phase 3: Core utilities integrated
 * - Parser Factory (returns null until Phase 4)
 * - Scroller (simplified fallback)
 * - Serializer (JSONL builder)
 * - Converter (HTML→Markdown with Turndown)
 */

import { ParserFactory } from './parsers/factory';
import { scrollToLoadAll } from './scroller';
import { buildJsonl } from './serializer';
import { getPlatformName } from '../utils/background-utils';

interface ExportMessage {
  type: 'EXPORT_CONVERSATION';
}

interface ExportResponse {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Main export function
 * Orchestrates parser, scroller, and serializer
 */
async function exportConversation(): Promise<string> {
  console.log('LLM Chat Exporter: Starting export...');

  // 1. Get parser for current platform
  const parser = ParserFactory.getParser(window.location.href);
  if (!parser) {
    // Phase 3: Parsers not implemented yet
    throw new Error(
      'Platform parser not implemented yet (Phase 4 pending). ' +
      `Current platform: ${getPlatformName(window.location.href)}`
    );
  }

  // 2. Check if response is generating
  if (parser.isGenerating()) {
    throw new Error('Response is still generating. Please wait until it completes.');
  }

  // 3. Load all messages (scroll to ensure all messages are in DOM)
  console.log('LLM Chat Exporter: Loading all messages...');
  await parser.loadAllMessages();

  // 4. Get and parse message nodes
  console.log('LLM Chat Exporter: Parsing messages...');
  const nodes = parser.getMessageNodes();

  // Check for empty conversation
  if (nodes.length === 0) {
    throw new Error(
      'No messages found in this conversation. ' +
      'Please ensure the conversation has at least one message before exporting.'
    );
  }

  const parsedMessages = nodes.map((node) => parser.parseNode(node));

  console.log(`LLM Chat Exporter: Found ${parsedMessages.length} messages`);

  // 5. Build JSONL with metadata
  const title = parser.getTitle();
  const jsonl = buildJsonl(parsedMessages, {
    platform: getPlatformName(window.location.href) as any,
    url: window.location.href,
    exported_at: new Date().toISOString(),
    ...(title && { title })
  });

  console.log('LLM Chat Exporter: Export complete');
  return jsonl;
}

/**
 * Message listener - handles export requests from background script
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExportMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExportResponse) => void
  ) => {
    if (message.type === 'EXPORT_CONVERSATION') {
      console.log('LLM Chat Exporter: Export request received');

      // Execute export asynchronously
      exportConversation()
        .then((jsonl) => {
          sendResponse({ success: true, data: jsonl });
        })
        .catch((error) => {
          console.error('LLM Chat Exporter: Export failed', error);
          sendResponse({
            success: false,
            error: error.message || 'Unknown error occurred'
          });
        });

      // Return true to indicate async response
      return true;
    }
  }
);

console.log('LLM Chat Exporter content script loaded on:', window.location.hostname);
