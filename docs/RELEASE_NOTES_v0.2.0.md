# ThreadToMD v0.2.0 - experimental archive mode

## Added

- Two explicit export modes: **Markdown only (.md)** and **Complete archive (.zip)**.
- Images embedded in their Markdown positions and saved under `assets/images/` when accessible.
- Direct document links downloaded under `assets/documents/` when accessible.
- `manifest.json` with per-file results and failure reasons.
- Local ZIP writer with CRC32, no external dependencies, and bounded fetches.
- English and Portuguese labels for the new UI and status fields.
- Synthetic browser regression validating `blob:`, `data:`, repeated images, accessible documents, missing downloads, ZIP integrity and ASCII diagrams.

## Preserved

- V4.2 long-history scan behavior and partial-export protections.
- Existing one-file Markdown export.
- Firefox/Chrome shared code with `activeTab` + `scripting` only.
- No analytics, developer servers or permanent storage.

## Known gaps

- Download requires a direct URL and access permitted by browser CORS/authentication; many attachment UI buttons provide no downloadable URL.
- No complete guarantee for all media or messages, and no offline copy of arbitrary website links.
- 24 MiB/file, 160 MiB total assets; no ZIP64; some previews may be lower resolution.
- Test fixtures passed, but archive mode still requires user validation on actual Chrome/Firefox conversations before public store submission.
