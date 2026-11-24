# ThreadToMD v0.2.4 — Restore the popup after permission consent

**Experimental GitHub pre-release** — manually verify native permission UI on Firefox and Chrome before promoting the release.

## User-visible change

- Select **Complete archive (.zip)**: the optional file-host consent dialog appears immediately if necessary.
- **Chrome:** the toolbar popup normally stays open; if native consent dismisses it, a background listener attempts to restore it after access is granted.
- **Firefox 149+ desktop:** the popup closes to expose the browser permission doorhanger, then **reopens automatically after Allow**, with ZIP still selected.
- Click **Export current conversation** to start the export. Granting permission does not start it automatically.
- If permission is denied, the user can reopen the popup manually; Markdown/ZIP without remote attachments remains available. Older Firefox versions may also need manual reopening.

## Design and privacy

The popup registers a one-shot handoff before invoking `permissions.request()` synchronously in the user's click handler. The background verifies the grant through `permissions.contains`, waits for the browser prompt to settle, skips restoration when a live popup already exists, and restores only into the original active window. A `storage.session` marker holds only tab/window IDs and a timestamp and is ignored when older than 3 minutes. There is no chat content, attachment, or credential storage. The new required API permission is `storage`; optional media-host permissions have **not** changed.

The Chrome MV3 entrypoint now loads two background modules: `assets.js` (unchanged transfer logic) and `permission_popup.js` (UI handoff). Firefox MV3 loads these as background scripts. Existing archive and virtualized-scrolling logic remains unchanged.

## Limitations

The action popup API can reject when the window loses focus or its toolbar UI is busy. The extension retries briefly without forcing focus or creating a new tab. Native user approval/denial in real browsers still needs manual acceptance testing; synthetic tests are not proof that every browser UI arrangement works.

See [test evidence](TEST_RESULTS_v0.2.4.md) and [release checklist](RELEASE_CHECKLIST.md).
