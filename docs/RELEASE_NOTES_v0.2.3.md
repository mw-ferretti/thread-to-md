# ThreadToMD v0.2.3 — First-use ZIP permission flow

**Status: Experimental / GitHub pre-release.** The extension is not signed or store-approved.

## Fix

The ZIP archive previously requested optional host permissions **after Export was clicked**. On the first permission dialog, the popup could close or lose the continuation callback before the exporter started. In Firefox, the permission doorhanger could appear behind the extension popup.

The optional host permission is now requested on the **direct click of the ZIP radio option**, before the export is started. This avoids asynchronous work between the user gesture and `permissions.request()`.

- **Chrome:** choose ZIP, accept permission, then press **Export current conversation** in the same popup.
- **Firefox:** choose ZIP; the extension popup closes to expose the native permission dialog. After allowing or denying access, reopen the extension (ZIP selection is remembered), then press **Export current conversation**.
- **Markdown-only:** no extra host permission.
- **Permission declined:** users can still export Markdown into ZIP with available original links; the manifest reports unavailable downloads. Choosing ZIP again retries the consent.

No new origin or browser-wide permission was added. The only new persistent data is the preferred export format (`archive` or `markdown`) in extension-local storage. Conversation content is not persisted.

## Validation

- New unit tests cover Chrome permission selection, granted/denied paths, pending-state UI, Firefox popup dismissal and restore, remembered format, and async race prevention.
- Existing archive, relay, localization, and message-scanning regressions remain part of the test suite. On 2026-11-19, 26/26 Node tests and 44/44 plus 88/88 synthetic message tests passed. The delayed-loader test did not finish in this run.
- **Manual consent tests in real Firefox and Chrome are still required**. Simulated UI tests do not prove that the native browser permission prompt appears above other panels.

See [release test evidence](TEST_RESULTS_v0.2.3.md) and [release acceptance checklist](RELEASE_CHECKLIST.md).
