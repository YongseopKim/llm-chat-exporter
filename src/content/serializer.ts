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

import { htmlToMarkdown } from './converter';
import type { ParsedMessage, ExportMetadata, ExportedMessage, ArtifactData } from './parsers/interface';

/**
 * Build JSONL string from parsed messages and metadata
 *
 * @param parsedMessages - Array of messages with HTML content
 * @param metadata - Export metadata (platform, URL, title, etc.)
 * @returns JSONL string with metadata line + message lines
 *
 * @example
 * const jsonl = buildJsonl(messages, {
 *   platform: 'chatgpt',
 *   url: 'https://chatgpt.com/c/123',
 *   exported_at: '2025-11-29T10:00:00Z'
 * });
 * // Returns:
 * // {"_meta":true,"platform":"chatgpt","url":"...","exported_at":"..."}
 * // {"role":"user","content":"...","timestamp":"..."}
 * // {"role":"assistant","content":"...","timestamp":"..."}
 */
export function buildJsonl(
  parsedMessages: ParsedMessage[],
  metadata: ExportMetadata,
  artifact?: ArtifactData | null
): string {
  // Line 1: Metadata
  const metaLine = JSON.stringify({
    _meta: true,
    ...metadata
  });

  // Lines 2-N: Messages
  const messageLines = parsedMessages.map((pm) => {
    const message: ExportedMessage = {
      role: pm.role,
      content: htmlToMarkdown(pm.contentHtml),
      timestamp: pm.timestamp || new Date().toISOString()
    };
    return JSON.stringify(message);
  });

  const lines = [metaLine, ...messageLines];

  // Optional artifact line (Claude only)
  if (artifact) {
    const artifactLine = JSON.stringify({
      _artifact: true,
      title: artifact.title,
      version: artifact.version,
      content: htmlToMarkdown(artifact.contentHtml)
    });
    lines.push(artifactLine);
  }

  // Combine all lines with newline separator
  return lines.join('\n');
}
