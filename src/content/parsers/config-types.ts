/**
 * Configuration Types for Selector Configuration
 *
 * Defines TypeScript types for the external selector configuration system.
 * These types ensure type safety when loading and using selectors from JSON.
 */

/**
 * Role extraction strategy types
 * - attribute: Read role from data attributes (ChatGPT)
 * - hybrid: Check multiple attributes with priority (Claude)
 * - tagname: Determine role from element tag name (Gemini)
 * - sibling-button: Determine role from sibling button aria-label (Grok)
 */
export type RoleStrategy = 'attribute' | 'hybrid' | 'tagname' | 'sibling-button';

/**
 * Message selector configuration
 */
export interface MessageSelectors {
  /** Primary selector to try first */
  primary?: string;
  /** Fallback selectors to try if primary fails */
  fallbacks?: string[];
  /** Combined selector (alternative to primary+fallbacks) */
  combined?: string;
}

/**
 * Content selectors by role
 */
export interface ContentSelectors {
  /** Selector for user message content */
  user: string;
  /** Selector for assistant message content */
  assistant: string;
}

/**
 * Role extraction configuration
 */
export interface RoleConfig {
  /** Strategy for extracting role from message nodes */
  strategy: RoleStrategy;

  // For 'attribute' strategy (ChatGPT)
  /** Attribute names to check for role value */
  attributes?: string[];

  // For 'hybrid' strategy (Claude)
  /** data-testid value indicating user message */
  userTestId?: string;
  /** data-testid value indicating assistant message */
  assistantTestId?: string;
  /** Attribute whose presence indicates assistant message */
  streamingAttribute?: string;

  // For 'tagname' strategy (Gemini)
  /** Tag name for user messages */
  userTag?: string;
  /** Tag name for assistant messages */
  assistantTag?: string;

  // For 'sibling-button' strategy (Grok)
  /** Selector for button indicating user message */
  userMarker?: string;
  /** Selector for button indicating assistant message */
  assistantMarker?: string;
}

/**
 * Complete selector configuration for a platform
 */
export interface PlatformSelectors {
  /** Message node detection */
  messages: MessageSelectors;
  /** Content extraction by role */
  content: ContentSelectors;
  /** Selector for detecting active generation */
  generation: string;
  /** Role extraction configuration */
  role: RoleConfig;
}

/**
 * Platform configuration
 */
export interface PlatformConfig {
  /** Hostname pattern for this platform */
  hostname: string;
  /** Selector configuration */
  selectors: PlatformSelectors;
}

/**
 * Root configuration structure
 */
export interface SelectorConfig {
  /** Configuration version */
  version: string;
  /** Last update date (ISO 8601) */
  lastUpdated: string;
  /** Platform configurations */
  platforms: {
    chatgpt: PlatformConfig;
    claude: PlatformConfig;
    gemini: PlatformConfig;
    grok: PlatformConfig;
  };
}

/**
 * Platform key type
 */
export type PlatformKey = 'chatgpt' | 'claude' | 'gemini' | 'grok';
