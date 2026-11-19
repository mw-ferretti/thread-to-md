# Test results — ThreadToMD v0.2.3

## Scope

Changes are limited to popup consent sequencing, version strings, user-facing guidance and tests. The scanner algorithm, archive construction and asset relay are unchanged.

## Test coverage

- Native optional host permissions requested in direct ZIP radio click handler; no permission call inside Start.
- Chromium consent accepted/rejected; disable Start while prompt unresolved; no duplicate request on export.
- Firefox popup closes immediately after requesting new permission, with output format restored from a non-sensitive local preference.
- Existing asset download, Markdown, i18n, package integrity and synthetic browser tests.

## Remaining acceptance

**Not yet manually verified on real Chrome and Firefox permission UI.** Permission doorhanger z-order, native popup dismissal, and new installation behavior must be confirmed by users on both browsers before treating this as a stable store release.

## Executed on 2026-11-19

| Test | Result |
| --- | --- |
| Node tests (`npm test`) | **26/26 passed** |
| Chrome/Firefox package validation | **PASS** both distribution ZIPs |
| Browser DOM simulated permission click | **PASS** Chrome and Firefox behavior (mock APIs) |
| Classic and Chat/Work DOM export | **44/44** and **88/88** captured |
| ZIP browser end-to-end | **PASS** 3 local assets including images/PDF; 2 unavailable recorded |
| Locale-specific browser export | **PASS** `pt-BR`, `pt-PT`, `en-US` |
| Background hidden and blurred resume | **PASS** both, 88/88 |
| Delayed-loader accelerated scenario | **Inconclusive** (hit time limit in this run) |
| Real native browser permission doorhanger, Firefox/Chrome | **Pending manual acceptance** |

The permission changes are limited to `popup/popup.js`. Asset download and DOM scanning mechanisms are unchanged.
