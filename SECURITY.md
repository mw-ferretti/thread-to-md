# Security policy

ThreadToMD processes conversations that may contain private or confidential data. Security reports and example exports must therefore avoid exposing conversation contents, signed file URLs, browser secrets and other personal information.

## Reporting a vulnerability

Use this repository's **private vulnerability reporting** feature if enabled on GitHub. Do not publish an exploit or confidential material in a public issue. If private reporting is not yet available, open a non-sensitive issue requesting a private contact route, without including exploit details or files.

The project does not promise a disclosure SLA or a paid bounty program.

## Security model

- The extension runs on a single selected ChatGPT tab only after a user action; it does not run a background crawl of browsing activity.
- Bundled scripts are local. No telemetry, third-party tracking or remote executable code is part of the application.
- ZIP mode uses a user-consented, HTTPS-only allowlist for original asset hosts. The background relay rejects unapproved hosts and messages from non-ChatGPT pages.
- Asset transfers are limited by size, concurrency and time; streamed chunks require acknowledgements. Redirects to unapproved hosts and HTML/SVG masquerading as binaries are rejected.
- ZIP paths are sanitized and local references are created only for successfully downloaded files.
- Chrome's sensitive `debugger` permission is used by the native automatic method to send trusted wheel input to the **initiating ChatGPT tab**; the background worker checks the tab origin/navigation and detaches on completion/interruption. Firefox does not contain this worker or permission.
- A confirmed scrolling-widget loop may cause temporary, bounded detachment of a **previously captured** React-managed code widget. It is best effort, can disrupt the live view, and may be recovered by reloading ChatGPT; it is not a remote modification or an account-level action.
- No browser cookies API, browsing-history API, all-sites host permission or persistent conversation storage is requested.

The extension does not bypass host authentication or guarantee that source URLs remain accessible. The user is responsible for the security of downloaded archives. See [Privacy](PRIVACY.md) and [Architecture](docs/ARCHITECTURE.md).

## Before a public release or browser-store submission

Review the actual two distributions separately; Chrome has privileged `debugger`, Firefox does not. Check real-browser behavior and synthetic fixtures, consider the implications of editing React-controlled nodes, and follow browser-store policies for powerful permissions. Do not commit actual exported conversations or manifests to the source repository.
