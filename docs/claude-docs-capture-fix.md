# Claude Docs capture fix

The user reported: "이거 캡처 안 되는 것 같음."

The supplied conversation displayed a Claude Docs document whose card had
`data-testid="frame-card-open"`. Before this change, the parser queried only
`[data-testid="artifact-card-open"]`, so it returned no document for that card.
Both the parser regression and the loaded-extension regression failed before
the fix because the artifact was absent.

The document panel contains a same-origin `/code/artifact/<id>` wrapper,
then an `<id>.frame.claudeusercontent.com` frame, then a sandboxed srcdoc
editor. The original editor body had `class="tiptap ProseMirror"`,
`role="textbox"`, and its document title in `aria-label`. The srcdoc markup
ended with `<body></body>`; the actual document is rendered at runtime.

The background worker now reads that editor through Chrome's scripting API.
It checks the containing artifact origin and the editor title before returning
HTML. Missing or ambiguous content rejects the export. The conversation still
comes from Claude's API, and the document uses the existing `_artifact` record
with `version: "rendered"` and a metadata warning. Panel state is restored.

The manifest adds `https://*.frame.claudeusercontent.com/*` for this read.
Package and extension patch versions are `1.2.2` and `0.3.2`.

Verification commands, run from the implementation worktree:

```sh
npm run build
npm run validate:selectors
./node_modules/.bin/tsc --noEmit --resolveJsonModule
npm test > /private/tmp/claude-docs-capture/full-suite.log 2>&1
node /private/tmp/claude-docs-capture/verify-capture.cjs
git diff --check
```

The full suite passed 26 files and 585 tests. Its Chrome regression covers
the same-origin wrapper, cross-origin artifact host, runtime-rendered sandbox
editor, and a table citation URL through the loaded extension. Build,
TypeScript and diff checks passed. Selector validation reported zero errors
and three existing prefix warnings.

The captured-page verifier enumerated all 622 heading, paragraph, list and
table-cell candidates in the original editor HTML. All matched the production
conversion, including a separate comparison preserving punctuation. It also
checked the order of 341 leaf blocks and all 12 unique original source URLs;
none were missing. These candidate counts include nested elements such as
a table cell and its paragraph. The original document contained zero code
blocks, so code whitespace was not assessed by this comparison.

Private evidence and the standalone Markdown capture are under
`/private/tmp/claude-docs-capture/`. The Markdown capture is a replay of the
original editor DOM, not a fresh download from the updated installed extension.
Live verification after extension reload remains outstanding.

## Accessible label mismatch in AERO

The AERO page's card and first `h1` both read
`AERO (Aerodrome / Aero) - 프로젝트의 실적과 토큰의 조건부 평가`, but the
editor's `aria-label` was ` Aero) - 프로젝트의 실적과 토큰의 조건부 평가`.
The old exact-label filter rejected the mounted document and eventually
produced `could not read the Claude Docs document`.

The reader now accepts either the exact accessible label or the trimmed
first `h1` title. It still requires the requested artifact parent origin,
nonempty content, and exactly one matching editor. This preserves label-only
documents without accepting a later section heading from another document.
No slash-specific label repair is used.

Before the change, the reader regression command failed for the original
AERO mismatch, stale and missing labels, and ambiguity across label and
heading matches. After the change those cases pass, along with wrong-title,
wrong-artifact, empty-body, and label-only checks:

```sh
./node_modules/.bin/vitest run tests/unit/claude-doc-frames.test.ts
npm test > /private/tmp/claude-doc-title-final-suite.log 2>&1
npm run validate:selectors
./node_modules/.bin/tsc --noEmit --resolveJsonModule
npm run build
node /private/tmp/verify-claude-doc-title.cjs
```

The full `npm test` run passed 26 files and 592 tests. Build, TypeScript,
and diff checks passed; selector validation reported zero errors and three
existing warnings. No linter is configured in `package.json`.

The Chrome regression covers ordinary, truncated Korean, and stale labels
through nested sandbox frames and the production JSONL serializer. Its HTML
responses explicitly declare UTF-8, and the test checks the original rendered
heading before export; omitting that charset corrupted the Korean fixture.

The captured-page verifier enumerates every heading, paragraph, list item,
and table cell from the original AERO and NMR editor captures. Its
punctuation-preserving text comparison removes Markdown formatting and
whitespace, checks leaf-block order, and checks original unique source URLs.
AERO: 716 candidates, 389 ordered leaf blocks, 12 unique URLs, zero missing
content or URLs. NMR: 622 candidates, 341 ordered leaf blocks, 12 unique URLs,
zero missing content or URLs. Private evidence and artifact-only JSONL replays
are under `/private/tmp/claude-doc-title-*`; these are not fresh full-conversation
downloads from the user's installed extension.

Package and extension patch versions are `1.2.3` and `0.3.3`. A fresh live
export after reloading the installed extension remains to be checked.

## Generated Markdown file reports

The downloaded `claude_Maple Finance SYRUP analysis.jsonl` contained the
conversation summary but no `_artifact` record. The original SYRUP page
exposed `file-card-open` inside `data-sheet-kind="markdown"`, with the full
report in `#wiggle-file-content .standard-markdown`. Neither the Claude Docs
frame selector nor the original artifact selector matched this file card.

The parser now reads these generated Markdown files through their separate
file viewer. It matches the viewer's `h2[title]` to the card title, opens
Preview when needed, and restores the prior file or Code mode. Unreadable
Markdown files reject the export. Other generated file formats are excluded
from this Markdown-document acquisition path.

The failing report regression passed after the fix. The full `npm test`
run passed 26 files and 598 tests, including a Chrome extension test that
opens a closed file viewer, preserves the complete report, table and link,
and closes it again. Unit tests also cover an unrelated open viewer, Code
mode restoration, non-Markdown files, and failure cleanup. Build, TypeScript
and diff checks passed; selector validation retained its three existing
warnings. Package and extension versions are `1.2.4` and `0.3.4`.

```sh
npm test > /private/tmp/claude-file-report-suite.log 2>&1
node /private/tmp/verify-claude-syrup.cjs
```

The verifier enumerated all 143 original report content candidates and
checked the order of 142 leaf blocks, all 3 tables and 23 unique source URLs.
No body or source URL omissions were found. The recovered JSONL retains
the downloaded messages and adds the report obtained by the production
parser from captured original viewer HTML. Its metadata warning identifies
that recovery; it is not a fresh full-conversation extension download.
