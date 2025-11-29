# Selector Configuration Guide

This directory contains the CSS selectors used to parse chat messages from each platform.

## Quick Start

When a platform updates their UI and the extension breaks:

1. Open the platform in browser
2. Use DevTools (F12) to find new selectors
3. Update `selectors.json`
4. Run `npm run validate:selectors` to verify
5. Run `npm test` to ensure tests pass
6. Test manually on the actual site

## File Structure

```
config/
├── selectors.json    # Main configuration file
└── README.md         # This file
```

## Configuration Structure

### selectors.json

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-11-29",
  "platforms": {
    "chatgpt": { ... },
    "claude": { ... },
    "gemini": { ... }
  }
}
```

### Platform Configuration

Each platform has:

| Field | Description |
|-------|-------------|
| `hostname` | Domain pattern to match (e.g., `chatgpt.com`) |
| `selectors.messages` | How to find message elements |
| `selectors.content` | Where to find message text by role |
| `selectors.generation` | How to detect if AI is still responding |
| `selectors.role` | How to determine user vs assistant |

## Role Detection Strategies

### 1. Attribute Strategy (ChatGPT)

Reads role from data attributes:

```json
"role": {
  "strategy": "attribute",
  "attributes": ["data-message-author-role", "data-turn"]
}
```

### 2. Hybrid Strategy (Claude)

Checks multiple attributes with priority:

```json
"role": {
  "strategy": "hybrid",
  "userTestId": "user-message",
  "assistantTestId": "assistant-message",
  "streamingAttribute": "data-is-streaming"
}
```

### 3. Tag Name Strategy (Gemini)

Uses custom element tag names:

```json
"role": {
  "strategy": "tagname",
  "userTag": "user-query",
  "assistantTag": "model-response"
}
```

## Updating Selectors

### Step 1: Find New Selectors

1. Open the platform (e.g., chatgpt.com)
2. Open DevTools (F12) → Elements tab
3. Inspect message elements
4. Look for stable attributes:
   - `data-*` attributes (most stable)
   - `aria-*` attributes
   - Custom element tag names
   - Avoid class names (change frequently)

### Step 2: Update Configuration

Edit `selectors.json`:

```json
{
  "platforms": {
    "chatgpt": {
      "selectors": {
        "messages": {
          "primary": "[new-selector]",
          "fallbacks": ["[old-selector]"]
        }
      }
    }
  }
}
```

**Tip**: Keep old selectors as fallbacks for gradual migration.

### Step 3: Validate

```bash
npm run validate:selectors
```

### Step 4: Test

```bash
npm test
npm run build
```

### Step 5: Manual Test

1. Load extension in Chrome
2. Go to the platform
3. Press Ctrl+Shift+E to export
4. Verify JSONL file is correct

## Troubleshooting

### Common Issues

**No messages found**
- Check if `messages.primary` or `messages.combined` selector is correct
- Verify in DevTools console: `document.querySelectorAll('your-selector')`

**Wrong role detected**
- Check role configuration matches DOM structure
- For `attribute`: verify attribute name and values
- For `hybrid`: verify testId and streaming attribute
- For `tagname`: verify tag names are lowercase

**Empty content**
- Check `content.user` and `content.assistant` selectors
- Content element must be inside the message element

**Generation not detected**
- Check `generation` selector
- For button: verify aria-label
- For attribute: verify attribute and value

### Debug Tips

Test selectors in DevTools console:

```javascript
// Check message count
document.querySelectorAll('[data-message-author-role]').length

// Check role attribute
document.querySelector('[data-message-author-role]').getAttribute('data-message-author-role')

// Check content element
document.querySelector('[data-message-author-role] .markdown')
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-29 | Initial configuration-driven architecture |

## Related Files

- `/src/content/parsers/base-parser.ts` - Base class using this config
- `/src/content/parsers/config-loader.ts` - Configuration loader
- `/src/content/parsers/config-types.ts` - TypeScript types
- `/scripts/validate-selectors.js` - Validation script
