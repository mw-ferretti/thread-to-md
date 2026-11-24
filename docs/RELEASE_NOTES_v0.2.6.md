# ThreadToMD v0.2.6 — Chronological progress tracking

**Experimental pre-release — 22 November 2026.**

## Fixes

The v0.2.5 recovery mechanism could mistakenly treat virtualized DOM height changes as proof of advancement, even when Chrome was repeatedly returning to the newest messages after capturing only a few turns.

- Reset the upward scan watchdog **only on actual older message discovery**; position-only changes cannot reset the rebound budget.
- Detect jumps toward newer content by the chronological identity of captured messages, even when the scroll range changes.
- Capture rendered messages immediately after requested movements as well as after the normal delay.
- Use the actual scrollable ancestor/descendant if the ChatGPT timeline element itself does not scroll.
- Stop the upward scan with a clearly marked **PARTIAL** export when progress is genuinely blocked, without initiating another redundant downward scan.
- Add numeric diagnostic fields in `window.__chatgptMdExporter.status()` for investigating real-browser failures without copying conversation text.

No new permissions, storage of conversations, servers, archive format changes, or third-party dependencies.

## Test coverage and limitation

Automated tests cover a nine-message stalled virtualized window with growing `scrollHeight`, nested scrolling, sporadic and persistent scroll rebounds, and pause/resume. Existing Markdown/ZIP and layout tests also apply. **We have not reproduced the user's exact live ChatGPT failure environment**, so this release should not be presented as proven to export the entire conversation. Any file marked PARTIAL must be checked for missing older messages.

See [test results](TEST_RESULTS_v0.2.6.md), [release checklist](RELEASE_CHECKLIST.md), and [installation instructions](../README.md#quick-start).
