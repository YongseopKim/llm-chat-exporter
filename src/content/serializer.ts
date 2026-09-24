/**
 * JSONL Serializer
 *
 * Converts parsed messages to JSONL (JSON Lines) format for export.
 * Each line is a valid JSON object representing either metadata or a message.
 *
 * JSONL Format:
 * Line 1: Metadata object with _meta: true
 * Line 2-N: Message objects with role, content, timestamp
 */

import { htmlToMarkdown, inlineImages } from './converter';
import type { ParsedMessage, ExportMetadata, ExportedMessage, ArtifactData } from './parsers/interface';

/**
 * Build JSONL string from parsed messages and metadata
 *
 * @param parsedMessages - Messages with HTML content (converted here) or
 *   Markdown content (written verbatim)
 * @param metadata - Export metadata (platform, URL, title, etc.)
 * @returns Promise resolving to the JSONL string with metadata line + message lines
 *
 * @example
 * const jsonl = await buildJsonl(messages, {
 *   platform: 'chatgpt',
 *   url: 'https://chatgpt.com/c/123',
 *   exported_at: '2025-11-29T10:00:00Z'
 * });
 * // Returns:
 * // {"_meta":true,"platform":"chatgpt","url":"...","exported_at":"..."}
 * // {"role":"user","content":"...","timestamp":"..."}
 * // {"role":"assistant","content":"...","timestamp":"..."}
 */
export async function buildJsonl(
  parsedMessages: ParsedMessage[],
  metadata: ExportMetadata,
  artifact?: ArtifactData | null
): Promise<string> {
  // Line 1: Metadata
  const metaLine = JSON.stringify({
    _meta: true,
    ...metadata
  });

  // Lines 2-N: Messages
  const messageLines = await Promise.all(
    parsedMessages.map(async (pm) => {
      const message: ExportedMessage = {
        role: pm.role,
        content: pm.contentMarkdown ?? htmlToMarkdown(await inlineImages(pm.contentHtml ?? '')),
        timestamp: pm.timestamp || new Date().toISOString()
      };
      return JSON.stringify(message);
    })
  );

  const lines = [metaLine, ...messageLines];

  // Optional artifact line (Claude only)
  if (artifact) {
    lines.push(JSON.stringify({ _artifact: true, ...artifact }));
  }

  // Combine all lines with newline separator
  return lines.join('\n');
}
