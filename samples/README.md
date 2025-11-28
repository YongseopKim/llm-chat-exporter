# Sample HTML Files

This directory contains sample HTML snapshots from each platform (ChatGPT, Claude, Gemini), each representing **one user question and one assistant response**. These samples are used for DOM selector validation during Phase 1 development.

## Files

- `chatgpt.html`: ChatGPT conversation sample (59KB)
- `claude.html`: Claude conversation sample (61KB)
- `gemini.html`: Gemini conversation sample (57KB)

## Token-Efficient Analysis Methodology

### Problem
HTML files are large (57-61KB each). Reading entire files would consume excessive tokens during AI-assisted development.

### Solution: Pattern Extraction with Grep
Instead of reading full HTML, use **Grep** to extract only relevant patterns:

```bash
# Step 1: Extract data-* attributes (most stable selectors)
grep -n 'data-[a-z-]+="' file.html | head -n 50

# Step 2: Extract role attributes
grep -n 'role="' file.html | head -n 30

# Step 3: Extract aria-* attributes (accessibility)
grep -n 'aria-[a-z-]+="' file.html | head -n 20

# Step 4: Extract platform-specific classes
grep -n 'font-user-message\|font-claude-response' file.html  # Claude
grep -n 'markdown prose' file.html  # ChatGPT
grep -n 'user-query-container\|model-response' file.html  # Gemini
```

### Benefits
- **~95% token reduction**: Extract ~500 lines instead of reading ~2000 lines
- **Faster analysis**: Grep returns only relevant matches
- **Scalability**: Works regardless of file size

### When to Use Full Read
- Grep results are ambiguous or insufficient
- Need to understand nested structure visually
- Debugging specific selector issues

**IMPORTANT**: Use this pattern extraction approach when analyzing or updating these samples in the future.

---

## Platform DOM Analysis

### ChatGPT (chatgpt.com)

#### Container Structure
```
<article data-turn="user|assistant" data-testid="conversation-turn-N">
  <div data-message-author-role="user|assistant" data-message-id="...">
    <div class="markdown prose ...">  <!-- assistant only -->
      <!-- Content -->
    </div>
    <div class="whitespace-pre-wrap">  <!-- user only -->
      <!-- Content -->
    </div>
  </div>
</article>
```

#### Validated Selectors (Priority Order)
1. **data-turn** (`user` | `assistant`) - Most stable, attached to `<article>`
2. **data-message-author-role** (`user` | `assistant`) - Stable, message-level
3. **data-message-id** - Unique message identifier
4. **data-testid** (`conversation-turn-N`) - Testing identifier
5. **.markdown.prose** - Assistant message content wrapper
6. **.whitespace-pre-wrap** - User message content (inside bubble)

#### Role Differentiation
- User: `data-turn="user"` + `.user-message-bubble-color`
- Assistant: `data-turn="assistant"` + `.markdown.prose`

#### Content Extraction
- User: `.whitespace-pre-wrap` (plain text)
- Assistant: `.markdown` (rendered HTML to convert)

#### Key Observations
- CSS classes are Tailwind utilities (very long, frequently change)
- `data-*` attributes are most reliable
- Each `<article>` represents one turn (question or response)
- No timestamps found in DOM

---

### Claude (claude.ai)

#### Container Structure
```
<div data-test-render-count="N">
  <!-- User Message -->
  <div data-testid="user-message" class="font-large !font-user-message">
    <p class="whitespace-pre-wrap">...</p>
  </div>

  <!-- Assistant Message -->
  <div data-is-streaming="false" class="font-claude-response">
    <div class="standard-markdown">
      <!-- Content -->
    </div>
  </div>
</div>
```

#### Validated Selectors (Priority Order)
1. **data-testid="user-message"** - User message container
2. **data-testid="assistant-message"** - (Not found in sample, may need inference)
3. **data-is-streaming** (`true` | `false`) - Response generation state
4. **data-test-render-count** - Container render count
5. **.font-user-message** - User message styling class
6. **.font-claude-response** - Claude response styling class
7. **.standard-markdown** - Response content wrapper

#### Role Differentiation
- User: `[data-testid="user-message"]`
- Assistant: `.font-claude-response` (class-based, no data attribute found)

#### Content Extraction
- User: `.whitespace-pre-wrap` inside `[data-testid="user-message"]`
- Assistant: `.standard-markdown` or `.progressive-markdown`

#### Key Observations
- **No `role` attributes** - Unlike ChatGPT
- **Aggressive DOM virtualization** - Messages unmount outside viewport
- **Artifacts**: Code/previews may render separately (not in sample)
- **Class-based role detection** for assistant messages (less stable)
- `data-is-streaming="true"` indicates ongoing generation

