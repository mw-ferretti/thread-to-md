# Test results — ThreadToMD v0.2.4

**2026-11-19 · Release acceptance complete.** The v0.2.4 package was manually validated in Google Chrome 158.0.8127.36 and Mozilla Firefox 160.0, including the native permission flow and popup-restoration behavior.

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
| Native permission approval and popup behavior in installed browsers | **PASS — manual acceptance** on Chrome 158.0.8127.36 and Firefox 160.0 |
| Chromium persistent-context extension-load smoke test | **NOT VERIFIED**: local headless Chromium did not expose a service worker within the test window |

## Specific behavioral coverage

- Selecting ZIP synchronously invokes `permissions.request()` within the user click handler.
- An asynchronous restore intent is passed to the background before the request without awaiting it (preserving user activation).
- After a grant, popup restoration is attempted only when the original popup is no longer open and the same tab/window is still active.
- Background consent state is one-shot and checked against the full set of optional origins, with a three-minute validity window.
- Denial, unrelated permissions, duplicate grant events, stale intents and tab focus changes cannot initiate a new export or a spurious popup.
- Markdown-only export remains free of optional host access prompts. ZIP mode still requires an explicit Export click even after authorization.

## Manual release acceptance

Manual acceptance was completed against the packaged v0.2.4 builds in:

- **Google Chrome 158.0.8127.36**
- **Mozilla Firefox 160.0**

The tested release flow covered the browser-native first-use permission UI, ZIP selection, explicit export start, popup behavior/restoration, refusal/recovery behavior, long-conversation export, portable archive handling and pause/resume behavior. The release remains intentionally conservative about message completeness because ChatGPT does not expose an authoritative rendered-message total.
