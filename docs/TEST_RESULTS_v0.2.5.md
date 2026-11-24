# Test results - ThreadToMD v0.2.5

**22 November 2026 - experimental pre-release.** This fix addresses a reported Chrome scroll loop after loss and restoration of browser focus. Real ChatGPT browser acceptance remains pending in Chrome and Firefox.

## Local tests

| Check | Result |
| --- | --- |
| JavaScript unit suite, including popup consent and ZIP/relay checks | **35/35 pass** |
| Classic ChatGPT DOM fixture | **44/44 messages** |
| New Chat/Work virtualized DOM fixture | **88/88 messages** |
| Transient scroll-to-bottom rebounds (upward scan) | **88/88 messages** after 7 enforced rebounds |
| Persistent scroll-to-bottom rebounds | **PARTIAL**, bounded termination (14/88 messages; 37 scroll steps) |
| Loss of focus, re-focus, then 7 scroll rebounds | **88/88 messages**, normal completion |
| Loss of focus, re-focus, then persistent scroll rebounds | **PARTIAL**, bounded termination (16/88 messages) |
| Tab hidden -> resumed / window blurred -> resumed | **88/88** in both cases, no download while inactive |
| Delayed older-page loading (four asynchronous batches) | **160/160 messages** |
| Archive ZIP (local images, PDF, links and unavailable files) | **Pass** |
| Stalled older-page loader marked partial | **Pass** |
| ASCII diagram fenced-code integrity | **Pass** |
| Locales `pt-BR`, `pt-PT`, `en-US` | **Pass** |
| Chrome and Firefox ZIP packaging, manifests, locale and file paths | **Pass** |
| Popup automated Chromium UI test | **Pass** |

The scroll tests use synthetic fixtures with faster-than-production timeout settings. They verify the scan mechanism under these controlled conditions, not the full set of ChatGPT production behaviors or arbitrary page virtualization.

## Explanation of the fix

The scanner keeps a monotonic high-water mark of how far it traversed toward the oldest messages, plus the number of distinct messages captured. The high-water mark is **not reset** on focus restoration. Replaying previously seen messages after a browser-induced scroll reset is recovery, not new discovery. Persistent resets or motionless scroll attempts cannot continue indefinitely: they produce an explicitly marked partial export and a localized explanation. A small recovery nudge does not skip directly to the currently loaded top.

At a legitimate top boundary, periodic probes and the existing asynchronous wait continue; waiting for older content is not counted as a scroll loop. Markdown-only and Complete archive (ZIP) share the same scanner.

## Required browser acceptance

- In Chrome, export a known long conversation, switch to another application during scanning, then return. Check that the scroll continues to older content, reaches a plausible top, and captures the first user message.
- Repeat the same test in Firefox, checking both formats when possible.
- Check that two or more focus changes do not restart the export, and that the status accurately distinguishes completed from partial.
- Verify the first and last message and several intermediate turns. A heuristic terminal boundary is not proof of complete message retrieval.
- Recheck the first-time ZIP-permission popup and actual remote attachment downloads, because the native consent UI is not covered by these DOM fixtures.

Browser version changes and live ChatGPT layout changes can expose new regressions. Do not promote this pre-release as stable or guarantee 100% export completeness based on these synthetic tests alone.
