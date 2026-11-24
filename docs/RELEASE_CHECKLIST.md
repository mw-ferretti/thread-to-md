# ThreadToMD v0.2.4.16 release checklist

This checklist separates **verified automated tests**, **user-reported live Chrome evidence**, and **checks still required for the exact release**. Synthetic fixtures alone do not prove that every live ChatGPT message is recoverable.

## Versions, GitHub and downloads

- [x] Existing public repository identified: [`mw-ferretti/thread-to-md`](https://github.com/mw-ferretti/thread-to-md), latest public release v0.2.4 at preparation time.
- [x] Source manifest, npm package, popup footer, exported-file generator metadata prepared at `0.2.4.16`.
- [x] New release notes and documentation updated for Chrome automatic / Firefox manual.
- [x] README retains the author's original structure/branding while updating the current release links.
- [x] Documentation popup screenshots (Chrome English/Portuguese and Firefox English/Portuguese), synthetic progress demo, social preview and promotional graphic regenerated.
- [x] Source and two browser ZIPs generated and ZIP-integrity checks passed.
- [ ] The exact v0.2.4.16 Chrome and Firefox installation smoke tests are complete.
- [ ] GitHub `main` contains the reviewed source update and CI succeeds.
- [ ] Git tag `v0.2.4.16` and GitHub Release are published with correctly named assets.
- [ ] README download links are verified **after** GitHub Release publication.
- [ ] The repository's GitHub **social preview setting** is changed to the newly committed image.

## Capture behavior

- [x] v0.2.4.15 **Chrome live test reported by user**: previously blocking captured code widget was temporarily removed, navigation resumed, and the conversation was exported completely according to the user's review.
- [x] v0.2.4.16 preserves the v0.2.4.15 scrolling/export logic; the changes are popup presentation and version metadata.
- [ ] v0.2.4.16 Chrome automatic: compare first and last messages of a long real conversation; confirm code blocks and recovered widget text in exported Markdown.
- [ ] v0.2.4.16 Chrome: confirm stop/partial fallback, restoring detached widgets where possible, and behavior after switching away from the tab.
- [ ] v0.2.4.16 Firefox: manual-only mode correctly captures while scrolling to oldest and newest messages, then finishing the capture.
- [ ] Both: compare several interior messages, diagrams, tables and links for chronology and fidelity.
- [ ] Both: check Markdown and ZIP output; test an accessible image/PDF and one unavailable file, inspect `manifest.json`.
- [ ] Chrome manual mode: verify it still behaves as the Firefox assisted path when selected explicitly.

## Privacy, permissions and stability

- [x] Chrome package includes `debugger` and native worker; Firefox package excludes them.
- [x] Optional ZIP origin access remains tied to the archive-selection click; no change to authentication handling.
- [x] No new telemetry, backend, tracking, or persistent conversation storage introduced by this release.
- [ ] Chrome sensitive debugger permission reviewed for browser-store policy and user comprehension; do not claim store approval.
- [ ] React-controlled DOM-widget detachment has no unacceptable effects in the exact live build; recovery only touches previously captured widgets, with a bounded count and best-effort restoration.
- [ ] Firefox temporary add-on and first-time ZIP consent verified in a live browser for this version.
- [ ] No personal exports, signed URLs, keys, logs or private screenshots included in the repository or release artifacts.

## Automated verification

- [x] `npm test`: **48/48 pass** for v0.2.4.16.
- [x] Synthetic Chrome/Firefox popup permissions and method tests: pass.
- [x] `tests/package_integrity.py`: pass on both built distributions.
- [x] Popup screenshot render verifies primary action visible in under 600 CSS px in Chrome English/Portuguese and Firefox manual variants.
- [ ] Full slower and authenticated-browser test matrix completed for v0.2.4.16. Report pending and inconclusive cases honestly rather than marking them passed.

## Browser stores (later)

- [ ] Verify current Chrome Web Store and Mozilla Add-ons guidance, then prepare **actual installed-browser screenshots** without private content.
- [ ] Review Chrome `debugger` use with the relevant submission policies; supply a complete, truthful justification.
- [ ] Replace the Firefox development ID with the intended stable ID before submitting to AMO.
- [ ] Complete privacy/data-use declarations matching the shipped packages and permissions.
- [ ] Add store URLs to README only after approval.

## Release decision

GitHub publication is possible after review of the exact package, but **a published GitHub release is not store approval**. The exporter still uses a heuristic for the beginning and end of virtualized history. Do not describe every export as independently verified or guaranteed complete.
