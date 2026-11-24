# Automatic-scroll cycle watchdog (v0.2.4.5 experimental)

## Browser evidence

In the authenticated Chrome Chat/Work layout, user-directed wheel scrolling
loaded 30 distinct turns in one experiment; repeated 40px `scrollTop` moves
replayed a two-turn window over 150 steps and six large reverse jumps. The
v0.2.4 automatic scanner treated **any changed scrollTop** as progress and
reset its stall watchdog after every snap-back. The primary timeline selector
was correct. This experiment cannot prove that other chats or browser
versions behave identically.

## New behavior

The automated scanner tracks a window of attempted moves without new/updated
captured records, and tracks large **reverse-direction** scroll jumps. A safety
handoff is triggered after either:

- At least 24 moves without captured record progress and at least 3 reverse
  jumps since the last record progress, or
- 160 consecutive moves with no captured record progress even without
  recognizable reverse jumps, or
- 15 consecutive attempts with no positional movement and no record progress.

On handoff ThreadToMD stops all automatic scroll commands, keeps the same
in-memory records/order and ZIP collector, sets the export status PARTIAL,
changes the floating control to **Finish & save partial**, and starts the same
assisted DOM/wheel capture loop already validated in v0.2.4.4.

**Continue physically scrolling to the oldest message and then back to the
newest; only then click Finish & save partial.** Do not close/reload the tab.
If you are already in Assisted mode, behavior does not change.

The fallback does not establish true conversation completeness, monotonicity
of the ChatGPT scroll bar, or guaranteed order across disjoint virtual windows.
Exported Markdown/ZIP records the automatic-cycle fallback and marks the
result partial/unverified. No new browser permissions or telemetry.

## Test coverage (synthetic / local)

- Node unit tests: 37/37.
- Standard automatic classic/new ChatGPT mock conversations: 44/88 messages.
- Slow-load older pages mock: 160/160 messages in 4 asynchronous batches.
- Assisted Chromium mouse wheel: Markdown and ZIP 88/88 messages, correct order.
- Looping virtualized page: automatic stops looping; existing record is
  preserved; subsequent newly mounted record is captured in assisted mode;
  both Markdown and ZIP save 2 records and mark partial.
- Package integrity: Chrome and Firefox ZIP contents, versions, and unchanged
  minimal permission set validated.

The looping behavior has **not** been verified with the patched automatic
engine in an authenticated live ChatGPT conversation. It needs a real Chrome
trial before promotion to a release.
