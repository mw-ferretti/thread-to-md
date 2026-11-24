# Store listing draft - ThreadToMD v0.2.4.16

**Draft for possible future Chrome Web Store and Mozilla Add-ons submissions.** The GitHub release is separate from store review/approval. Update this document against current store rules before submitting. The two browser distributions have deliberately different capture methods and permissions.

## Name

**ThreadToMD - ChatGPT to Markdown**

## Short description

Export ChatGPT conversations to Markdown or portable ZIP archives with accessible images and documents.

## Full description

ThreadToMD is an independent, open-source browser extension that saves the currently opened ChatGPT conversation as readable Markdown or a ZIP with accessible images and linked files. It captures rendered messages incrementally, so long virtualized conversations can be assembled even when the website removes older messages from the DOM.

- Preserve code blocks, tables, links, headings and whitespace-sensitive ASCII diagrams.
- Save accessible images and direct document links with local references in a portable ZIP; failed files are reported in `manifest.json`.
- Inspect progress and save a partial/unverified export if required.
- Keep files local; there is no ThreadToMD-operated backend, telemetry or tracking.

**Chrome/Chromium:** native automatic capture is the default, with an assisted/manual alternative. Chrome's automatic capture requires the high-privilege **`debugger`** permission for browser-trusted scrolling on the selected tab. On confirmed scrolling-widget loops, a previously captured code widget may be detached temporarily and restored where possible; the ChatGPT page may need reloading if React changes its view.

**Firefox:** manual capture only. Scroll to the beginning, return to the end, and press Finish. The Firefox package does **not** request `debugger`.

ZIP mode requests optional supported OpenAI/CDN host access when selected; denying access does not prevent Markdown export and may leave files unavailable in ZIP output.

This is **not** a complete account backup. The rendered site does not expose an authoritative message total and may hide branches or media. Users should check the first/last messages and archive manifest. ChatGPT and OpenAI are trademarks of their respective owners; this is not an official OpenAI product.

## Permissions and data use

| Permission | Browser | Purpose |
| --- | --- | --- |
| `activeTab`, `scripting` | Chrome + Firefox | Access and run bundled exporter only after the user's toolbar action |
| `storage` | Chrome + Firefox | Keep a short-lived tab/window/timestamp marker while restoring the popup after consent |
| `debugger` | **Chrome only** | Native browser wheel input on the initiating ChatGPT tab while automatic capture is running |
| Optional original-media hosts | Both, on ZIP choice | Retrieve accessible files from original approved sources with user consent |

No analytics, developer-hosted server, advertising, browser-history permission, cookies API, or persistent conversation storage. The saved archive can contain private text and signed links; treat it as sensitive.

## Art and store assets

| Asset | Source |
| --- | --- |
| Extension icon | `icons/128.png` (unchanged logo) |
| Current GitHub banner | `docs/brand/social-preview.png`, 1280 x 640, regenerated for v0.2.4.16 |
| Promotional art | `docs/brand/chrome-store-promo-440x280.png`, regenerated draft |
| GitHub UI screenshots | `docs/screenshots/popup.png`, `popup-pt-BR.png`, `popup-firefox.png`, `popup-firefox-pt-BR.png` |
| Synthetic progress preview | `docs/screenshots/progress-demo.png` |
| Actual store screenshot | **Pending:** capture a real installed browser window with non-sensitive chat data, at the dimensions accepted by each store |
| Public privacy URL | `https://github.com/mw-ferretti/thread-to-md/blob/main/PRIVACY.md` (after updating `main`) |
| Support / issue tracker | `https://github.com/mw-ferretti/thread-to-md/issues` |
| Store URLs | Add only after the submissions have been accepted |

The popup images come from real v0.2.4.16 HTML/CSS **rendered against synthetic tab data**. They are useful for README documentation but are not evidence of a live extension install or permission acceptance. Verify current [Chrome Web Store imagery](https://developer.chrome.com/docs/webstore/images) and [Mozilla publishing requirements](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) before submission.

## Localization

The runtime UI uses Portuguese only for `pt`/`pt-BR`; all other locales, including `pt-PT`, default to English. The original conversation is never translated.
