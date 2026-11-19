# v0.2.0 test evidence (synthetic fixtures)

Executed 2026-11-08. All fixtures use invented content and local resources.

| Test | Result |
| --- | --- |
| Node.js unit tests (archive, locale, popup, permissions) | 14/14 PASS |
| Classic virtualized DOM | 44/44 PASS |
| New Chat/Work virtualized DOM | 88/88 PASS |
| ASCII diagram preservation | PASS |
| Delayed top-loader partial warning | PASS |
| Browser localized metadata (`pt-BR`, `pt-PT`, `en-US`) | 44/44 each PASS |
| ZIP package structure and source consistency | Chrome PASS, Firefox PASS |
| Archive-mode browser test | PASS (2 messages, 3 saved assets, 2 unavailable with manifest status) |
| ZIP compatibility | PASS (`zipfile.testzip`, CRC checks, image/document local references) |
| Full four-batch delayed loading scenario | Reached all 160 messages in diagnostic run; the long test did not complete before this execution environment's time limit. **Not counted as a passing test for this release.** |

Real ChatGPT attachment and image recovery has **not yet been validated on Chrome and Firefox** for v0.2.0. CORS/authentication constraints may prevent individual asset downloads. Treat this as a preview before stores submission.
