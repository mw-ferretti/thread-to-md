# ThreadToMD v0.2.4.7 — native stall recovery validation

## Real-browser observation prompting this build

In the user's Chrome, native automatic v0.2.4.6 ran 3,850 trusted wheel events, crossed 42 virtualizer rebases and captured 127 messages. It entered assisted fallback with `Native wheel stalled away from the edge`. The user continued manually and exported 129 turns **PARTIAL / UNVERIFIED**. No automatic end-of-history completion was established.

## Controlled regression tests

- `node --test tests/*.test.mjs`: 44/44 passed (existing unit, popup, transport and security tests).
- `python3 tests/native_stall_recovery_e2e.py`: native CDP wheel blockade released by reverse input; recovery invoked at least 3 times, reverse/forward nudge exercised, 88/88 messages exported; permanent blockade switched to assisted after exactly four bounded recovery rounds, existing turns preserved.
- `python3 tests/native_auto_e2e.py`: 88 ordered messages in Markdown and ZIP, trusted browser wheel events; ZIP contains an image.
- `python3 tests/native_fallback_e2e.py`: debugger denial -> assisted in Markdown and ZIP, preserving message content.

These tests use fixture pages in headless Chromium, not the authenticated ChatGPT interface. Only a real Chrome trial can confirm that the v0.2.4.7 stall recovery succeeds in the reported window. The version remains experimental and should not be published to extension stores with its sensitive `debugger` permission.
