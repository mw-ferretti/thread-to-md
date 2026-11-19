# Test results — ThreadToMD v0.2.2

Executed on 2026-11-19 in container Chromium (Playwright headless), Node 22+ and Python.

| Verification | Result |
| --- | --- |
| Node unit tests | PASS 20/20 |
| Browser classic layout | PASS 44/44 messages |
| Browser Chat/Work | PASS 88/88 messages |
| Hidden tab pause/resume | PASS 88/88 after resume, no premature download |
| Focus loss pause/resume | PASS 88/88 after resume, no premature download |
| Accelerated 4-lazy-batch scenario | PASS 160/160 |
| Archive ZIP + image/document paths | PASS |
| Locale `pt-BR`, `pt-PT`, `en-US` | PASS |
| Stalled loading indicator | PASS, partial status |
| ASCII diagrams | PASS |
| Extension package checks | PASS Chrome and Firefox |
| Original full-duration slow loader fixture | INCONCLUSIVE (timed out in this runtime) |
| Real Chrome/Firefox manual foreground/background behavior | NOT YET TESTED |

Synthetic browser tests do not guarantee completeness for all live ChatGPT layouts. The complete/partial marker remains heuristic and must not be treated as an independently verified message count.

## GitHub documentation audit (2026-11-19)

The publication-readiness pass changed **documentation, screenshot assets, brand artwork, and GitHub contribution templates only**. Runtime files `src/exporter.js`, `src/archive.js`, `background/assets.js`, and `popup/popup.js` retain the exact source hashes of the previously packaged v0.2.2.

- `npm test`: **20/20 PASS** in this audit.
- `python3 scripts/build.py`: **PASS**, both distributions generated.
- `python3 tests/package_integrity.py`: **PASS** Chrome and Firefox.
- Synthetic classic and Chat/Work E2E: **44/44** and **88/88 PASS** on this audit run.
- Additional combined browser test run exceeded the runtime limit after the layout tests. **No new pass** is claimed for background pause/resume, archive E2E or slow-loading from that interrupted run; refer to the prior recorded results above and complete live-browser manual acceptance before store submission.
- README/documentation relative paths, asset dimensions and issue-template YAML: **PASS**.
