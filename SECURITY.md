# Security policy

ThreadToMD processes conversations that may contain private or confidential data. Security reports and example exports must therefore avoid exposing conversation contents, signed file URLs, browser secrets and other personal information.

## Reporting a vulnerability

Once the project is on GitHub, use the repository's **private vulnerability reporting** feature if enabled. Do not publish an exploit or confidential material in a public issue. If private reporting is not yet available, open a non-sensitive issue requesting a private contact route, without including exploit details or files.

The project does not promise a disclosure SLA or a paid bounty program.

## Security model

- The extension runs on a single selected ChatGPT tab only after a user action; it does not run a background crawl of browsing activity.
- Bundled scripts are local. No telemetry, third-party tracking or remote executable code is part of the application.
- ZIP mode uses a user-consented, HTTPS-only allowlist for original asset hosts. The background relay rejects unapproved hosts and messages from non-ChatGPT pages.
- Asset transfers are limited by size, concurrency and time; streamed chunks require acknowledgements. Redirects to unapproved hosts and HTML/SVG masquerading as binaries are rejected.
- ZIP paths are sanitized and local references are created only for successfully downloaded files.
- No browser cookies API, browsing-history API, all-sites permissions or persistent conversation storage are requested.

The extension does not bypass host authentication or guarantee that source URLs remain accessible. The user is responsible for the security of downloaded archives. See [Privacy](PRIVACY.md) and [Architecture](docs/ARCHITECTURE.md).

## Before a public release

Enable GitHub private vulnerability reporting, verify permissions on both generated packages, and test with synthetic data. Do not commit actual exported conversations or their manifests to the source repository.
