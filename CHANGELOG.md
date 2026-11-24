## [0.2.4.16] - Chrome native capture and compact popup (GitHub release preparation)

- Ship the v0.2.4.15 native Chrome capture engine (validated by the user on a real long conversation), **without changing its traversal or loop-recovery algorithms**. The production behavior delta from v0.2.4.15 is limited to popup UI and version metadata.
- Move the explanatory copy and Chrome debugger disclosure **below** the primary action so the export button appears immediately without scrolling in typical popup heights.
- Shorten popup labels, helper copy and option descriptions while preserving the key communication: Markdown vs ZIP, Chrome automatic vs assisted manual, local-only behavior, and temporary debugger access for native capture.
- Tighten spacing, typography and card padding to reduce overall popup height and improve first-glance fit in the browser action panel.
- Firefox still shows only the manual method; Chrome still defaults to the native automatic path. No permission or engine changes relative to v0.2.4.15. Current release notes: `docs/RELEASE_NOTES_v0.2.4.16.md`. Documentation and all branded screenshots refreshed for GitHub.

## [0.2.4.15] - v0.2.4.10 native motor + loop-only captured-scroll-widget detachment (experimental)

- **Exact v0.2.4.10 navigation baseline.** Normal Chrome native-wheel steps (160 px / 110 ms), `wheelPoint`, history edge/stabilization, native recovery delays and fallback behavior are otherwise unchanged. No sticky target, speculative waits or v11-v14 navigation adjustments.
- At the existing v0.2.4.10 native stall/cycle branch, optionally detach one visible code widget with confirmed internal vertical scroll **only if** its entire stable owner message is already in memory with identical canonical Markdown. Drain accessible ZIP assets before detachment.
- Limit to three detached widgets per run and count removals as recovery attempts. Restore the element via a temporary comment marker at the end if its original DOM position is still mounted. No removal during ordinary traversal or Firefox manual capture.
- Continue original bounded recovery/manual fallback if removal is unsafe or does not help. Removing React-managed DOM may still disrupt the ChatGPT UI; validate locally before publishing.
- Added tests with a supplied ChatGPT code-widget structure and negative safety cases. No new permissions; owner-customized README preserved byte-for-byte.

## [0.2.4.10] - Semantic viewport cycle detector (local experimental build, unreleased)

- Diagnose from the user's real Chrome screencast: the trusted wheel continues and `scrollTop` changes, yet the browser repeatedly revisits the same part of a long message while the unique-message count stops advancing. This was not detected by the v0.2.4.9 immobility/end-rebase guards.
- Detect recurring **visible message anchors and their timeline-relative offsets** during upward native capture. This distinguishes real progress inside a very tall message from oscillation between previously shown positions; avoid using changes in scroll height or absolute `scrollTop` as proof of progress.
- When a cycle is confirmed, use the existing bounded four-attempt native recovery and preserve the manual fallback on persistent obstruction; expose a numeric `ciclosNative` diagnostic. Normal 160px / 110ms wheel inputs and the 600px recovery cap are unchanged.
- Preserve the simplified browser choices: **Chrome Automatic / Assisted**, **Firefox manual only**. No new permissions, no GitHub publication, and no changes to the customized README.
- Add a trusted-CDP regression that reproduces a moving-scrollbar oscillation, a permanent oscillation and an oversized 17,000px message with genuine monotonic scroll. Results and limitations: `docs/TEST_RESULTS_v0.2.4.10.md`.

## [0.2.4.9] - Native wheel nested-scroll recovery and simplified choices (local build, unreleased)

- Chrome automatic remains browser-trusted wheel input (normal navigation **160 px / 110 ms**). When a large code block or other nested scroller covers the original seven target points, the exporter also searches timeline gutters using DOM hit-testing, avoiding nested scrollbars and unrelated overlays.
- On a confirmed non-edge stall, attempt up to four bounded recovery rounds. Reverse wheel nudges (240/320/480 px) and forward wheel retries (320/480/600 px) are interleaved with incremental message and asset capture. The Chrome debugger worker still rejects inputs over 600 px. No scrollTop writes were introduced in native mode.
- Detect three repeated rebases toward the newest end without newly captured content as a loop symptom; numeric height/scroll changes alone do not count as discovery. Exhausted recovery preserves content and switches to manual capture marked PARTIAL / UNVERIFIED.
- Remove the **Classic automatic (legacy)** option from the popup. Chrome presents **Automatic (Chrome)** and **Assisted (manual)**. Firefox offers **manual capture only**, including migration of saved automatic/native/legacy preferences; Firefox still has no debugger permission or Chrome native-wheel worker.
- Retain the classic engine internally for historical fixtures and comparison, but it is no longer selectable through the popup. No new permissions, network dependencies, or publication. The customized README remains byte-for-byte unchanged because it documents the published v0.2.4.
- Add real-CDP browser fixtures for a large nested code scroller and a stall requiring a >=320 px reverse nudge. Update popup, permission and package regressions. See `docs/TEST_RESULTS_v0.2.4.9.md`.

