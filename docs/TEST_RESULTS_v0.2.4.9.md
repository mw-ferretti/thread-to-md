# ThreadToMD v0.2.4.9 — local experimental verification

**Date:** 2026-11-23. Based on the supplied v0.2.4.8 source and builds. No GitHub release or browser-store publication was performed.

## Intent and implementation

- Chrome popup: **Automatic (Chrome)** (native trusted wheel, default) or **Assisted (manual)**. The classic automatic radio is gone. Saved `automatic`/`legacy` preferences migrate to native on Chrome; explicit `assisted` remains manual.
- Firefox popup: only **manual**, and the method picker is hidden. Any old stored method value is ignored in favor of `assisted`. Firefox still omits `debugger` and `background/native_wheel.js`.
- Normal Chrome wheel: **160 px / 110 ms**, unchanged. Additional timeline-edge hit-test points avoid nested scroll containers; no privileged wheel is sent to unrelated overlays. Recovery: up to four waits and bounded 320/480/600 px forward / 240/320/480 px reverse events (max 600 per command). Capture and ZIP asset drains occur between recovery events.
- Repeated jumps toward the newest end with no newly discovered content are treated as a loop symptom. A persistent blockage remains PARTIAL / UNVERIFIED and hands off to manual capture. The original legacy engine is left in source for historical regression fixtures but cannot be started via the popup.

## Results actually observed in this environment

| Validation | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | **48/48 PASS** |
| `python3 tests/popup_browser.py` | **PASS** (Chrome/Firefox-mode API mocks) |
| `python3 tests/package_integrity.py` | **PASS** for both packaged ZIPs, version and permissions |
| `python3 tests/native_nested_scroll_e2e.py` | **PASS:** 88 messages when a tall code scrollbox covers all seven former wheel points; **0** native wheel events directed into the nested scrollbox |
| Same nested-scroll E2E, high reverse threshold | **PASS:** 88 messages; recovery required >=320 px native reverse input |
| `python3 tests/native_stall_recovery_e2e.py` | **PASS:** recoverable stall 88 messages, permanent stall bounded and passed into manual fallback retaining 14 collected turns |
| `python3 tests/native_auto_e2e.py` | **PASS** for 88-message Markdown and ZIP runs, with real Chromium CDP wheels (the ZIP run was also verified separately with `--zip-only`) |
| `python3 tests/native_fallback_e2e.py` | **PASS:** debugger denial -> manual fallback, preserved two turns in Markdown and ZIP |
| `python3 tests/e2e.py` | **PASS:** 44 classic layout and 88 Chat/Work messages |
| `python3 tests/archive_e2e.py` | **PASS:** ZIP with 3 downloaded assets, 2 correctly marked unavailable |
| `python3 tests/locales.py` and `tests/ascii.py` | **PASS:** locale selection and whitespace-preserving ASCII diagrams |
| `tests/assisted_e2e.py` extended manual-scroll fixture | **INCONCLUSIVE:** did not finish within this environment's test time budget; no manual capture engine changes made in this version |

## Still pending before calling the fix stable

1. Install v0.2.4.9 in the user's real Chrome/Firefox and verify the popup methods and optional ZIP-permission flow.
2. Reproduce the exact long-code-block message from the user's ChatGPT conversation; verify Chrome crosses it unattended and captures the first/last turns.
3. Verify Firefox manual capture in an actual Firefox browser. Its popup behavior was simulated via the Firefox API shape, not tested with a Firefox binary.
4. Remember that the ChatGPT interface provides no authoritative total message count; successful automatic completion is still heuristic and should be checked for gaps.

**Security:** no new permissions or external services. The Chrome-only `debugger` permission remains sensitive and this is a local experimental build, not an approved store package.

**README preservation:** customized `README.md` is unchanged from v0.2.4.8 (SHA-256 `bc6685b271b7a88ec287af68a2256a618c0e576131e5e614bf0405e3df1c5e45`). It deliberately points at the already-published v0.2.4 release; do not change links to unpublished v0.2.4.9 assets.
