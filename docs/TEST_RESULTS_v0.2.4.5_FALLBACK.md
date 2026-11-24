# Automated fallback test results (v0.2.4.5)

| Scenario | Status |
| --- | --- |
| Node unit test suite | 37/37 PASS |
| Standard automatic classic/New fixtures | 44/88 PASS |
| Delayed older loading | 160/160 PASS |
| Manual wheel capture Markdown and ZIP | 88/88 PASS each |
| Auto cycle -> assisted in same session (Markdown) | PASS, 2 preserved messages, partial output |
| Auto cycle -> assisted in same session (ZIP) | PASS, 2 preserved messages, partial manifest |
| Root replacement during assisted capture | PASS |
| Real-world automatic fallback | PENDING live user test |

The test fixture includes a virtualizer that repositions the timeline
backward every ~850px and adds no new messages; the test confirms bounded
handoff rather than repeated scrolling until the 20,000-step limit.
