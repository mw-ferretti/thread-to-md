# Release acceptance checklist

This checklist is intentionally strict. Passing synthetic tests is **not** the same as confirming complete exports in live ChatGPT.

**Manual acceptance environment (2026-11-19):** Google Chrome 158.0.8127.36 and Mozilla Firefox 160.0.

## Product behavior

- [x] Chrome: export a known long conversation; compare the **first user message** with the original.
- [x] Firefox: export the same conversation; compare the **first user message** with the original.
- [x] Both: compare the last messages and the total captured count.
- [x] Both: compare ordering and text for at least five messages sampled across the conversation.
- [x] Both: inspect code blocks, ASCII diagrams, tables and links in the output.
- [x] Both: verify popup closes on successful start and remains open after an injection error.
- [x] Both: verify Stop & save partial, browser download and partial status/warnings.
- [x] Both: test a very slow conversation and a temporarily stalled older-message loader.

## First-use permission and popup restoration (v0.2.4)

- [x] Chrome fresh profile: selecting ZIP prompts immediately; allowing access keeps popup open and Export starts on its first click without reprompting.
- [x] Firefox fresh profile: selecting ZIP requests permission, closes toolbar popup, and exposes native prompt. After allow, verify popup automatically reopens in Firefox 149+ with ZIP selected; Export still requires an explicit click. If the popup cannot reopen, manual recovery works.
- [x] Both: denial does not start an export, then explicit Export still creates a valid ZIP with missing-asset metadata.
- [x] Both: Markdown selection never asks for asset permission, and an already-granted ZIP selection never re-prompts.
- [x] Both: switching windows or closing the target tab while a permission prompt is open does not reopen the toolbar in another window.
- [x] Both: denied access does not trigger auto-reopening, while reopening manually retains the chosen format.
- [x] Both: verify the new `storage` permission stores only a short-lived tab/window/timestamp marker in session memory, not chat content.
- [x] Both: reinstall/update does not unexpectedly request new hosts, and no chat text is persisted in local preference.

## Portable archive acceptance (v0.2.4)

- [x] Both browsers: test an actual conversation with inline image, user-uploaded image, and generated image.
- [x] Both: test direct PDF and ZIP downloads. Inspect `conversation.md` after extracting the complete archive.
- [x] Both: verify `assets/images/` and `assets/documents/` paths resolve offline.
- [x] Both: test an expired private file link and an attachment with no direct URL; verify `manifest.json` records it.
- [x] Both: verify the UI never falsely reports missing binaries as saved.
- [x] Both: compare message order/content with the previous Markdown-only export.
- [x] Both: confirm only original asset URLs are requested and no developer-owned server receives content.

## Localization

- [x] Both: `pt` and `pt-BR` show Portuguese in popup, progress, and Markdown metadata.
- [x] Both: `en`, other variants and unsupported languages (including `pt-PT`) show English.
- [x] Both: the exporter never translates user/assistant message content.
- [x] Both: extension name/description resolve via native `_locales` without permission changes.

## Build and security

- [x] Run `python3 scripts/build.py` and `npm test`.
- [ ] Run Playwright synthetic tests and ZIP integrity tests; check GitHub Actions passes.
- [x] Check ZIP structure, required `activeTab`/`scripting`/`storage` permissions, and optional host permission prompt in each browser.
- [ ] Confirm no private conversations, account tokens or personal information are committed.
- [ ] Inspect generated files for unexpected network calls, telemetry, or remote dependencies.
- [x] Keep source and Firefox/Chrome packages at the exact same version.

## GitHub

- [x] README and documentation updated for v0.2.4 (2026-11-19).
- [x] UI screenshots regenerated and inspected for v0.2.4.
- [x] v0.2.4 unit tests (35/35), browser package integrity and manual Chrome/Firefox release acceptance; see `docs/TEST_RESULTS_v0.2.4.md` for the remaining inconclusive synthetic-only cases.
- [ ] Confirm the full browser CI matrix on GitHub Actions after the first push; the delayed-loader scenario was inconclusive locally.
- [ ] Create public `ThreadToMD` repository and upload the source files.
- [ ] Review README screenshots and rendering; verify both show **v0.2.4** where a version is displayed.
- [ ] Set GitHub social preview to `docs/brand/social-preview.png`, add a concise description and relevant repository topics.
- [ ] Enable the issue templates and private vulnerability reporting, if available.
- [ ] Enable Issues, security advisories/private vulnerability reports and appropriate repository settings.
- [ ] Add a public, published privacy-policy URL in the store documentation.
- [ ] Create the public GitHub Release tagged **v0.2.4** and upload both browser-specific ZIPs.

## Browser stores

- [ ] Review current Chrome Web Store requirements; capture real, non-sensitive screenshots and review `docs/brand/chrome-store-promo-440x280.png` as the promotional artwork draft.
- [ ] Review current Mozilla Add-ons requirements; declare `none` if there is no data collection/transmission.
- [ ] Replace the placeholder Firefox extension ID with a stable unique ID.
- [ ] Complete store privacy declarations in line with the actual code and `PRIVACY.md`.
- [ ] Submit ZIPs and any source/build information required by the stores.
- [ ] Add store links to README **only after approval**.

## Release decision

Manual browser acceptance is complete for v0.2.4, but long-history detection remains heuristic. **Do not claim 100% message completeness** because ChatGPT does not expose an authoritative rendered-message total. If a user's first message is missing, treat it as a regression, capture a sanitized fixture and fix the scanner before the next release or browser-store submission.
