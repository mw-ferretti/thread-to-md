# ThreadToMD v0.2.4.10 — Chrome screencast analysis and experimental verification

Date: 2026-11-23. Baseline: **v0.2.4.9** (local experimental build). No published GitHub tag has been modified.

## What the real screencast supports

In `Screencast From 2026-11-23 19-22-02.mp4`, the Chrome debugger banner remains present, the ThreadToMD native mode continues reporting trusted wheel input, and its message count moves from 54 to 55 but then stops increasing while the step count reaches at least 550 and the native rebase counter reaches 22. The visible content repeatedly returns to a previously displayed portion of a technical message. The recording ends with a *partial* export of 58 messages. The screencast does not expose the source DOM or the exact wheel target, so the nested-code-block explanation remains a hypothesis.

The v0.2.4.9 engine only detected (a) stationary `scrollTop`, (b) certain direct jumps toward the newest edge, or (c) very long no-novelty timeouts. A page that alternates between two non-edge positions can satisfy none of these conditions. In addition, the old `noNovel` counter was reset by virtualizer height changes or a changed visible key; neither proves discovery of an older message.

## Focused change

1. `capture()` includes the oldest rendered unit's pixel offset relative to its scrolling timeline. This offset changes as the viewport traverses a *single very tall message*, even if the unique-message count does not change.
2. During **upward Chrome-native traversal**, the controller samples fingerprints of the visible oldest/newest message keys and the quantized oldest-unit offset. It recognizes recurrence only after multiple separated observations spanning at least 20 native-wheel steps. It deliberately does not use absolute scrollbar coordinates or `scrollHeight` in this fingerprint.
3. A detected cycle enters the same bounded recovery used by v0.2.4.9; successful new content clears the observations. Persistent cycles enter the existing manual/partial fallback. The `__chatgptMdExporter.status()` object now reports numeric `ciclosNative`.
4. Normal Chrome-native scrolling remains **160 pixels per event / 110 ms**. The Chrome-only `debugger` permission is unchanged and Firefox remains manual-only. No writing to `scrollTop`, no synthetic `WheelEvent`, no network permissions added.

## Tests performed (Chromium + real CDP wheel input)

- Moving scrollbar that oscillates around two non-edge positions: **PASS**, recovered by native mode after 3 recovery attempts, exported all 88 fixture messages in order.
- Permanent moving-scrollbar oscillation: **PASS**, fell back safely to manual after four bounded recoveries (124 trusted wheel events in accelerated test), retained the partial content.
- Single 17,000px-long message with no new turns: **PASS when run alone**, traversed upward and downward without erroneously triggering cycle recovery, exported 2 messages without a PARTIAL flag.
- `npm test`: **48/48 passed**.
- These cases are controlled browser fixtures, not reproductions of the ChatGPT service's internal virtualizer. The combined local browser test runner exhibited an environment-specific hang when repeatedly launching Chromium sessions. The individual browser scenarios passed in separate invocations using `python3 tests/native_oscillation_e2e.py <scenario>`; CI invokes each scenario as a distinct command. The combined CI step was not executed in this environment.

## Pending

- Real Chrome: validate that native automatic reaches the first message of the user's long conversation after the previously blocked region, then completes the descent with correct first and last turn. The UI has no authoritative total message count, so a complete status is still heuristic.
- Confirm the simplified popup and ZIP export work with the installed package. Firefox manual behavior is unchanged from v0.2.4.9 and was not revalidated on a real Firefox browser here.
- The GitHub README remains unchanged, and the public v0.2.4 tag is untouched. This build is experimental, not store-ready.
