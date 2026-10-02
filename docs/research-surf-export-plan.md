# Deep Research and Surf export plan

## Request and scope

User request: "무엇을 어떻게 고칠지 계획 문서 작성 후 바로 수정 시작. 최종적으로 아웃풋까지 제대로 나오는지 확인할 ㄱ덧."

Implement and verify complete JSONL exports for the supplied ChatGPT, Claude,
Grok, Gemini and Surf conversations. This task includes the report body and
available source URLs, rather than treating a completion card as the report.

## Observations before editing

- ChatGPT's supplied conversation has ordinary user and assistant message
  units, but its research report is inside an iframe titled `심층 리서치`.
  The current parser reads only the message units in the top document.
- Gemini's completed report is in `deep-research-immersive-panel`, outside
  `model-response`. The current selectors capture the plan and completion
  card, but omit the report and its sources.
- Claude displays the report as a document outside its conversation rows.
  The parser already reconstructs `artifacts` commands. Its compatibility
  with this live report's API representation remains unverified.
- Grok's supplied report matches `.message-bubble`, and its sources drawer
  matches the existing extraction controls. Preserve that behavior and
  verify the final output rather than rewriting it without evidence.
- Surf is absent from the supported hosts, manifest, factory, and platform
  types. Its page shows an attachment-only prompt, a report, tables, and
  source controls that need a dedicated parser.

These observations are from the supplied pages and the pre-change code.
They are not a claim that an actual extension download has passed.

## Implementation sequence

1. Capture the relevant rendered page structure before editing. Inspect
   actual report controls, source links, and any available document export
   representation. Keep private conversation captures outside tracked files.
2. Add regression tests that fail with the existing code: research reports
   outside ordinary messages, report/source conversion through JSONL, and
   Surf platform detection and attachment/report extraction.
3. Add a bounded, platform-specific report acquisition path. ChatGPT must
   read the report's frame through Chrome's frame APIs when it is cross
   origin; the parent document cannot query its DOM. Gemini must associate
   a report with the correct completion card and restore UI state after
   opening it. Never attach an unrelated open panel to another conversation.
4. Verify Claude's actual representation before deciding whether its
   artifact parser needs a change. Keep its API-based conversation parser.
5. Implement Surf independently, including roles, attachment placeholders,
   report tables and source links from observed UI. Generation detection
   needs separate live verification while Surf is generating.
   Update all platform registration consumers and manifest permissions.
6. Reject or warn explicitly when a completed report cannot be acquired.
   A successful export of a status card must not imply a complete report.
   Preserve the existing JSONL message and `_artifact` conventions where
   possible; document any additional record shape before using it.
7. Bump package and manifest minor versions once, as required by CLAUDE.md
   for a new platform. Run the configured selector validator, build,
   TypeScript checks, and full test suite. Rerun failures sequentially.
8. Produce JSONL for each supplied conversation and compare against the
   original captured report: headings, paragraph and table content, links,
   order, attachment names, and code whitespace where present. Inspect the
   entire diff. Record measured results and any limits below.

## Acceptance criteria

- Surf is recognized throughout the extension and exports the supplied
  prompt attachment and report without sidebar, thinking, or toolbars.
- ChatGPT and Gemini include the completed report instead of only the
  research-start/completion message.
- Claude's final document is present as a complete artifact, or a specific
  acquisition error prevents a false success.
- Grok retains the report and available source URLs.
- Every delivered JSONL line parses; roles and metadata are correct; report
  completeness is checked against pre-existing page content, not generated
  expectations. Fixture replay and live extension verification are reported
  separately, with unresolved limitations stated plainly.

## Results

Implemented in branch `fix-research-surf-export`, worktree
`/Users/dragon/github/llm-chat-exporter/.worktrees/research-and-surf-export`.

- ChatGPT reads the cross-origin research app and its nested `about:blank`
  report. Reports remain attached to their assistant turn when scrolling
  unmounts the iframe. Missing reports reject the export.
- Gemini opens each completed research card, includes the report and source
  lists, and restores the panel state. Math conversion now retains Gemini's
  original `data-math` content when no MathML annotation exists.
- Claude keeps its API conversation parser and existing artifact command
  reconstruction. When that yields no document, it reads the matching latest
  visible artifact panel and records a warning. The live API representation
  could not be inspected, so full live Claude export remains unverified.
- Surf is registered throughout the extension. Its parser retains report
  tables and links, removes controls, and records attachment filenames.
  File contents unavailable in the page are not invented.
- Grok's parser is unchanged. Its original expanded sources drawer is used
  for the output comparison.

### Automated checks

Commands run from the worktree:

```sh
npm run validate:selectors
./node_modules/.bin/tsc --noEmit --resolveJsonModule
npm run build
npm test > /private/tmp/llm-research-export-results/full-suite.log 2>&1
node /private/tmp/llm-research-export-captures/verify.cjs
git diff --check
```

Build, TypeScript and diff checks passed. Selector validation reported zero
errors and three prefix warnings. The full suite passed 25 files and 574
tests, including an actual Chrome extension test of the nested cross-origin
ChatGPT report. No linter is configured in `package.json`.

### Captured-page output comparison

The verifier runs the production parsers and JSONL serializer against the
supplied pages' original DOM captures. It enumerates heading, paragraph,
list, table and code candidates, classifies controls and empty elements,
and checks original source URLs in Markdown link destinations. Text checks
normalize Markdown formatting; code whitespace is checked separately.
Binary image downloads are outside this replay's verification.

The following counts come from `verify.cjs` and its `summary.json`:

