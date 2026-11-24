# ThreadToMD v0.2.4.7 — Chrome native-wheel integration (experimental)

**Scope:** local testing, not for the Chrome Web Store or Mozilla Add-ons. The public v0.2.4 and the user's customized README are unchanged.

## Why

The ChatGPT Chat/Work virtualizer can move `scrollTop` from a near-top position directly to `maxScroll` after DOM mutations. The classic engine interprets numeric movement as navigation, but repeatedly revisits the same rendered turns. The separate Native Wheel In-Tab Lab successfully issued 600 browser-trusted wheel events, discovered 11 distinct turn IDs and continued past four virtualizer rebases. The lab **did not prove end-of-history completion**: it stopped at the configured event limit.

## Three capture methods

- **Native automatic (Chrome, experimental):** Chrome `debugger` API sends `Input.dispatchMouseEvent` with `type: mouseWheel`, `deltaY: -160` for older and `+160` for newer, 110 ms between commands. Coordinates target the ChatGPT timeline and avoid nested scroll containers where possible, exactly as in the successful lab.
- **Assisted:** user uses physical mouse or keyboard; incremental DOM observer captures and deduplicates; user finishes a partial/unverified export.
- **Automatic (original):** unchanged `scrollTop`-driven two-pass engine, with its loop-to-assisted protection.

## Chrome install and test

1. Extract `dist/threadtomd-chrome-0.2.4.7.zip` into an empty folder.
2. In Chrome `chrome://extensions`, enable Developer mode and select **Load unpacked**, pointing at that folder. Disable earlier ThreadToMD experimental builds first to avoid running multiple exporters.
3. Allow Chrome's extension permission warning only if comfortable with the sensitive `debugger` permission. The permission exists for the extension while installed, although code only attaches to the selected tab for the duration of navigation.
4. In your usual authenticated Chrome profile, open a long ChatGPT conversation and go to its newest message.
5. Open ThreadToMD, select **Native automatic (Chrome · experimental)** and Markdown (or ZIP), and start. Keep the tab in the foreground. Do **not** open DevTools on the same tab during native scanning, since that can detach the debugger.
6. The Chrome debugging banner while scanning is expected. The tool drives *upward* wheel input, waits for asynchronous older-page loads at the apparent top, then drives *downward* wheel input. It uses the original newest visible message as a return anchor where possible.
7. After the download, check first/last messages, order and gaps. The Markdown/ZIP header explicitly labels the automatic boundary **heuristic**, not independently verified.
8. If native scanning loses the debugger, it detaches and switches to the same assisted-capture session without dropping captured turns. Complete manually and press **Finish & save partial**.
9. Uninstall the experimental build after testing; keep the published version unchanged.

## Permission boundary

The Chrome-only worker uses `activeTab`, `scripting`, `storage`, and **`debugger`**. `debugger` is intentionally a required permission for this **experimental build** (it cannot be requested ad hoc as an optional Chrome permission). The native worker attaches solely to the initiating extension content script's `sender.tab.id` after verifying that both sender and current tab use HTTPS on `chatgpt.com` or `chat.openai.com`. Only a bounded wheel command is accepted, with direction ±1, pixels 20–600 and CSS pixel coordinates. No network debugging domain is enabled; no page text, cookies, token, message IDs or network requests are read by the native worker. Attached sessions detach on completion, stop, navigation away, pause (foreground lost), idle timeout or sender port disconnect. User's browser shows a visible debugging warning while active.

Firefox builds omit the permission and the Chrome-only background worker and hide the native capture option; classic automatic and assisted continue to work.

## Data fidelity and end conditions

`src/exporter.js` remains the single parser and archive writer. The native loop invokes the same `capture()` and archive drains and keeps a MutationObserver on the timeline. It does not write `scrollTop` nor call `dispatchEvent(new WheelEvent(...))`. Upward scanning keeps sending native wheel input at the apparent top, waiting 24 s of quiet, at least three probes 6 s apart, and no loading indicators before considering the loaded history stabilized. When older pages mount, the timer resets and scrolling continues. Downward scanning waits for the original newest turn to reappear and a 4 s quiet edge (when a stable key exists). Both limits are **best-effort** heuristics. Very large conversations may require long scans, and the 20,000-event bound can lead to assisted fallback.

The real Chrome ChatGPT environment may differ from the fixtures. **Do not assume full completeness solely from a successful download**. Verify the first and last messages, message order, attachments and gaps before using exports as authoritative archives.

## Tests

- `node --test tests/*.test.mjs` for the native transport, popup, archive, i18n and security boundaries.
- `python3 tests/native_auto_e2e.py` in locally available Playwright+Chromium: makes real CDP wheel events in a virtualized Chat/Work fixture and checks 88 ordered messages exported as Markdown and ZIP.
- `python3 tests/native_fallback_e2e.py` for interrupted-debugger recovery in Markdown and ZIP.
- `python3 tests/e2e.py`, `python3 tests/assisted_e2e.py`, `python3 tests/auto_loop_fallback.py`, `python3 tests/archive_e2e.py` for regressions.
- `python3 scripts/build.py && python3 tests/package_integrity.py` for both browser distributions.

