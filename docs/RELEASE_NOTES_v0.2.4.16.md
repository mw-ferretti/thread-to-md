# ThreadToMD v0.2.4.16 — Native Chrome capture and compact popup

**GitHub release tag:** `https://github.com/mw-ferretti/thread-to-md/releases/tag/v0.2.4.16`  
**Previous public version:** v0.2.4

ThreadToMD exports a ChatGPT conversation to readable Markdown or a portable ZIP containing accessible images and attachments. This release introduces the Chrome native-automatic workflow built and exercised after the original v0.2.4 release, while Firefox now offers only manual capture. It also refreshes the popup layout and documentation imagery.

## Highlights

- **Chrome automatic is the default:** the extension sends trusted native wheel events through Chrome's debugger interface to traverse long, virtualized histories. The selected tab is attached only during capture and detached at completion/interruption.
- **Recovery from scrolling loops:** on a confirmed blocking nested-scroll code widget, the exporter can temporarily detach the **previously captured** widget (at most three per run), continue scanning, and attempt to restore the DOM afterwards. If recovery is unsafe or blocked, it retains the manual/partial fallback. Modifying React-managed DOM has limitations.
- **Firefox manual only:** Firefox has no `debugger` permission in its package. Users scroll to the beginning and end while ThreadToMD captures rendered messages, then choose Finish in the progress panel.
- **Smaller popup:** concise choices, an immediately visible action button, short notes and temporary-debugger disclosure below the button. Chrome, Firefox, English and Brazilian Portuguese fixture screenshots are updated.
- **Same output formats:** Markdown and ZIP with bounded asset downloading, relative links for successfully saved media, and `manifest.json` for unavailable assets. No developer backend, telemetry or account-wide API.

## Install from GitHub Releases

After publication, download the matching archive (unpack before installing):

- Chrome/Chromium: [`threadtomd-chrome-0.2.4.16.zip`](https://github.com/mw-ferretti/thread-to-md/releases/download/v0.2.4.16/threadtomd-chrome-0.2.4.16.zip), install the unpacked folder via `chrome://extensions/` > Developer mode > Load unpacked.
- Firefox: [`threadtomd-firefox-0.2.4.16.zip`](https://github.com/mw-ferretti/thread-to-md/releases/download/v0.2.4.16/threadtomd-firefox-0.2.4.16.zip), select its extracted `manifest.json` in `about:debugging#/runtime/this-firefox` > Load Temporary Add-on. The temporary add-on disappears when Firefox is fully restarted.

Choose Markdown or Complete archive in the popup. ZIP may ask for optional original-media-host access when first selected. Chrome can start automatic or assisted capture. Firefox is manual: scroll up to the oldest message, down to the newest, and finish using the on-page panel. Confirm the beginning and end of important exports.

## Validation and limitations

- The user validated the v0.2.4.15 native engine in a long **real Chrome conversation** on 24 November 2026: when a previously problematic code widget blocked upward traversal, ThreadToMD detached it, continued, and the user reported a complete export. No independently measured authoritative message count is available.
- The v0.2.4.16 changes are limited to popup presentation/text and version metadata; the v0.2.4.15 capture mechanism is unchanged. Its 48 JavaScript tests, popup browser fixture tests and package-integrity checks passed.
- **Fresh live-browser acceptance of the exact v0.2.4.16 package, particularly Firefox manual-only, remains recommended before labeling it fully tested.**
- Chrome `debugger` is a sensitive permission. Its use is restricted by ThreadToMD to the initiating ChatGPT tab, but it grants powerful tab debugging capability while attached. Review the extension's source and permissions before installing. Browser-store approval is **not** implied by GitHub publication.
- ChatGPT does not provide an authoritative rendered-page message total; all completeness claims remain heuristic. Expired/protected attachments may be unavailable, and modifying React-managed code widgets can disrupt the live page until reload.

See [release evidence](TEST_RESULTS_v0.2.4.16.md), [troubleshooting](TROUBLESHOOTING.md), [privacy](../PRIVACY.md), [security](../SECURITY.md) and [publishing guide](PUBLISHING.md).
