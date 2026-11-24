# Developer guide

This guide is for contributors who want to build ThreadToMD, understand its main components and reproduce the existing tests. The browser extension itself has **no runtime dependencies or bundling step**.

## Requirements

- Python 3.12+ recommended for packaging and Python test scripts (the build script uses only the standard library).
- Node.js 22+ for JavaScript unit tests (`npm test` does not install a dependency tree).
- For browser tests: Python Playwright and Chromium.

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

The test scripts use `/usr/bin/chromium` if present; otherwise they use the Chromium installed by Playwright. On Linux, the Playwright browser may also require additional system packages (see the Playwright documentation).

## Build

```bash
python3 scripts/build.py
```

Output:

```text
dist/
├── chrome/
├── firefox/
├── threadtomd-chrome-0.2.4.16.zip
└── threadtomd-firefox-0.2.4.16.zip
```

The archives contain `manifest.json` at their root. Use the matching archive/folder for your browser; do not upload the source-repository ZIP to a browser store. The builder writes a Firefox-specific Gecko ID and data-collection declaration. See [Publishing](PUBLISHING.md) before any store submission.

## Run tests

**Unit and static tests** (including the popup restoration handoff):

```bash
npm test
```

**Synthetic browser tests (check which ones your CI config actually invokes):**

```bash
python3 tests/e2e.py
python3 tests/background_pause.py
python3 tests/archive_e2e.py
python3 tests/locales.py
python3 tests/slow-older-fast.py
python3 tests/timeout_partial.py
python3 tests/ascii.py
python3 tests/package_integrity.py
python3 tests/popup_browser.py
```

A separate `tests/slow-older.py` exercises full-duration delayed loading and can be much slower. Its outcome was inconclusive in the v0.2.2 container environment; do not infer a failure or a pass from the faster fixture alone.

To regenerate **all current UI screenshots and brand artwork**, using a synthetic browser tab and the actual v0.2.4.16 popup HTML/CSS:

```bash
python3 scripts/update_popup_screenshots.py
python3 scripts/update_brand_assets.py
```

The popup renderer checks that the export button is visible and that the entire popup fits under 600 CSS pixels in Chrome English/Portuguese and Firefox manual-only modes. Playwright uses `/usr/bin/chromium` when available and otherwise its installed browser. The branding generator needs Pillow (`python3 -m pip install Pillow`) and renders the real synthetic popup screenshot into the GitHub banner; it does not fabricate real user conversations. Never replace documentation images with private chats.

## Project structure

| File or folder | Responsibility |
| --- | --- |
| `manifest.json` | Shared Manifest V3 metadata, core permissions and optional origins |
| `popup/` | On-demand user interaction, output selection, script injection |
| `src/exporter.js` | DOM adapters, scroll traversal, capture, Markdown output, pause/resume |
| `src/archive.js` | Media discovery, bounded fetching, ZIP writer and asset manifest |
| `src/i18n.js` and `_locales/` | Runtime UI text and native extension metadata |
| `background/assets.js` | Privileged download relay for permitted file hosts |
| `background/permission_popup.js` | Consent-grant listener and popup restoration |
| `background/worker.js` | Chromium MV3 background entrypoint |
| `background/native_wheel.js` | Chrome-only debugger input transport; omitted from the Firefox distribution |
| `tests/fixtures/` | Synthetic classic and Chat/Work conversation layouts |
| `scripts/build.py` | Create Chrome and Firefox distributions from shared source |
| `scripts/update_popup_screenshots.py` | Reproducible synthetic Chrome/Firefox popup and progress screenshots |
| `scripts/update_brand_assets.py` | GitHub banner/promo visual assets using current popup screenshots |

For the data flow and resource limits, see [Architecture](ARCHITECTURE.md).

## Manual browser checks

1. Load `dist/chrome/` unpacked in Chrome or `dist/firefox/manifest.json` temporarily in Firefox. Test the new popup and first button visibility.
2. **Chrome automatic:** open a known long chat and export Markdown. Verify first/last messages, middle samples, and preserved code widgets after a loop recovery. Chrome will show its native debugger banner; **do not open DevTools on the attached chat tab while the capture runs**.
3. **Firefox manual:** scroll from the newest message to the oldest and back, then click Finish in the on-page panel. Confirm the output is marked manual/unverified. Chrome assisted mode may be tested separately.
4. Inspect fenced code, ASCII diagrams, tables and links in Markdown.
5. Test ZIP mode with media; inspect relative asset paths and `manifest.json` after extracting it. Confirm the permission prompt occurs on ZIP selection, not on Export.
6. For automatic capture, switch away briefly and return. Verify controlled pause/resume without losing the accumulated message count.
7. Verify that a recovered code widget is restored where possible, that ordinary traversal removes none, and that aborted scans do not claim proven completeness.
8. Never share private chat content, signed URLs or tokens in bug reports, screenshots or test artifacts.

Synthetic tests exercise selected DOM behaviors but cannot independently prove that every live conversation is complete.

## Debugging an extension

- **Chrome:** `chrome://extensions/` > ThreadToMD > **Errors**, or inspect the popup. For the native automatic path, avoid attaching DevTools to the **same ChatGPT tab** while the extension is using Chrome's debugger interface.
- **Firefox:** `about:debugging#/runtime/this-firefox` > ThreadToMD > **Inspect**.
- The popup closes after successful injection; the progress panel is rendered in the conversation tab, not inside the popup. On first-time ZIP consent, the background may reopen a dismissed popup after permissions are granted.
- Report **sanitized** messages and steps. Never publish copied text from a private chat, signed download links, cookies or tokens.

## Contribution rules

Fix the smallest responsible component, preserve narrow permissions and cross-browser behavior, and include a synthetic regression fixture for DOM/scroll changes. A code change should normally be accompanied by `npm test`, the relevant browser regressions, and `python3 tests/package_integrity.py` after rebuilding.

See [Contributing](../CONTRIBUTING.md), [Security](../SECURITY.md) and [Release checklist](RELEASE_CHECKLIST.md).
