# ThreadToMD v0.2.2 — Background tab safety

**Status: Experimental release for manual browser validation.**

## Changes

- Pause the incremental virtualized-DOM scan whenever the conversation tab is hidden or its browser window loses focus.
- Keep already collected messages and queued assets in memory; resume automatically when the user returns to the conversation.
- Reset stability/timeout counters after returning from an inactive interval or after an unusually delayed timer.
- Prevent a background interval from triggering a premature complete/partial export.
- Localized pause status for English and Brazilian Portuguese, with no new permissions or storage.

## Expectations

- **The exporter may wait for the foreground tab:** switching to another application is safe, but background execution/completion is not promised.
- Keep the conversation tab open. Browser discarding/reloading the tab can discard the in-memory run.
- Capture correctness still depends on the ChatGPT DOM and does not independently verify the first message.

## Tests in synthetic Chromium

- 20/20 JavaScript unit tests.
- Legacy 44/44 and Chat/Work 88/88 messages.
- **New:** hidden page (after reaching older-page probes) -> no premature export -> resume 88/88.
- **New:** unfocused browser window -> no premature export -> resume 88/88.
- **New:** accelerated delayed-loader fixture with four batches -> 160/160 messages.
- ZIP: images, PDF and relative links validated; inaccessible attachments recorded.
- `pt-BR`, `pt-PT`, `en-US` locale tests passed.
- Stalled older loader correctly marked PARTIAL.
- The full-duration delayed-loader test did not complete inside the time budget in this environment. Its accelerated variant passed, but this is not a replacement for manual testing with long real conversations.

## Manual acceptance

Install the Firefox and Chrome ZIPs in developer mode, start a long chat export, switch to another application for longer than 30 seconds, return to the conversation, and verify that scanning resumes. Confirm the first/last messages and locally embedded images/documents before publication.
