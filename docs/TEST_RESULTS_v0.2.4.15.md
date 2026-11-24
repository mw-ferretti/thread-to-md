# ThreadToMD v0.2.4.15 — original v0.2.4.10 navigation + loop-only DOM mitigation

**Experimental, not released.** Test results are recorded after execution; do not assume simulated fixtures prove the live ChatGPT behavior.

## Baseline fidelity

- Sourced from the `ThreadToMD-v0.2.4.10-Full-Source.zip` attached in the conversation, not v0.2.4.12/13/14.
- `wheelPoint`, `nativeWheel`, `recoverNativeStall`, `scanNative` edge handling, all normal delays, popup modes and native background transport remain v0.2.4.10.
- Changes are restricted to a small loop-hook, a code-widget detach/restore helper, numeric counters and version/documentation.
- The `README.md` stays byte-for-byte identical to v0.2.4.10 as requested earlier.

## DOM-skip safety conditions

- Only after v0.2.4.10's existing native loop/stall detection fires during the older-message scan.
- Candidate must be a visible `[data-client-defined-widget="code_block"]` containing a `pre` element and **actual** vertically scrollable descendant.
- Its complete owner message must have a stable identity and matching canonical Markdown previously captured in `S.records`.
- All accessible ZIP assets are drained before detach; only the code-widget element is detached, never the parent message/turn.
- Maximum three different widgets; each removal counts as a recovery attempt toward the unchanged manual fallback.
- Restore at the end when the original DOM position remains available. A browser reload reconstructs the original page when React has evicted the marker.

## Limitation

React-managed DOM modification may cause application errors or remount races. The original v0.2.4.10 history traversal heuristics are not proof of complete capture. The live browser test is decisive.

## Local test results (24 November 2026)

| Verification | Result |
| --- | --- |
| `node --check src/exporter.js` | PASS |
| `npm test` | 48/48 PASS |
| Native loop on user-supplied code-block fixture (`trapped`) | PASS, 88/88 messages, one widget detached and restored |
| Same loop + ZIP (`trapped_zip`) | PASS, 88/88 messages, code retained in Markdown |
| Stop during loop (`trapped_cancel`) | PASS, 88/88 captured, PARTIAL export and restoration |
| Unstable/unconfirmed message owner (`unstable`) | PASS, zero removals and safe manual fallback |
| Ordinary traversal (`normal`) | PASS, 88/88 messages, zero removals |
| Original v0.2.4.10 moving-scroll oscillation regression | PASS, 88 messages, original 3 native recoveries |
| Original permanent-oscillation regression | PASS, manual fallback after 124 trusted wheel events |
| 17,000-pixel message | PASS, no false loop or unnecessary removal |
| Native Markdown / native ZIP | PASS, 88 messages per format |
| `tests/package_integrity.py` | PASS, both browser packages and permissions |
| `tests/locales.py` and `tests/ascii.py` | PASS |
| Byte-for-byte comparison of `wheelPoint`, `nativeWheel`, `recoverNativeStall`, original transport, popup and README against v0.2.4.10 | PASS |

The browser fixtures use accelerated timers **only inside the test runner**. The shipped source retains original v0.2.4.10 waits, native input intensity, 24-second older-page stability threshold and original edge probing. The real ChatGPT UI was not exercised in this environment. The original user-provided DOM fixture is byte-identical to `element_blocking(1).txt` (SHA-256 `178348bc1b2f253d71cc7116811888b75a1d71b037d7d91f64eca98f7172ede3`).

**Limitations:** Removing React-controlled nodes is experimental and might result in reconciler conflicts or re-mounting; the normal scanning engine cannot independently verify that every older message has been found. Publish only after the user validates the first/last messages in their original long conversation.

## User-reported live Chrome result (24 November 2026)

After the local tests, the user installed v0.2.4.15 in Chrome and reported that it detected the known blocking code element, temporarily removed it, automatically continued past the previously blocked region and exported the entire conversation. This is direct user feedback on the live product (not an authoritative independent message count). The v0.2.4.16 release keeps that navigation engine unchanged and only updates its popup UI and version metadata. See [v0.2.4.16 evidence](TEST_RESULTS_v0.2.4.16.md).
