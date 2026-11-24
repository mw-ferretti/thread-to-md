# v0.2.4.8 — Chrome native automatic default: verification

2026-11-23. Scope: the browser-specific capture-method default and presentation, not a new scrolling engine. Chrome native wheel mechanics are unchanged from the user-tested v0.2.4.7.

## Code and compatibility

- `node --test tests/*.test.mjs`: **47/47 PASS**, including 19 popup tests. New tests cover automatic native default in Chrome, migrating historical `automatic` preference to native, persisting explicitly selected classic as `legacy`, and Firefox never selecting or displaying Chrome native.
- `python3 scripts/build.py` and `python3 tests/package_integrity.py`: **PASS** for Chrome and Firefox ZIPs. Chrome manifest retains `debugger`; Firefox explicitly excludes it and excludes the Chrome-only native worker.
- `python3 tests/locales.py`: **3/3 PASS** (pt-BR, pt-PT fallback, en-US).
- `python3 tests/ascii.py`: **PASS**, whitespace in ASCII diagrams preserved.
- User customized `README.md`: byte-identical to v0.2.4.7 (SHA-256 `bc6685b271b7a88ec287af68a2256a618c0e576131e5e614bf0405e3df1c5e45`).

## Browser integration tests (Chromium, synthetic Chat/Work fixtures)

- `python3 tests/e2e.py`: **PASS**, classic 44 messages, Chat/Work 88 messages.
- `python3 tests/assisted_e2e.py`: **PASS**, assisted Markdown 88, assisted ZIP 88, root replacement + Finish.
- `python3 tests/auto_loop_fallback.py`: **PASS**, classic infinite-loop guard preserves messages for Markdown and archive.
- `python3 tests/archive_e2e.py`: **PASS**, ZIP saves images/documents and accurately lists missing assets.
- `python3 tests/native_auto_e2e.py`: **PASS**, native Markdown 88 / ZIP 88, real trusted CDP wheel input in the browser fixture.
- `python3 tests/native_stall_recovery_e2e.py`: **PASS**, recoverable stall completes 88 messages; permanent stall switches safely to assisted.
- `python3 tests/native_fallback_e2e.py`: **PASS**, denied debugger transitions to assisted while preserving Markdown/ZIP content.

## Limitations

- The real-browser native success was confirmed by the user for v0.2.4.7; this v0.2.4.8 changes default selection only and still needs a normal user install smoke test.
- The Firefox browser binary is not installed in the verification environment. Firefox ZIP was checked statically and its popup behavior tested with a Firefox API mock, not by launching Firefox.
- Firefox native automation through WebDriver BiDi is researched, not implemented. A native companion or externally controlled browser session would be needed; no such permission/helper was silently introduced.
- ChatGPT does not expose a reliable message total through the virtualized DOM; full-history completeness remains heuristic. Review first/last messages and gaps.
- This is a **local build**, not a Chrome Web Store or AMO publication. No GitHub changes.
