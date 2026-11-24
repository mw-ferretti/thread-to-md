# Test results — ThreadToMD v0.2.6

**22 November 2026 — experimental pre-release.** The v0.2.5 live Chrome report (stuck at 9 captured messages while the scroll bar repeatedly returns toward recent messages) **is not yet verified as resolved in live ChatGPT**. The following tests use isolated synthetic fixtures.

| Check | Result |
| --- | --- |
| JavaScript unit suite (popup, permission restoration, ZIP, relay) | **35/35 pass** |
| Classic DOM / Chat-Work DOM | **44/44 / 88/88 messages** |
| Phantom scroll progress with just 9 messages and growing `scrollHeight` | **PARTIAL in 10 steps**, no false completion |
| Timeline marker inside a non-scrolling wrapper | **18/18**, actual ancestor scroller selected |
| Sporadic scroll-to-bottom rebounds | **88/88** after 7 injected jumps |
| Persistent rebounds | **PARTIAL**, bounded termination |
| Focus-loss pause/resume + 7 rebounds | **88/88**; persistent variant **PARTIAL** |
| Hidden tab / blurred window | **88/88** in each scenario; no premature save |
| Delayed older-message loading (4 batches) | **160/160 messages** |
| Timeout/stalled loading indicator | **PARTIAL** with an explicit warning |
| ZIP with images, PDF, failed assets and local links | **Pass** |
| ASCII fenced-code formatting | **Pass** |
| Popup permission-selection UI tests | **Pass** for simulated Chrome/Firefox |
| Locales | `pt-BR` and `pt-PT` passed; a combined third `en-US` run was interrupted by Playwright transport failure |
| ZIP package integrity, versions and permissions | **Pass** for Chrome and Firefox |

The synthetic nine-message scenario deliberately changes the virtualized scroll range in a way that would have looked like progress in v0.2.5. In v0.2.6, no new oldest message is captured, so the scan stops and marks the file partial instead of endlessly resetting its watchdog. This validates **bounded behavior**, not recovery of messages that ChatGPT never rendered.

## Pending acceptance

- Reproduce the real Chrome case with the same conversation and browser version. Determine whether the new immediate capture and scroll-container selection can reach the first actual user message.
- Repeat after blur/focus and in Firefox.
- If still blocked, copy only the numeric `window.__chatgptMdExporter.status()` fields described in [Troubleshooting](TROUBLESHOOTING.md); do not share full exports or private URLs.
- Reverify remote images, file downloads and native optional host permission dialogs on real browser builds.
- The complete conversation boundary remains a heuristic; check first/last turns manually.

No stable release or browser store submission is justified by these synthetic results alone.
