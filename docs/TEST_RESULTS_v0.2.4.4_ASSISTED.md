# Assisted Capture Lab — verification record

Base: `v0.2.4` (`src/exporter.js` Git blob `fb5b7e1498e67b3ce59d2363ec7766187bd88d96`).

| Test | Outcome |
| --- | --- |
| Node unit suite, including popup & archive | PASS — 37/37 |
| Automatic legacy/classic fixture | PASS — 44 exported records |
| Automatic Chat/Work virtualized fixture | PASS — 88 exported records |
| Assisted Chat/Work fixture + Chromium native wheel, Markdown | PASS — 88 records, correct order, explicitly partial |
| Assisted Chat/Work fixture + Chromium native wheel, ZIP | PASS — 88 records, correct order, PNG archived, manifest partial |
| Assisted timeline DOM replacement + Finish button | PASS — records from both roots retained |
| Automatic ZIP archive fixture | PASS — images/docs embedded and unavailable assets reported |
| Chrome/Firefox distributable package integrity | PASS — exact source copied, unchanged permission set |
| Live authenticated ChatGPT | NOT TESTED here — manual validation required |
| Firefox browser execution | NOT TESTED here — package validation only |

The official v0.2.4 README in the source archive is preserved exactly as the repository's `main` Git blob `7c8ed60a6de48623beaa7264ee01e9119baba995`. The stable release has not been modified or republished.
