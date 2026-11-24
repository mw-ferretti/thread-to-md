> **Historical lab notes.** This test was performed on v0.2.4.4. The current v0.2.4.16 release provides Chrome automatic/assisted and Firefox manual-only; see [current release notes](RELEASE_NOTES_v0.2.4.16.md).

# Assisted Capture Lab (v0.2.4.4)

**Status:** experimental build based on the published v0.2.4 engine V4.5. Not a release. The stable v0.2.4 repository README is preserved byte-for-byte. Neither GitHub nor any browser store has been updated.

## Goal and evidence

On the live ChatGPT Chat/Work interface, programmatic `scrollTop` movements can repeatedly snap back to the same small virtualized window. This was reproduced without the extension: 150 small movements discovered only two unique turn IDs while six repositioning cycles occurred. Physical mouse-wheel navigation over the conversation found 30 unique turn IDs across analogous viewport/height changes. A turn ID is not necessarily a single exported message; the exporter can split it into user and assistant units.

This build tests a user-driven navigation fallback: preserve the original parser/ZIP path, and capture messages while the user scrolls manually. It does **not** claim that programmatic mouse-wheel injection from a page's JavaScript is possible or reliable.

## Install for local testing

For Chrome:

1. Extract `dist/threadtomd-chrome-0.2.4.4.zip` to an empty directory.
2. Visit `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory.
3. Make sure the existing stable extension is not simultaneously exporting the same tab.

For Firefox:

1. Extract `dist/threadtomd-firefox-0.2.4.4.zip`.
2. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select its `manifest.json`.
3. Temporary add-ons may need to be reloaded after restarting Firefox.

No new permissions were added. The original optional ZIP media-host permission flow is unchanged.

## Assisted workflow

1. Open the **specific** ChatGPT conversation and position it at the newest message.
2. Open the extension popup. Choose the Markdown or ZIP format.
3. Under **Capture method**, choose **Assisted (experimental)** and click **Start assisted capture**.
4. Let the popup close. Keep this tab open. Move the mouse over the conversation itself, away from nested code-block scroll areas. Scroll physically **up** until you have actually seen the oldest message; allow older pages to finish loading.
5. Scroll physically **down** to the newest message. As the site mounts/unmounts turns, the extension retains their parsed content and IDs in memory. It does not control the scrollbar in assisted mode.
6. Click the floating **Finish & save partial** button. Keep the tab foregrounded during the final ZIP asset drain and download.
7. Open the Markdown or `conversation.md` within the ZIP; review the first and last records, counts, ordering, and attachments. If you missed a section of the history, repeat the test.

The floating panel displays progress. The programmatic `window.__chatgptMdExporter.status()` and `.stop()` controls are available in the extension content-script context; the floating panel is the reliable user-facing control. Avoid refreshing the tab or switching conversations during capture; the in-memory session is not persistent.

## Contract and integrity

- The `automatic` method is the original two-direction scroll scan and remains the default for new installations.
- The `assisted` method never sets `scrollTop`, invokes `scrollBy`, or dispatches synthetic wheel events. It listens to trusted wheel events only to estimate the direction of chronological ordering. DOM changes, scrolls, and a bounded periodic heartbeat trigger incremental capture.
- The existing parsing, Markdown normalization, deduplication by message key, in-memory record map, overlap-aware ordering, and archive asset collection/rewrite are reused.
- If the Chat/Work timeline is replaced, capture rebinds to the new timeline. A missing timeline is not silently replaced with an unrelated document scrollbar.
- The archive collector begins fetching referenced assets as they are registered, while the DOM references are still available. Clicking **Finish** drains outstanding work rather than cancelling it, unlike stopping the original automatic scanner early.
- The assisted file is **always labelled `PARTIAL` / `ASSISTED / UNVERIFIED`**. Reaching the oldest/newest message and the absence of gaps are not independently provable from DOM evidence. Windows containing novel messages without any known overlap are counted as an additional ordering warning.
- If the page navigates to a different conversation path, the capture stops and saves the data found up to that point with a warning. Reloading or closing the tab discards the running in-memory capture.
- The exported Markdown still contains the conversation source URL, as in v0.2.4; this experimental capture does not send text to any remote ThreadToMD service.

## Known limitations

- Real ChatGPT virtualizer correctness remains to be verified on a user account. Chromium fixture tests demonstrate the mechanism but are not evidence of complete export on the live app.
- `isTrusted` is not made writable; JavaScript executed in the page cannot forge hardware/DevTools-native wheel input.
- A message that is never rendered, or appears and disappears before its content can be parsed, cannot be guaranteed to be captured.
- Extremely rapid manual jumps can produce disjoint windows and uncertain chronological order, recorded as warnings.
- Images/files restricted by permissions, expired URLs, blob lifetimes, size limits or authorization may be missing; the original manifest documents failures.
- The current session is only in memory. No resume across refresh/browser restart and no independent total-message oracle.

## Development checks

```bash
node --test tests/*.test.mjs
python3 tests/e2e.py
python3 tests/assisted_e2e.py
python3 tests/archive_e2e.py
python3 scripts/build.py
python3 tests/package_integrity.py
```

Browser fixture tests use headless Chromium and a simulated virtualized conversation; Firefox package is validated structurally but is not browser-executed in this environment.
