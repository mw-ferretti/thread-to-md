# ThreadToMD v0.2.1 - experimental asset download fix

## Changes

- Optional per-feature access to selected OpenAI/CDN hosts when exporting ZIP.
- Privileged cross-origin fetch in Chrome/Firefox background contexts.
- 48 KiB ACK-controlled binary relay, limited to 24 MiB per file.
- Ignore source-card favicons; add robust link discovery in attachment cards.
- Download filenames match UI locale, regardless of conversation title.

## Limitations

- Only known, authorized media hosts are fetched from the background relay.
- No direct URL, expired files, authentication errors, and unsupported hosts
  remain unavailable or retain original external references.
- Authentic ChatGPT media flows require browser acceptance testing.

## Verification

See automated tests in `tests/`; synthetic fixtures cannot validate that an
external service will accept its signed URLs. Keep as pre-release.
