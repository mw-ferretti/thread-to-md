# ThreadToMD v0.2.1: test evidence

Date: 2026-11-08. Automated checks run against synthetic fixtures.

## Checks passing

- Node test suite: 20/20 passed.
- Browser fixture: classic conversation 44/44 messages.
- Browser fixture: new Chat/Work 88/88 messages.
- UTF-8/ASCII diagrams preserve line breaks and column alignment.
- Timed-out synthetic scan is identified as partial.
- ZIP E2E: valid CRC, 2 saved images (one deduplicated), 1 PDF and 2 missing assets reported.
- Cross-origin relay fixture: remote PNG saved after background fetch; 320 KB PDF transferred with chunk acknowledgements.
- Cross-origin relay security: unknown origins blocked without network request.
- Locale filename tests: pt-BR -> `conversa-chatgpt-*`; pt-PT/en-US -> `chatgpt-conversation-*`, even with a Portuguese conversation title.
- Optional permission tests: Markdown mode does not request hosts; ZIP mode does; denial leaves text export available.
- Chrome/Firefox package integrity and manifest verification.

## Still requiring real browser acceptance

- Browser-level installation, permission prompt and background fetch from actual ChatGPT media/CDN hosts.
- User-uploaded attachments, signed or expired direct links, and ChatGPT-generated file cards with no href.
- Full-session scroll behavior in the current ChatGPT app shell on Firefox and Chrome, beyond the synthetic fixtures.

**Status: v0.2.1 pre-release.** Passing fixtures are not evidence that every remote asset can be archived.