The underlying Firefox and original automatic modes are not changed except for native mode selection UI and library version metadata.

## Recovery from a temporarily stationary virtualized window (v0.2.4.7)

Real Chrome feedback on v0.2.4.6 showed 3,850 trusted wheel events, 42 virtualizer repositionings and 127 captured messages before the native engine entered assisted fallback with `Native wheel stalled away from the edge`. The user then reached 129 messages using manual input and downloaded a partial/unverified export. This shows that native scrolling works, but the original 50-stationary-wheel abort can fire prematurely.

The experimental recovery now keeps the same `mouseWheel` input contract (160 px / 110 ms) but, after 18 stationary **non-edge** wheel commands, tries up to four bounded recovery rounds:

1. Wait for delayed DOM/virtualizer activity while continuing to capture and drain temporary archive assets.
2. Rotate through hit-tested points inside the conversation timeline, rejecting nested scrollable regions and unrelated overlays.
3. In the third round only, send a 100 px browser-trusted wheel *opposite* to the desired direction, capture the resulting DOM, and send an ordinary browser-trusted wheel forward to re-arm edge/observer logic.
4. If the timeline still cannot move after the final round, close the debugger session and hand off to assisted capture. Never claim completeness from a stalled coordinate.

No new browser permissions were added relative to v0.2.4.6. The original `scrollTop`-based mode is untouched. This is a bounded recovery strategy, **not a promise** that all real ChatGPT hangs can be resolved. The actual oldest and newest message still need human verification, and unanchored virtual windows remain a risk.

## Chrome default selection — v0.2.4.8

The user's real Chrome test of v0.2.4.7 reported that native automatic capture was working well. In v0.2.4.8, **Automatic (Chrome)** is therefore selected by default, without changing the input geometry, timing, recovery or capture semantics. The UI no longer labels the option experimental, but this remains a **locally tested, unpublished build**: distributing an extension with Chrome's sensitive `debugger` permission requires careful security/review decisions. The Chrome permission warning remains prominently visible whenever the native mode is selected.

The **Classic automatic (legacy)** option remains available for comparison. Previous Chrome `threadtomd.captureMethod=automatic` preferences now select the native default, because the old value represented the former default, not a deliberate opt-in to legacy behavior. Choosing legacy in this version saves the explicit value `legacy`; choosing assisted saves `assisted`. Firefox continues selecting the classic automatic engine by default; the native radio is hidden, and the Firefox package contains no debugger permission/worker.

The user's real-browser success does **not** independently verify missing-history completeness. Continue checking first/last messages, message counts and gaps before treating an export as authoritative.

For equivalent Firefox wheel automation and its prerequisites, see `CHROME_DEFAULT_AND_FIREFOX_OPTIONS.md`.

## Nested-scroll recovery and UI simplification — v0.2.4.9

The normal trusted wheel geometry is unchanged. Long nested code blocks can cover all seven original sample points; the exporter now hit-tests additional narrow gutters inside the main timeline and rejects points targeting a nested scrollable element or unrelated overlay. A stalled region triggers larger but bounded reverse/forward native wheels, with capture and archive draining between them. Three repeat jumps near the newest edge with no newly captured content are treated as a loop symptom, not progress. Exhausting recovery still falls back safely to manual.

The classic automatic choice was removed from the popup, Chrome retains native automatic and manual, and Firefox exposes only manual capture. See `CHROME_DEFAULT_AND_FIREFOX_OPTIONS.md` and `TEST_RESULTS_v0.2.4.9.md`.

## Chrome viewport-cycle correction — v0.2.4.10

The real screencast of v0.2.4.9 exposed an unrecognized loop: the scrollbar keeps moving between previously displayed regions without adding messages. The original immobility watchdog does not fire. The native engine now observes repeated semantic viewport fingerprints (oldest/newest unit identities plus oldest node's timeline-relative offset), triggering the existing bounded recovery and preserving manual fallback. An oversized message with monotonic progress must not be mistaken for a loop. See `TEST_RESULTS_v0.2.4.10.md` and `tests/native_oscillation_e2e.py`.

## v0.2.4.15 / v0.2.4.16 continuation

The user later validated the v0.2.4.15 loop-only widget detachment in a real Chrome conversation. The recovery is bounded and only affects a previously captured scrollable code widget. The v0.2.4.16 release retains this navigation implementation unchanged, adds a compact popup and updates release documentation. See [release notes](RELEASE_NOTES_v0.2.4.16.md) and [test evidence](TEST_RESULTS_v0.2.4.16.md).