## [0.2.4.8] - Chrome native automatic is the default (local build, unreleased)

- Promote the browser-trusted native wheel engine proven in the user's Chrome conversation to **Automatic (Chrome)**, the default selection on Chrome. Retain the exact 160 px / 110 ms wheel transport and bounded recovery from v0.2.4.7.
- Keep **Classic automatic (legacy)** and **Assisted (manual)** as selectable alternatives; remove the experimental label from the popup, not the sensitive Chrome debugger permission disclosure.
- Respect deliberate saved assisted and explicit new legacy preferences. Migrate old Chrome `captureMethod=automatic` preferences (formerly the default classic engine) to the new native default. Legacy selections now persist as `captureMethod=legacy`, while the exporter internal method remains `automatic` for compatibility.
- Firefox retains classic automatic by default, with assisted capture available and **no `debugger` permission**. Native wheel input requires a separate, unimplemented browser-automation companion because Firefox WebExtensions do not implement Chrome's debugger API.
- Keep the Markdown/ZIP engine, automatic boundary heuristics, and user-customized README byte-for-byte unchanged. No GitHub publication.
- New tests assert per-browser defaults, permission-warning visibility, method migration and preference persistence.

## [0.2.4.7] - Experimental native-wheel stall recovery (unreleased)

- Real Chrome feedback: the native engine traversed 42 virtualizer rebases and captured 127 turns, then stopped after 50 stationary trusted wheel events. The user finished manually and exported 129 turns marked partial/unverified. This is **not** yet a verified complete automatic export.
- Replace the immediate non-edge stall fallback with four **bounded** recovery rounds: wait for delayed DOM updates, rotate hit-tested wheel targets inside the timeline, and on the third attempt issue a small browser-trusted reverse/forward nudge. No programmatic `scrollTop` writes in native mode.
- Expose native recovery and nudge counts in the in-page diagnostic status; keep the old auto mode, assisted mode and existing Markdown/ZIP pipeline.
- If a virtualizer remains permanently unresponsive, detach the debugger and switch to assisted without dropping previously captured messages or ZIP assets. Do not treat a stalled nonzero scroll position as proof of the oldest message.
- Add browser/CDP regression tests for an artificial wheel blockade released by a reverse nudge, and a permanent blockade. Both use `Input.dispatchMouseEvent` and assert safe end behavior.
- Keep Chrome debugger authorization **experimental**, Firefox without debugger, the public v0.2.4 unchanged, and the customized README byte-for-byte intact.

## [0.2.4.6] - Experimental Chrome native-wheel integration (unreleased)

- Added **Native automatic (Chrome · experimental)** capture method. It reuses the successful Chrome Native Wheel In-Tab Lab `Input.dispatchMouseEvent(type=mouseWheel)` command with 160 px wheel events every 110 ms; no `scrollTop` writes on this path.
- Scoped the privileged Chrome debugger session to the initiating ChatGPT tab, attached only while navigating, detached on stop, pause, navigation, idle timeout, or port disconnect. Browser remains in control of all consent/warnings.
- Uses the existing incremental DOM capture, message deduplication, ZIP asset collection, and final Markdown/ZIP export. It scans older, waits/probes at the oldest *loaded* boundary, then scans newer; chronology and completeness still need real-browser checks.
- Native interruptions switch to the existing assisted mode without discarding captured messages. The classic automatic and assisted modes remain available.
- Firefox packages do **not** request debugger permission or show the Chrome-only capture option.
- Added transport security tests and browser-native wheel end-to-end fixtures. Preserved the customized README unchanged.
- **Not a store release:** Chrome's debugger permission is highly sensitive; only use this build for local experiments.

# Changelog

## 0.2.4.5 - 2026-11-22 (experimental, not published)

- Detect automatic scrolling loops using **new/updated messages** as progress, not only scrollTop movement.
- Detect repeated opposite-direction jumps and no-new-message runs, including loops with constant scrollHeight.
- Switch the active export into assisted capture in-place, preserving records and temporary ZIP assets.
- Allow users to continue scrolling manually and Finish & save partial without restarting.
- Label the switch and incomplete boundary explicitly in the progress panel, Markdown and ZIP manifest.
- Add deterministic auto-cycle -> assisted handoff tests for Markdown and ZIP.
- Preserve the v0.2.4 automatic engine for successful scans, unchanged permissions, unchanged README.

## 0.2.4.4 - 2026-11-22 (experimental, not published)

- Add voluntary assisted capture with native user scrolling, partial status and manual Finish.
- Retain incremental DOM capture and Markdown/ZIP packaging from v0.2.4.

## 0.2.4 - 2026-11-19

- Reopen the toolbar popup automatically after a first-time ZIP permission grant if the native browser prompt closed it (Firefox 149+ and supported Chrome versions).
- Preserve Chrome's open popup during consent; a live-view port prevents duplicate reopenings.
- Record a one-shot permission handoff in `storage.session` with tab/window IDs and a timestamp (no conversation text or binaries); expire it after three minutes.
- Verify full optional origin grant, wait for native prompt dismissal, and never reopen an unrelated or inactive tab/window.
- Keep permissions optional, ZIP selection remembered, and export execution exclusively user-initiated.
- Add synthetic grant, denial, duplicate, stale intent, focus, retry, and consent-race tests.


