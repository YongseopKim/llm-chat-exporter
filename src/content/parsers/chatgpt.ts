/**
 * ChatGPT Parser
 *
 * Implements ChatParser interface for chatgpt.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: [data-message-author-role] or [data-turn]
 * - User content: .whitespace-pre-wrap
 * - Assistant content: .markdown
 * - Generating: button[aria-label*="Stop"]
 *
 * Role Strategy: attribute (data-message-author-role, data-turn)
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';
import type { ProjectInfo } from './interface';

/**
 * Matches ChatGPT project chat URLs. The trailing name slug is optional —
 * both /g/g-p-<hash>-<slug>/c/<uuid> and /g/g-p-<hash>/c/<uuid> occur in
 * practice (the latter is what the app serves when navigating in-app).
 */
const PROJECT_PATH_PATTERN = /^\/g\/(g-p-[0-9a-f]+)(?:-([^/]+))?\//;

/**
 * ChatGPT platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * All parsing logic is inherited from BaseParser with chatgpt configuration.
 */
export class ChatGPTParser extends BaseParser {
  constructor() {
    super('chatgpt');
  }

  /**
   * Get project info for the current conversation
   *
   * ChatGPT project chats live under /g/g-p-<hash>/c/<uuid> (optionally with
   * a -<slug> after the hash), unlike regular chats (/c/<uuid>). The project
   * id comes from the URL. The exact display name isn't exposed anywhere in
   * the DOM (sidebar project entries are buttons with no href), so it's read
   * from document.title, which the app renders as "{ProjectName} -
   * {ChatTitle}" once hydrated. If the title hasn't updated yet, falls back
   * to the URL slug (lossy, ASCII-only) or finally the id itself.
   *
   * @returns ProjectInfo if this conversation belongs to a project, null otherwise
   */
  getProjectInfo(): ProjectInfo | null {
    const match = document.location.pathname.match(PROJECT_PATH_PATTERN);
    if (!match) {
      return null;
    }

    const [, id, slug] = match;
    const separatorIndex = document.title.indexOf(' - ');
    const name =
      separatorIndex > 0 ? document.title.slice(0, separatorIndex).trim() : slug || id;

    return { id, name };
  }
}
