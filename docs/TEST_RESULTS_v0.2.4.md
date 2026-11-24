# Test results — ThreadToMD v0.2.4

**2026-11-19 · Pre-release.** Native browser permission doorhangers have **not** been validated manually in Chrome and Firefox after this change. Background popup restoration is supported by the Firefox 149+ API but should be verified with a fresh consent prompt.

## Scope

New code: `background/permission_popup.js`, a small `background/worker.js` for Chromium MV3, and minimal popup consent handoff. `storage.session` holds only a tab ID, window ID and timestamp. The existing message scanner and download relay algorithms are unchanged. Version labels and metadata have been updated to 0.2.4.

## Executed here

| Test | Result |
| --- | --- |
| Node.js unit suite: archive, relay, i18n, popup, restoration security and edge cases | **35/35 PASS** |
| Browser ZIP archives and Manifest V3 integrity (Chrome and Firefox) | **PASS** |
| Chromium DOM clicks with mocked browser permission APIs: Chrome and Firefox modes | **PASS** |
| Synthetic classic/new export | **44/44** and **88/88 PASS** |
| Archive end-to-end: images/PDF, relative links, missing attachments | **PASS** (3 saved, 2 unavailable as expected) |
| Hidden-tab pause and safe resumption | **PASS** (88/88) |
| Stalled history loader explicitly marked partial | **PASS** |
| Fenced ASCII diagrams | **PASS** |
| Locale test: Brazilian Portuguese and Portuguese (Portugal) fallback to English | **PASS** for these two locales |
| Locale suite in full, blur/resume combined suite, accelerated delayed-loader test | **INCONCLUSIVE** — test execution limits; do not claim full-suite pass |
| Native permission approval and automatic popup reopening in installed Firefox/Chrome | **NOT TESTED**, needs manual acceptance |
| Chromium persistent-context extension-load smoke test | **NOT VERIFIED**: local headless Chromium did not expose a service worker within the test window |

## Specific behavioral coverage

- Selecting ZIP synchronously invokes `permissions.request()` within the user click handler.
- An asynchronous restore intent is passed to the background before the request without awaiting it (preserving user activation).
- After a grant, popup restoration is attempted only when the original popup is no longer open and the same tab/window is still active.
- Background consent state is one-shot and checked against the full set of optional origins, with a three-minute validity window.
- Denial, unrelated permissions, duplicate grant events, stale intents and tab focus changes cannot initiate a new export or a spurious popup.
- Markdown-only export remains free of optional host access prompts. ZIP mode still requires an explicit Export click even after authorization.

## Manual release acceptance still needed

With an otherwise clean profile **or revoked prior host access**, use the built Chrome and Firefox packages. In Firefox 149+ desktop, select ZIP and allow all optional hosts; check the native dialog is visible and the toolbar popup reopens with ZIP selected. In Chrome, check the popup stays open or is restored if dismissed. Then press Export and inspect the resulting ZIP. Repeat refusal and window-switch scenarios, and check no duplicate dialogs/popups. This test is essential before publishing to either browser's extension store.