## 0.2.3 - 2026-11-19

- Request optional media-host access **when the user selects ZIP**, rather than after pressing Export.
- Separate permission consent from the export command; already-granted permissions never prompt again.
- Work around Firefox's permission doorhanger being obscured by the toolbar popup:
  request in the radio's direct click handler, then close the popup and preserve ZIP selection.
  Reopen the toolbar after allowing or declining, then press Export.
- Keep Start disabled while the Chrome permission dialog is unresolved.
- If permission is declined, allow the archive to proceed with original links and a failure manifest.
- Remember only the selected export format in browser-local storage; never persist messages.
- Add cross-browser consent, denied-permission, reopening and stale async-check regression tests.
- Preserve the virtualized scanner, ZIP writer, asset relay and existing allowed hosts.


## 0.2.2 - 2026-11-19

### GitHub documentation refresh (no runtime changes)

- Reorganized README for a fast first-use path, clear privacy/limitations, and contributor onboarding.
- Updated versioned privacy/security documentation, store-submission guidance, and source layout.
- Added developer and troubleshooting guides, original GitHub/store artwork, and issue/PR templates.
- Refreshed screenshot assets to match v0.2.2.

### Runtime release

- Pause virtualized DOM scanning on tab invisibility or window focus loss; automatically resume on return.
- Reset edge-stability and stall counters after a pause or unexpectedly delayed timer.
- Ignore background time in initial-message loading and avoid saving until the tab is foregrounded.
- Add localized paused status, foreground resumption diagnostics, and browser regression tests.
- No additional permissions, no persistent storage, and unchanged attachment collection policy.

## 0.2.1 - 2026-11-08

- Fixed cross-origin media retrieval via a permission-gated, bounded background relay
  for Chrome Manifest V3 service workers and Firefox Manifest V3 background pages.
- Excluded favicons and small decorative site icons from the asset collector.
- Improved file-card URL recovery when a download link is nested in the card.
- Export filenames now use the UI locale instead of the language of the chat title;
  the original title remains unchanged inside Markdown.
- Added relay security, limits, error, naming, and ZIP regression tests.
- Retained the v0.1.2 virtualized scroll algorithm and the Markdown-only output path.

## 0.2.0 - 2026-11-08

- Added opt-in portable ZIP archives with local images, direct document downloads, and a machine-readable asset manifest.
- Registered and fetched transient visible assets before scrolling away; ZIP uses bounded concurrency and standard STORE/CRC32.
- Preserved original references when inaccessible; unsupported attachments are explicitly reported.
- Kept Markdown-only mode and the V4.2 scroll scanner, with a fix for DOM indentation before image Markdown.
- Added synthetic archive, ZIP integrity, duplicate-image, timeout, and permission tests.


## 0.1.3 - 2026-11-08

- Localized the popup, floating progress panel, errors, and exported Markdown metadata in English and Brazilian Portuguese.
- Explicit language selection: `pt` and `pt-BR` display Portuguese; English (`en`, `en-*`) and any other locale, including `pt-PT`, use English.
- Added WebExtensions `_locales/en` and `_locales/pt_BR` resources, with `default_locale: en` for extension metadata.
- Shared on-demand locale runtime is injected before the exporter in both Chrome and Firefox.
- Preserved the V4.2 scrolling and content parsing logic, minimal permissions, and automatic popup dismissal.


## 0.1.2 — 2026-11-08

- Fixed premature success at the oldest *currently loaded* ChatGPT page: v0.1.1 could stop after four quiet seconds, omitting earlier turns.
- Added patient top-boundary detection, periodic small scroll probes to retrigger older-page loaders, and a bounded timeout that flags failures as partial.
- Record heuristic (not independently verified) first-message completeness in Markdown metadata.
- Added a regression fixture requiring repeated entry into the scroll top and 4.8 seconds of async latency for each of four older-page batches.
- Preserved Firefox/Chrome popup close and root-relative script path fixes, code fences, and minimal permissions.

## 0.1.1 — 2026-11-08

- Fixed Firefox injection by making the exporter path extension-root-relative (`/src/exporter.js`); use the same path in Chrome.
- Close the popup automatically after a successful injection in both browsers, keeping on-page progress visible.
- Keep the popup open to display a useful error when injection fails.
- Added popup behavior and package integrity regression tests; unchanged V4 export/ASCII logic.

## 0.1.0 — 2026-11-06

- First Manifest V3 Chrome/Chromium/Firefox extension packaging.
- Preserved virtualized history scanner and incremental message capture from V4 engine.
- Preserved Markdown fenced ASCII diagram formatting.
- On-demand injection with `activeTab`/`scripting`; no persistent site permissions or network use.
- Added offline build, privacy policy, automated smoke and synthetic browser regression tests.
