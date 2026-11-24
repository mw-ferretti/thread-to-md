# ThreadToMD 0.2.4.6 — native wheel experimental validation

## Evidence from the user's Chrome (upstream experiment, not this integrated build)

Native Wheel In-Tab Lab 0.0.1, November 22, 2026: 600/600 `isTrusted` wheel events, 11 unique rendered turn IDs, four virtualizer rebases and no recurrent positioning loop. The lab stopped at the configured 600 events rather than the beginning of the full conversation. This supports using real browser wheel events rather than `scrollTop` for ChatGPT Chat/Work virtualization, but is not a full-export proof.

## Integrated code tests (this build)

| Test | Status | Grounded observation |
|---|---|---|
| `node --test tests/*.test.mjs` | PASS | 44 tests (including native transport validation, URL restrictions, temporary detach, native popup and Firefox disable) |
| `tests/native_auto_e2e.py`, Chromium + CDP | PASS | 88 ordered messages exported to Markdown; browser-dispatched trusted wheel events |
| `tests/native_auto_e2e.py`, ZIP + image | PASS | 88 ordered messages exported to ZIP, with an embedded image archived |
| `tests/native_fallback_e2e.py`, Markdown | PASS | Browser debugger denial switches to assisted, preserving existing and subsequently added turns; partial marker |
| `tests/native_fallback_e2e.py`, ZIP | PASS | Same fallback with ZIP; original and new turns preserved |
| `tests/e2e.py` | PASS | Classic auto 44, Chat/Work auto 88 |
| `tests/assisted_e2e.py` | PASS | Assisted Markdown 88, assisted ZIP 88 and replacement of virtualized scroll root |
| `tests/auto_loop_fallback.py` | PASS | Classic automatic loop switches to assisted, retaining both turns in Markdown and ZIP |
| `tests/slow-older-fast.py` | PASS | Delayed older history, 160/160 messages |
| `tests/archive_e2e.py` | PASS | Original ZIP machinery, two images, one document, unavailable attachments manifest |
| `tests/package_integrity.py` | PASS | Chrome and Firefox ZIPs, manifests, version, expected files and permissions |
| `cmp README.md <baseline>` | PASS | User-customized README unchanged byte-for-byte |

**Limits:** The integrated browser-native scrolling tests use Playwright CDP against a synthetic virtualized Chat/Work DOM. The Chrome native worker/permission handshake is tested in a Node simulated extension runtime, not an installed extension in a real logged-in ChatGPT tab. Chromium headless on this environment did not expose the loaded extension service worker; no unverified live-browser claim is made. Real Chrome verification and completeness/integrity checks of a long conversation remain mandatory. The native end-of-history decision is a best-effort quiet-period heuristic and does not establish an authoritative message count.

## Security

Chrome v0.2.4.6 includes the sensitive `debugger` permission **only for local experiments**. The public v0.2.4 stays untouched. The Firefox build strips `debugger`, omits the native worker and hides its native-mode UI. Both Chrome and Firefox retain their prior optional archive-host permission behavior.
