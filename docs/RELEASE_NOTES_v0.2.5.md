# ThreadToMD v0.2.5 - Safe resume after scroll rebounds

**Experimental GitHub pre-release - 22 November 2026.**

## Fixed

ChatGPT can re-anchor the virtualized timeline at the latest message when its tab loses and regains focus. Previous releases could treat each scrollbar movement as progress and repeatedly traverse the same messages.

The scanner now preserves its furthest history frontier across pause/resume, separates replaying already-captured messages from finding new content, and performs a bounded recovery without skipping directly to the oldest loaded position. Repeated jumps or a persistent stall produce an explicit **PARTIAL** export and a localized warning instead of an endless loop.

This is a scan-engine-only change: Chrome and Firefox share the same implementation. Markdown and ZIP formats, the asset relay, browser permissions and consent-popup behavior remain unchanged.

## Test coverage

- Chromium synthetic new layout: 88/88 messages after a focus-loss pause and seven enforced scroll-to-bottom rebounds.
- Synthetic persistent rebounds after resume: bounded termination and PARTIAL output.
- Isolated sporadic/persistent rebound regressions.
- Existing classic/new layout, archive, background pause, i18n and delayed-loading regressions.

## Before stable release

Test a real long ChatGPT conversation in both browsers with mid-export focus loss and return. Verify the first and last messages, captured count and export status. Browser-driven scroll behavior varies by ChatGPT release and is not fully represented by the synthetic fixtures. The first-message boundary remains a heuristic, not an authoritative completeness guarantee.

See [test results](TEST_RESULTS_v0.2.5.md), [release checklist](RELEASE_CHECKLIST.md) and [installation instructions](../README.md#quick-start).