| Platform | Message records | Content candidates | Matched | Controls or empty | Missing content | Original unique URLs | Missing URLs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ChatGPT | 2 | 90 | 90 | 0 | 0 | 0 | 0 |
| Gemini | 4 | 127 | 103 | 24 | 0 | 151 | 0 |
| Grok | 2 | 178 | 178 | 0 | 0 | 78 | 0 |
| Surf | 2 | 437 | 435 | 2 | 0 | 17 | 0 |

Claude's rendered artifact was compared separately: 548 content candidates,
zero missing content, 98 original unique URLs and zero missing URLs. This
artifact-only output does not include the API conversation messages and is
not presented as a complete Claude export.

Private outputs and comparisons are in
`/private/tmp/llm-research-export-results/`. `chatgpt.jsonl`, `gemini.jsonl`,
`grok.jsonl` and `surf.jsonl` are captured-page replays.
`claude-artifact-only.jsonl` is explicitly artifact-only. These files are
kept outside git because they contain private conversation content.

### Live verification sequence

At the time of the captured-page checks, the user's installed extension
still read the main project folder, which contained version `0.2.4`.
Building only the worktree did not update that folder. The user then
requested a local main merge. Deployment therefore uses the existing root
`/Users/dragon/github/llm-chat-exporter`: merge the tested branch into local
main, install dependencies and build there, then verify its manifest and
output files so the existing extension can be reloaded in place.

Chrome's browser-control policy blocks `chrome://extensions/`, so the user
must perform the extension reload. The subsequently downloaded files were
checked as recorded below. Claude's corrected live download and Surf's
first live download were subsequently verified in the final check below.
Surf streaming detection has not been checked during a live generation.

### Downloaded output check and Claude source correction

The user requested inspection of `~/Downloads/`. All JSONL files in that
folder were parsed, their metadata and roles checked, and their report
content compared against the original page captures. These are actual
downloaded outputs, rather than the earlier parser replay files.

Commands and evidence files:

```sh
node /private/tmp/llm-research-export-captures/verify-downloads.cjs
node /private/tmp/llm-research-export-captures/verify-claude-source-repair.cjs
npm test > /private/tmp/llm-research-export-results/claude-sources-full-suite.log 2>&1
```

| Platform | Downloaded records | Content check | Original unique URLs | Missing URLs |
| --- | ---: | --- | ---: | ---: |
| ChatGPT | 3: metadata, user, assistant | 90 report candidates matched | 0 | 0 |
| Gemini | 5: metadata and 4 messages | 103 matched, 24 controls or empty | 151 | 0 |
| Grok | 3: metadata, user, assistant | 178 report candidates matched | 78 | 0 |
| Claude | 4: metadata, user, assistant, artifact | Body complete; citation badges absent | 98 | 98 |
| Surf | No matching downloaded file | Pending | Not measured from a download | Not measured |

Claude's apparent text differences were checked separately after removing
the original rendered citation badges (`a[class~="group/tag"]`) and
normalizing Markdown list prefixes. All 548 original body candidates were
present in the downloaded artifact. This body-only check is recorded in
`claude-body-verification.json`; it does not excuse the missing URLs.

The bug was reproduced with a failing regression test: an API artifact
already containing its body skipped rendered source acquisition entirely.
The fix reads the title-matched document panel and appends only URLs absent
from the API body, keeping its exact text and version. Unrelated panels
are excluded; a source acquisition failure retains the API document and
adds a metadata warning. Versions are bumped to manifest `0.3.1` and
package `1.2.1` for this bug fix.

Verification using the actual downloaded artifact as input and the original
rendered document capture found all 98 URLs, with zero missing URLs and the
API body and version preserved. The repaired replay is
`/private/tmp/llm-research-export-results/claude-repaired-replay.jsonl`;
it is not a new live download and the original Downloads file is unchanged.
The complete suite passed 25 files and 577 tests. The final live check
required reloading the corrected build and exporting Claude again, plus
exporting Surf. Those downloads were verified in the next check.

### Final live download verification

All supplied conversations now have actual downloaded JSONL in
`/Users/dragon/Downloads/`. Every JSONL line parses, metadata matches the
supplied conversation, and roles match the captured conversation structure.

```sh
node /private/tmp/llm-research-export-captures/verify-downloads.cjs
node /private/tmp/llm-research-export-captures/verify-final-documents.cjs
```

| Platform | Report body check | Original unique source URLs | Missing URLs |
| --- | --- | ---: | ---: |
| ChatGPT | 90 candidates matched | 0 | 0 |
| Gemini | 103 matched, 24 controls or empty | 151 | 0 |
| Grok | 178 candidates matched | 78 | 0 |
| Claude | 548 body candidates matched after excluding rendered citation badges | 98 | 0 |
| Surf | 435 matched, 2 controls or empty | 17 | 0 |

The downloaded Claude artifact exactly matches the previously verified
source-repaired artifact, retains version `v1`, and has no warnings.
Rendered citation badge placement differs from the API body; the source
URLs are in the appended list. The body and URLs are checked separately,
rather than treating badge labels as missing report prose.

The downloaded Surf report preserves its attachment filename and all
9 original tables containing 77 original table rows. Apart from image
destinations, its Markdown exactly matches the original-capture replay.
Its 19 inline PNG images decode to nonempty bytes. The report body, table
cells and 17 original source URLs have no detected omissions, and metadata
has no warnings. This verifies the supplied completed conversation;
generation-in-progress behavior is still outside these live checks.

Measured detailed results are recorded in
`/private/tmp/llm-research-export-results/download-verification.json`,
`claude-live-download-verification.json`, and
`surf-live-download-verification.json`. The requested final output checks
for the supplied completed conversations are complete.