---

### Gemini (gemini.google.com)

#### Container Structure (Angular-based)
```
<div class="conversation-container" id="...">
  <!-- User Query -->
  <user-query>
    <user-query-content>
      <div class="query-content" id="user-query-content-N">
        <div role="heading" aria-level="2" class="query-text">
          <p class="query-text-line">...</p>
        </div>
      </div>
    </user-query-content>
  </user-query>

  <!-- Model Response -->
  <model-response>
    <response-container data-hveid="..." data-ved="...">
      <div class="response-container-content">
        <!-- Content -->
      </div>
    </response-container>
  </model-response>
</div>
```

#### Validated Selectors (Priority Order)
1. **user-query** (custom element) - User message container
2. **model-response** (custom element) - Assistant message container
3. **data-test-id="prompt-edit-button"** - User message edit button
4. **data-test-id="model-thoughts"** - Model thinking process section
5. **.query-content** - User query content wrapper
6. **.response-container-content** - Response content wrapper
7. **.query-text** - User query text
8. **role="heading"** - User query has heading role

#### Role Differentiation
- User: `user-query` element
- Assistant: `model-response` element

#### Content Extraction
- User: `.query-text` inside `user-query-content`
- Assistant: `.response-container-content` inside `response-container`

#### Key Observations
- **Angular framework**: Uses `_ngcontent-*`, `_nghost-*` attributes
- **Custom elements**: `<user-query>`, `<model-response>`, `<model-thoughts>`
- **Shadow DOM potential**: May use Web Components (not visible in sample)
- **Google tracking**: Extensive `data-hveid`, `data-ved` attributes
- **Material Design**: Uses Angular Material components

---

## Platform Comparison

| Feature | ChatGPT | Claude | Gemini |
|---------|---------|--------|--------|
| **Framework** | React (inferred) | React/Vue (inferred) | Angular |
| **Role Attribute** | `data-turn` | None | Custom elements |
| **Message ID** | `data-message-id` | None visible | None visible |
| **Stable Selectors** | Excellent (`data-*`) | Good (`data-testid`) | Good (custom elements) |
| **DOM Virtualization** | Moderate | Aggressive | Unknown |
| **Content Wrapper** | `.markdown` | `.standard-markdown` | `.response-container-content` |
| **Timestamp** | Not in DOM | Not in DOM | Not in DOM |

---

## Selector Strategy Recommendations

### Priority Order for Selector Chains
1. **data-testid** attributes (most stable)
2. **data-* custom attributes** (platform-specific, stable)
3. **ARIA attributes** (`role`, `aria-label`)
4. **Custom elements** (Gemini)
5. **Semantic classes** (`.markdown`, `.query-text`)
6. **Structural selectors** (last resort)

### Fallback Strategy
Each parser should implement fallback chains:

```javascript
// Example: ChatGPT message detection
const selectors = [
  '[data-message-author-role]',           // Primary
  '[data-turn]',                           // Secondary
  'article[data-testid^="conversation"]',  // Tertiary
  'article .markdown, article .whitespace-pre-wrap'  // Last resort
];

for (const selector of selectors) {
  const messages = document.querySelectorAll(selector);
  if (messages.length > 0) return messages;
}
```

---

## Testing Approach

### Console Validation Script
Before implementing parsers, validate selectors in browser console:

```javascript
// ChatGPT
const messages = document.querySelectorAll('[data-message-author-role]');
console.log('Found messages:', messages.length);
messages.forEach((msg, i) => {
  console.log(`[${i}] Role:`, msg.dataset.messageAuthorRole);
});

// Claude
const userMessages = document.querySelectorAll('[data-testid="user-message"]');
const assistantMessages = document.querySelectorAll('.font-claude-response');
console.log('User:', userMessages.length, 'Assistant:', assistantMessages.length);

// Gemini
const userQueries = document.querySelectorAll('user-query');
const modelResponses = document.querySelectorAll('model-response');
console.log('User:', userQueries.length, 'Assistant:', modelResponses.length);
```

---

## Known Risks & Mitigation

### Risk 1: Frequent UI Updates
**Mitigation**: Prioritize `data-*` and ARIA attributes over class names

### Risk 2: DOM Virtualization (Claude)
**Mitigation**: Implement scroll-to-top and MutationObserver loading strategy

### Risk 3: Shadow DOM (Gemini)
**Mitigation**: Implement recursive shadow DOM traversal utility

### Risk 4: Class Name Obfuscation
**Mitigation**: Multi-level fallback selector chains

---

## Update History
- 2025-11-29: Initial DOM analysis using Grep-based pattern extraction
