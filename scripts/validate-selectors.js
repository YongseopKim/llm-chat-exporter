#!/usr/bin/env node

/**
 * Selector Configuration Validator
 *
 * Validates the selectors.json configuration file for completeness and correctness.
 * Run with: npm run validate:selectors
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'selectors.json');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function header(msg) {
  console.log(`\n${colors.bold}${msg}${colors.reset}`);
}

/**
 * Load and parse configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Validate platform configuration
 */
function validatePlatform(name, config) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!config.hostname) {
    errors.push(`Missing 'hostname' for ${name}`);
  }

  if (!config.selectors) {
    errors.push(`Missing 'selectors' for ${name}`);
    return { errors, warnings };
  }

  const { selectors } = config;

  // Validate messages config
  if (!selectors.messages) {
    errors.push(`Missing 'selectors.messages' for ${name}`);
  } else {
    if (!selectors.messages.primary && !selectors.messages.combined) {
      errors.push(`Missing 'primary' or 'combined' message selector for ${name}`);
    }
  }

  // Validate content selectors
  if (!selectors.content) {
    errors.push(`Missing 'selectors.content' for ${name}`);
  } else {
    if (!selectors.content.user) {
      errors.push(`Missing 'content.user' selector for ${name}`);
    }
    if (!selectors.content.assistant) {
      errors.push(`Missing 'content.assistant' selector for ${name}`);
    }
  }

  // Validate generation selector
  if (!selectors.generation) {
    errors.push(`Missing 'selectors.generation' for ${name}`);
  }

  // Validate role config
  if (!selectors.role) {
    errors.push(`Missing 'selectors.role' for ${name}`);
  } else {
    if (!selectors.role.strategy) {
      errors.push(`Missing 'role.strategy' for ${name}`);
    } else {
      // Strategy-specific validation
      switch (selectors.role.strategy) {
        case 'attribute':
          if (!selectors.role.attributes || selectors.role.attributes.length === 0) {
            errors.push(`Missing 'role.attributes' for attribute strategy in ${name}`);
          }
          break;
        case 'hybrid':
          if (!selectors.role.userTestId) {
            errors.push(`Missing 'role.userTestId' for hybrid strategy in ${name}`);
          }
          if (!selectors.role.streamingAttribute) {
            errors.push(`Missing 'role.streamingAttribute' for hybrid strategy in ${name}`);
          }
          break;
        case 'tagname':
          if (!selectors.role.userTag) {
            errors.push(`Missing 'role.userTag' for tagname strategy in ${name}`);
          }
          if (!selectors.role.assistantTag) {
            errors.push(`Missing 'role.assistantTag' for tagname strategy in ${name}`);
          }
          break;
        default:
          errors.push(`Unknown role strategy '${selectors.role.strategy}' in ${name}`);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
function validate() {
  console.log(`${colors.bold}Selector Configuration Validator${colors.reset}`);
  console.log(`Config file: ${CONFIG_PATH}\n`);

  let totalErrors = 0;
  let totalWarnings = 0;

  try {
    const config = loadConfig();
    success('Config file loaded successfully');

    // Check version
    if (config.version) {
      success(`Version: ${config.version}`);
    } else {
      warn('Missing version field');
      totalWarnings++;
    }

    // Check lastUpdated
    if (config.lastUpdated) {
      success(`Last updated: ${config.lastUpdated}`);
    } else {
      warn('Missing lastUpdated field');
      totalWarnings++;
    }

    // Validate required platforms
    const requiredPlatforms = ['chatgpt', 'claude', 'gemini'];

    header('Platform Validation');

    for (const platform of requiredPlatforms) {
      if (!config.platforms || !config.platforms[platform]) {
        error(`Missing platform configuration: ${platform}`);
        totalErrors++;
        continue;
      }

      const { errors, warnings } = validatePlatform(platform, config.platforms[platform]);

      if (errors.length === 0) {
        success(`${platform}: All required fields present`);
        console.log(`   Hostname: ${config.platforms[platform].hostname}`);
        console.log(`   Strategy: ${config.platforms[platform].selectors.role.strategy}`);
      } else {
        error(`${platform}: ${errors.length} error(s)`);
        errors.forEach((e) => console.log(`   - ${e}`));
        totalErrors += errors.length;
      }

      if (warnings.length > 0) {
        warnings.forEach((w) => warn(`   ${w}`));
        totalWarnings += warnings.length;
      }
    }

    // Summary
    header('Summary');
    console.log(`Platforms: ${requiredPlatforms.length}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Warnings: ${totalWarnings}`);

    if (totalErrors === 0) {
      console.log(`\n${colors.green}${colors.bold}✓ Validation passed!${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}${colors.bold}✗ Validation failed with ${totalErrors} error(s)${colors.reset}`);
      process.exit(1);
    }
  } catch (err) {
    error(`Failed to validate: ${err.message}`);
    process.exit(1);
  }
}

// Run validation
validate();
