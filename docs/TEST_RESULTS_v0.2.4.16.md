# ThreadToMD v0.2.4.16 — evidence and acceptance status

**Prepared:** 24 November 2026. **Scope:** popup, documentation, localization, version metadata and distributions. The capture engine is inherited unchanged from the user-validated v0.2.4.15.

## Inherited real-browser evidence

The user reported that the v0.2.4.15 Chrome automatic extension reached the known blocking scroll widget, temporarily removed it, resumed navigation without manual assistance, and exported the entire conversation. This is **qualitative user acceptance**, not an independent check against an authoritative ChatGPT turn count. See [v0.2.4.15 engine tests](TEST_RESULTS_v0.2.4.15.md) for the exact regression scenarios and remaining React DOM risks.

The v0.2.4.16 release changes the popup UI, strings, screenshot generation and version markers; **it does not introduce new traversal/recovery behavior**. Avoid conflating the tests below with a new live-browser validation.

## Tests run on v0.2.4.16

| Test | Outcome | Notes |
| --- | --- | --- |
| `npm test` | PASS — 48/48 | Includes native worker, asset handling, popup modes, permission handoff, i18n |
| `python3 tests/popup_browser.py` | PASS | Synthetic click/injection/ZIP permission flow in Chromium, including Firefox-mode mock |
| `python3 tests/package_integrity.py` | PASS | Chrome and Firefox ZIP structure, permissions, manifests and supported modes |
| `python3 tests/locales.py` | PASS | Portuguese and English metadata on synthetic message export |
| `python3 tests/ascii.py` | PASS | Whitespace-sensitive ASCII diagrams remain fenced |
| `python3 scripts/update_popup_screenshots.py` | PASS | Chrome EN: ~561 CSS px; Chrome PT-BR: ~574; Firefox manual EN/PT-BR: ~394; action visible within 600px |
| `python3 scripts/update_brand_assets.py` | PASS | Generated 1280x640 banner and 440x280 promotional tile using actual synthetic popup screenshot |
| GitHub published release validation | PENDING | `v0.2.4.16` and its two release assets are not published by this local preparation |
| New Chrome v0.2.4.16 live smoke test | PENDING | Inherited user validation was on v0.2.4.15 |
| New Firefox v0.2.4.16 live smoke test | PENDING | Manual-only package is tested with fixture-level mocks, not a live logged-in Firefox session |

## Browser packages

- Chrome: native automatic is selected by default; assisted manual remains available; required permission includes `debugger`.
- Firefox: capture method picker is hidden and manual is forced; no `debugger` permission or Chrome-native transport bundle.
- Both: Markdown or ZIP, optional host consent on ZIP selection, English/default and Brazilian Portuguese localization, compact popup and release version `0.2.4.16`.

## Known uncertainties

1. History completion is based on the rendered page's observable behavior; there is no authoritative total.
2. Chrome's recovery can temporarily detach a captured code widget from a React-managed page and may cause UI inconsistencies; restoration is best effort.
3. ZIP files may omit protected, missing, oversized or expired assets; their outcomes are reported instead of fabricating local references.
4. Documentation graphics use synthetic fixtures; they are **not installed-browser screenshots** or proof of real-world store readiness.
