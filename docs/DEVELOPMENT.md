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
├── threadtomd-chrome-0.2.4.zip
└── threadtomd-firefox-0.2.4.zip
```

The archives contain `manifest.json` at their root. Use the matching archive/folder for your browser; do not upload the source-repository ZIP to a browser store. The builder writes a Firefox-specific Gecko ID and data-collection declaration. See [Publishing](PUBLISHING.md) before any store submission.

## Run tests

**Unit and static tests** (including the popup restoration handoff):

```bash
npm test
```

**Synthetic browser tests (the same set as GitHub Actions):**

```bash
python3 tests/e2e.py
python3 tests/background_pause.py
python3 tests/archive_e2e.py
python3 tests/locales.py
python3 tests/slow-older-fast.py
python3 tests/timeout_partial.py
python3 tests/ascii.py
python3 tests/package_integrity.py
```

A separate `tests/slow-older.py` exercises full-duration delayed loading and can be much slower. Its outcome was inconclusive in the v0.2.2 container environment; do not infer a failure or a pass from the faster fixture alone.

To update popup screenshots (using synthetic tab data):

```bash
python3 scripts/update_popup_screenshots.py
```

The screenshot generator currently uses `/usr/bin/chromium`; if your OS has Chromium elsewhere, run it in an environment that provides that path, or adjust the script locally. Never replace repository screenshots with real private conversation content.

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
| `tests/fixtures/` | Synthetic classic and Chat/Work conversation layouts |
| `scripts/build.py` | Create Chrome and Firefox distributions from shared source |

For the data flow and resource limits, see [Architecture](ARCHITECTURE.md).

## Manual browser checks

1. Load an unpacked development build in Chrome or a temporary Firefox add-on.
2. Open a known conversation in your own account.
3. Export Markdown and validate its first and last messages and several middle messages.
4. Test code fences, ASCII diagrams and tables.
5. Test ZIP mode with a media-containing conversation; inspect local relative paths and `manifest.json`.
6. Change to another app while a long export is running. Confirm it pauses, then resumes on return.
7. Verify no sensitive content appears in console logs, screenshots or test artifacts you plan to share.

Synthetic tests exercise selected DOM behaviors but cannot independently prove that every live conversation is complete.

## Debugging an extension

- **Chrome:** `chrome://extensions/` > ThreadToMD > **Errors**, or inspect the popup and target tab DevTools consoles.
- **Firefox:** `about:debugging#/runtime/this-firefox` > ThreadToMD > **Inspect**.
- The popup closes after successful injection; the progress panel is rendered in the conversation tab, not inside the popup. On first-time ZIP consent, the background may reopen a dismissed popup after permissions are granted.
- Report **sanitized** messages and steps. Never publish copied text from a private chat, signed download links, cookies or tokens.

## Contribution rules

Fix the smallest responsible component, preserve narrow permissions and cross-browser behavior, and include a synthetic regression fixture for DOM/scroll changes. A code change should normally be accompanied by `npm test`, the relevant browser regressions, and `python3 tests/package_integrity.py` after rebuilding.

See [Contributing](../CONTRIBUTING.md), [Security](../SECURITY.md) and [Release checklist](RELEASE_CHECKLIST.md).
