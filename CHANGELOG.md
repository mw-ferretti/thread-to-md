# Changelog

## 0.2.4 - 2026-11-19

- Reopen the toolbar popup automatically after a first-time ZIP permission grant if the native browser prompt closed it (Firefox 149+ and supported Chrome versions).
- Preserve Chrome's open popup during consent; a live-view port prevents duplicate reopenings.
- Record a one-shot permission handoff in `storage.session` with tab/window IDs and a timestamp (no conversation text or binaries); expire it after three minutes.
- Verify full optional origin grant, wait for native prompt dismissal, and never reopen an unrelated or inactive tab/window.
- Keep permissions optional, ZIP selection remembered, and export execution exclusively user-initiated.
- Add synthetic grant, denial, duplicate, stale intent, focus, retry, and consent-race tests.


## 0.2.3 - 2026-11-19

- Request optional media-host access **when the user selects ZIP**, rather than after pressing Export.
- Separate permission consent from the export command; already-granted permissions never prompt again.
- Work around Firefox's permission doorhanger being obscured by the toolbar popup:
  request in the radio's direct click handler, then close the popup and preserve ZIP selection.
  Reopen the toolbar after allowing or declining, then press Export.
- Keep Start disabled while the Chrome permission dialog is unresolved.
- If permission is declined, allow the archive to proceed with original links and a failure manifest.
- Remember only the selected export format in browser-local storage; never persist messages.
- Add cross-browser consent, denied-permission, reopening and stale async-check regression tests.
- Preserve the virtualized scanner, ZIP writer, asset relay and existing allowed hosts.


## 0.2.2 - 2026-11-19

### GitHub documentation refresh (no runtime changes)

- Reorganized README for a fast first-use path, clear privacy/limitations, and contributor onboarding.
- Updated versioned privacy/security documentation, store-submission guidance, and source layout.
- Added developer and troubleshooting guides, original GitHub/store artwork, and issue/PR templates.
- Refreshed screenshot assets to match v0.2.2.

### Runtime release

- Pause virtualized DOM scanning on tab invisibility or window focus loss; automatically resume on return.
- Reset edge-stability and stall counters after a pause or unexpectedly delayed timer.
- Ignore background time in initial-message loading and avoid saving until the tab is foregrounded.
- Add localized paused status, foreground resumption diagnostics, and browser regression tests.
- No additional permissions, no persistent storage, and unchanged attachment collection policy.

## 0.2.1 - 2026-11-08

- Fixed cross-origin media retrieval via a permission-gated, bounded background relay
  for Chrome Manifest V3 service workers and Firefox Manifest V3 background pages.
- Excluded favicons and small decorative site icons from the asset collector.
- Improved file-card URL recovery when a download link is nested in the card.
- Export filenames now use the UI locale instead of the language of the chat title;
  the original title remains unchanged inside Markdown.
- Added relay security, limits, error, naming, and ZIP regression tests.
- Retained the v0.1.2 virtualized scroll algorithm and the Markdown-only output path.

## 0.2.0 - 2026-11-08

- Added opt-in portable ZIP archives with local images, direct document downloads, and a machine-readable asset manifest.
- Registered and fetched transient visible assets before scrolling away; ZIP uses bounded concurrency and standard STORE/CRC32.
- Preserved original references when inaccessible; unsupported attachments are explicitly reported.
- Kept Markdown-only mode and the V4.2 scroll scanner, with a fix for DOM indentation before image Markdown.
- Added synthetic archive, ZIP integrity, duplicate-image, timeout, and permission tests.


## 0.1.3 - 2026-11-08

- Localized the popup, floating progress panel, errors, and exported Markdown metadata in English and Brazilian Portuguese.
- Explicit language selection: `pt` and `pt-BR` display Portuguese; English (`en`, `en-*`) and any other locale, including `pt-PT`, use English.
- Added WebExtensions `_locales/en` and `_locales/pt_BR` resources, with `default_locale: en` for extension metadata.
- Shared on-demand locale runtime is injected before the exporter in both Chrome and Firefox.
- Preserved the V4.2 scrolling and content parsing logic, minimal permissions, and automatic popup dismissal.


## 0.1.2 — 2026-11-08

- Fixed premature success at the oldest *currently loaded* ChatGPT page: v0.1.1 could stop after four quiet seconds, omitting earlier turns.
- Added patient top-boundary detection, periodic small scroll probes to retrigger older-page loaders, and a bounded timeout that flags failures as partial.
- Record heuristic (not independently verified) first-message completeness in Markdown metadata.
- Added a regression fixture requiring repeated entry into the scroll top and 4.8 seconds of async latency for each of four older-page batches.
- Preserved Firefox/Chrome popup close and root-relative script path fixes, code fences, and minimal permissions.

## 0.1.1 — 2026-11-08

- Fixed Firefox injection by making the exporter path extension-root-relative (`/src/exporter.js`); use the same path in Chrome.
- Close the popup automatically after a successful injection in both browsers, keeping on-page progress visible.
- Keep the popup open to display a useful error when injection fails.
- Added popup behavior and package integrity regression tests; unchanged V4 export/ASCII logic.

## 0.1.0 — 2026-11-06

- First Manifest V3 Chrome/Chromium/Firefox extension packaging.
- Preserved virtualized history scanner and incremental message capture from V4 engine.
- Preserved Markdown fenced ASCII diagram formatting.
- On-demand injection with `activeTab`/`scripting`; no persistent site permissions or network use.
- Added offline build, privacy policy, automated smoke and synthetic browser regression tests.
