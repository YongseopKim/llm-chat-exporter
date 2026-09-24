/**
 * Content Script
 * Background Script의 메시지를 받아 대화 내용을 추출
 */

import { ParserFactory } from './parsers/factory';
import { buildJsonl } from './serializer';
import { getPlatformName } from '../utils/background-utils';
import { exportMessageType, pingMessageType, type ExportResponse } from '../content-script-loader';
import type { ExportMetadata } from './parsers/interface';

declare const __LLM_CHAT_EXPORTER_BUILD_ID__: string;

interface ExportMessage {
  type: 'EXPORT_CONVERSATION';
}

interface PingMessage {
  type: 'PING_EXPORTER';
}

type ContentMessage = ExportMessage | PingMessage;

declare global {
  interface Window {
    __llmChatExporterListenerInstalled__?: boolean;
    __llmChatExporterBuilds__?: Set<string>;
  }
}

/**
 * Main export function
 * Reads the conversation through the platform's parser and serializes it
 */
async function exportConversation(): Promise<ExportResponse> {
  console.log('LLM Chat Exporter: Starting export...');

  const parser = ParserFactory.getParser(window.location.href);
  if (!parser) {
    throw new Error(
      `No parser for this platform: ${getPlatformName(window.location.href)}`
    );
  }

  if (parser.isGenerating()) {
    throw new Error('Response is still generating. Please wait until it completes.');
  }

  const conversation = await parser.readConversation();

  if (conversation.messages.length === 0) {
    throw new Error(
      'No messages found in this conversation. ' +
      'Please ensure the conversation has at least one message before exporting.'
    );
  }

  console.log(`LLM Chat Exporter: Found ${conversation.messages.length} messages`);
  for (const warning of conversation.warnings) {
    console.warn(`LLM Chat Exporter: ${warning}`);
  }

  const jsonl = await buildJsonl(conversation.messages, {
    platform: getPlatformName(window.location.href) as ExportMetadata['platform'],
    url: window.location.href,
    exported_at: new Date().toISOString(),
    ...(conversation.title && { title: conversation.title }),
    ...(conversation.project && { project: conversation.project }),
    ...(conversation.warnings.length > 0 && { warnings: conversation.warnings }),
  }, conversation.artifact);

  console.log('LLM Chat Exporter: Export complete');
  return {
    success: true,
    data: jsonl,
    messageCount: conversation.messages.length,
    warnings: conversation.warnings,
  };
}

/**
 * Message listener - handles export requests from background script
 */
window.__llmChatExporterBuilds__ ??= new Set<string>();

if (!window.__llmChatExporterBuilds__.has(__LLM_CHAT_EXPORTER_BUILD_ID__)) {
  window.__llmChatExporterBuilds__.add(__LLM_CHAT_EXPORTER_BUILD_ID__);
  window.__llmChatExporterListenerInstalled__ = true;
  const currentPingType = pingMessageType(__LLM_CHAT_EXPORTER_BUILD_ID__);
  const currentExportType = exportMessageType(__LLM_CHAT_EXPORTER_BUILD_ID__);
  chrome.runtime.onMessage.addListener(
    (
      message: ContentMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExportResponse) => void
    ) => {
      if (message.type === currentPingType || message.type === 'PING_EXPORTER') {
        sendResponse({ success: true });
        return false;
      }

      if (message.type === currentExportType || message.type === 'EXPORT_CONVERSATION') {
        console.log('LLM Chat Exporter: Export request received');

        exportConversation()
          .then(sendResponse)
          .catch((error) => {
            console.error('LLM Chat Exporter: Export failed', error);
            sendResponse({
              success: false,
              error: error.message || 'Unknown error occurred'
            });
          });

        return true;
      }
    }
  );
}

console.log('LLM Chat Exporter content script loaded on:', window.location.hostname);
