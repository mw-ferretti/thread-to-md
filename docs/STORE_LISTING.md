# Store listing draft - ThreadToMD

**Draft for a future store submission.** Do not publish until manual Chrome and Firefox acceptance is complete. Store links do not exist yet.

## Product name

**ThreadToMD - ChatGPT to Markdown**

## Short description

Export ChatGPT conversations to Markdown or portable ZIP archives with accessible images and documents.

## Full description

ThreadToMD is an independent, open-source browser extension for saving the currently open ChatGPT conversation as a readable Markdown file or a portable ZIP archive.

It scans long conversations incrementally as the site loads and removes older message elements. The resulting Markdown preserves headings, links, lists, tables, fenced code blocks and whitespace-sensitive ASCII diagrams. An optional ZIP mode attempts to save visible images and direct document links, then rewrites successful references as local paths.

Key features:
- Export the current chat in Markdown (`.md`) or ZIP (`.zip`).
- Keep content from virtualized conversation windows as you scroll.
- Track progress and save an explicitly partial export if needed.
- Pause when the conversation loses browser focus and resume when you return.
- Include an asset-status `manifest.json` for ZIP archives.
- Run locally with no developer-operated server, analytics or tracking.

How to use:
1. Open a ChatGPT conversation.
2. Click ThreadToMD and choose Markdown or ZIP.
3. Start the export and leave the tab open. If you switch away, return to let the scan finish.
4. Review the beginning/end of the Markdown and any failed downloads in `manifest.json`.

**Limitations:** A rendered page does not expose an authoritative message total. Attachments may be unavailable due to expired URLs, authentication, missing direct links or file limits. Audio, video, interactive content and hidden branches are outside the current archival scope. This is not a full account backup.

**Privacy:** Conversation data is assembled locally. ZIP mode may fetch assets from their original URLs with optional permission consent; original hosts can receive ordinary request metadata. ThreadToMD does not send conversation content to its developer.

Independent project, not affiliated with or endorsed by OpenAI.

## Permissions and data use

- `activeTab`: temporarily access the user-selected conversation after an explicit click.
- `scripting`: inject the bundled exporter in that tab.
- `storage`: remember a short-lived popup-restoration marker (tab/window IDs and timestamp only) in session memory during first-time host permission consent.
- Optional OpenAI/CDN host access: only in ZIP mode, to fetch supported original asset URLs.
- No analytics, telemetry, persistent conversation/asset storage, advertising, cookie API or browsing history access. A local export-format preference is saved; temporary consent state is in session memory.

The Firefox manifest includes `data_collection_permissions.required = ["none"]`. Reconfirm the current store rules and declarations against the final built package.

## Assets and submission notes

| Asset | Current location or next action |
| --- | --- |
| Extension icon | `icons/128.png` |
| Promotional tile | `docs/brand/chrome-store-promo-440x280.png` - original design draft, review against store requirements |
| GitHub social preview | `docs/brand/social-preview.png` |
| GitHub demo screenshots | `docs/screenshots/popup.png`, `docs/screenshots/progress-demo.png` - synthetic UI fixture |
| Chrome Store screenshot | **Still needed:** real installed extension, 1280 x 800 or 640 x 400, with non-sensitive demo data |
| Public privacy URL | Add the repository's public `PRIVACY.md` URL after GitHub publication |
| Support URL | Add the public GitHub issue tracker after publication |
| Store URLs | Add only after each store approves the extension |

The repository's demo screenshots should **not** be presented to browser stores as proof of live-site functionality. Use current official [Chrome](https://developer.chrome.com/docs/webstore/images) and [Mozilla](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) rules when submitting.

## Localization

The UI defaults to English. Browser locales `pt` and `pt-BR` use Brazilian Portuguese; all others, including `pt-PT`, use English. Exported conversation text is never translated.
