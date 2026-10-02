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
