# Contributing to ThreadToMD

Thanks for helping keep ChatGPT conversation exports readable, local-first and as complete as the rendered page allows.

## Before opening an issue

- Check the [Troubleshooting guide](docs/TROUBLESHOOTING.md) and existing issues.
- Use the appropriate GitHub issue template (bug or feature request).
- **Never upload an unredacted chat export, credential, signed asset URL or screenshot with private text.** Reproduce the problem with synthetic content wherever possible.

## Make a change

1. Fork the repository and create a focused feature branch.
2. Read the [Developer guide](docs/DEVELOPMENT.md) and [Architecture](docs/ARCHITECTURE.md).
3. Make the smallest change that fixes the observed behavior.
4. If you modify DOM parsing, scrolling, ordering or image handling, add or extend a synthetic regression fixture.
5. Build packages and run the relevant tests (Node.js 22+ and Python 3):

   ```bash
   python3 scripts/build.py
   npm test
   python3 tests/e2e.py
   python3 tests/background_pause.py
   python3 tests/archive_e2e.py
   python3 tests/package_integrity.py
   ```

6. Open a pull request explaining the problem, approach, tests run and remaining limitations.

A full test matrix is documented in [Developer guide](docs/DEVELOPMENT.md). The full-duration `tests/slow-older.py` can be slow; please report its outcome accurately rather than marking it as passed without completion.

## Engineering principles

- Minimize permissions and keep export initiated by explicit user action.
- Preserve **both** Chrome and Firefox behavior from a single shared source.
- Do not add persistent conversation storage, telemetry, scraping of unrelated pages, external AI services or undocumented account APIs.
- Treat missing messages and attachments as visible failure states rather than silently claiming complete recovery.
- Maintain resource caps and fail closed for unsupported media/hosts.
- Keep Markdown, code fences, ASCII diagrams and relative asset links readable in GitHub/VS Code.
- Keep English as the default UI; `pt` and `pt-BR` use Brazilian Portuguese. Do not translate conversation contents.
- If updating UI text, update both runtime dictionaries and their tests.

## Review expectations

A good pull request includes a short summary, scope, linked issue (if any), relevant test output, and confirmation that no sensitive fixtures or new permissions were introduced without a documented reason. The [release checklist](docs/RELEASE_CHECKLIST.md) describes the additional manual tests required before store submission.

All contributions are accepted under the repository's [MIT License](LICENSE).
