/**
 * Configuration Loader
 *
 * Singleton class for loading and accessing selector configuration.
 * Loads selectors from external JSON file and provides type-safe access.
 */

import type {
  SelectorConfig,
  PlatformConfig,
  PlatformSelectors,
  PlatformKey,
} from './config-types';

// Import JSON configuration (esbuild bundles this)
import selectorsJson from '../../../config/selectors.json';

/**
 * Singleton configuration loader
 *
 * Provides centralized access to selector configuration with validation.
 * Uses lazy initialization and caching for performance.
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: SelectorConfig;

  private constructor() {
    this.config = selectorsJson as SelectorConfig;
    this.validateConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Reset singleton instance (for testing purposes)
   */
  static resetInstance(): void {
    ConfigLoader.instance = undefined as unknown as ConfigLoader;
  }

  /**
   * Get full configuration
   */
  getConfig(): SelectorConfig {
    return this.config;
  }

  /**
   * Get platform configuration
   */
  getPlatformConfig(platform: PlatformKey): PlatformConfig {
    const config = this.config.platforms[platform];
    if (!config) {
      throw new Error(`ConfigLoader: Unknown platform '${platform}'`);
    }
    return config;
  }

  /**
   * Get selectors for a platform
   */
  getSelectors(platform: PlatformKey): PlatformSelectors {
    return this.getPlatformConfig(platform).selectors;
  }

  /**
   * Get hostname for a platform
   */
  getHostname(platform: PlatformKey): string {
    return this.getPlatformConfig(platform).hostname;
  }

  /**
   * Validate configuration on load
   */
  private validateConfig(): void {
    const requiredPlatforms: PlatformKey[] = ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity'];

    for (const platform of requiredPlatforms) {
      const config = this.config.platforms[platform];

      if (!config) {
        throw new Error(`ConfigLoader: Missing configuration for '${platform}'`);
      }

      if (!config.hostname) {
        throw new Error(`ConfigLoader: Missing hostname for '${platform}'`);
      }

      if (!config.selectors) {
        throw new Error(`ConfigLoader: Missing selectors for '${platform}'`);
      }

      const { selectors } = config;

      // Validate messages config
      if (!selectors.messages) {
        throw new Error(`ConfigLoader: Missing messages config for '${platform}'`);
      }

      if (!selectors.messages.primary && !selectors.messages.combined) {
        throw new Error(
          `ConfigLoader: Missing primary or combined message selector for '${platform}'`
        );
      }

      // Validate content selectors
      if (!selectors.content?.user || !selectors.content?.assistant) {
        throw new Error(`ConfigLoader: Missing content selectors for '${platform}'`);
      }

      // Validate generation selector (can be empty string for platforms that don't need it)
      if (selectors.generation === undefined || selectors.generation === null) {
        throw new Error(`ConfigLoader: Missing generation selector for '${platform}'`);
      }

      // Validate role config
      if (!selectors.role?.strategy) {
        throw new Error(`ConfigLoader: Missing role strategy for '${platform}'`);
      }

      // Strategy-specific validation
      this.validateRoleConfig(platform, selectors.role);
    }
  }

  /**
   * Validate role configuration based on strategy
   */
  private validateRoleConfig(
    platform: PlatformKey,
    role: PlatformSelectors['role']
  ): void {
    switch (role.strategy) {
      case 'attribute':
        if (!role.attributes || role.attributes.length === 0) {
          throw new Error(
            `ConfigLoader: Missing attributes for 'attribute' strategy in '${platform}'`
          );
        }
        break;

      case 'hybrid':
        if (!role.userTestId || !role.streamingAttribute) {
          throw new Error(
            `ConfigLoader: Missing userTestId or streamingAttribute for 'hybrid' strategy in '${platform}'`
          );
        }
        break;

      case 'tagname':
        if (!role.userTag || !role.assistantTag) {
          throw new Error(
            `ConfigLoader: Missing userTag or assistantTag for 'tagname' strategy in '${platform}'`
          );
        }
        break;

      case 'sibling-button':
        if (!role.userMarker || !role.assistantMarker) {
          throw new Error(
            `ConfigLoader: Missing userMarker or assistantMarker for 'sibling-button' strategy in '${platform}'`
          );
        }
        break;

      case 'combined-selector':
        if (!role.userSelector || !role.assistantSelector) {
          throw new Error(
            `ConfigLoader: Missing userSelector or assistantSelector for 'combined-selector' strategy in '${platform}'`
          );
        }
        break;

      default:
        throw new Error(
          `ConfigLoader: Unknown role strategy '${role.strategy}' in '${platform}'`
        );
    }
  }
}
