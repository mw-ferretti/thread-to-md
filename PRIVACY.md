# Privacy policy

**ThreadToMD - Chrome and Firefox browser extension**

Last reviewed: **2026-11-24** (v0.2.4.16 release preparation)

ThreadToMD processes the open ChatGPT conversation **only when the user explicitly starts an export**. It generates a Markdown file or optional ZIP archive locally in the browser. This project is independent of OpenAI.

## What the extension accesses

- Rendered user and assistant messages in the **active conversation tab**.
- Images and direct document references that appear in those rendered messages, if the user selects **Complete archive (.zip)**.
- Original asset URLs, which may include signed or expiring parameters.

ThreadToMD does **not** read browser passwords, cookies through the cookies API, browsing history, other conversation tabs, account files or saved sessions. It does not use a developer-operated backend, analytics, telemetry, advertising networks, or persistent conversation storage.

## How data is used

**Markdown-only export:** conversation content is converted to Markdown within the selected tab, then downloaded via the browser. No asset-download host permissions are requested for this mode.

**Complete ZIP export:** the extension additionally requests identified assets from their **original hosting services**. A narrowly scoped optional host permission prompt is shown **when the ZIP option is first selected** for compatible OpenAI/CDN domains. In Firefox the extension popup closes to reveal the native prompt. After permission is granted, it attempts to reopen the popup automatically (supported in Firefox 149+). The ZIP selection is preserved even if manual reopening is needed. Download requests are handled by the extension background context, not a ThreadToMD server. First-party ChatGPT asset requests may use the browser's current session automatically; third-party requests omit credentials. The extension does not read or collect authentication tokens itself.

Those file hosts may receive normal network request metadata (for example, IP address, requested URL and any authentication information automatically sent by the browser for first-party requests). ThreadToMD does **not** send your conversation to its developer.

## Permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access to the user-selected chat after clicking the toolbar action |
| `scripting` | Inject bundled export code into that tab |
| `storage` | Keep a single short-lived popup-restoration intent in browser session memory after optional permission consent |
| Chrome-only `debugger` | Send browser-trusted wheel events to the initiating ChatGPT tab while automatic capture is active; no Firefox debugger permission |
| Optional allowed media hosts | Fetch accessible original images/documents when the user chooses ZIP mode |

Optional permissions may persist until revoked in browser extension settings. No `downloads`, `cookies`, `history` or all-sites host permission is requested.

## Chrome native capture and temporary page changes

Chrome automatic mode uses the browser's `debugger` capability on the selected ChatGPT tab, while the user-requested export runs. This is a powerful permission; the implementation restricts its use to an initiating ChatGPT tab, checks navigation and detaches on completion/interruption. Chrome may show a native debugging banner. Firefox does **not** request this permission and offers manual capture instead.

If the ChatGPT timeline enters a confirmed scroll loop on a previously captured code widget, the extension may temporarily detach that widget from the **local DOM**, keeping the message content in export memory. This is not a network request or persistent edit to ChatGPT. It restores the element where possible when the run ends, but React may reconstruct or change the view. The user can reload the original chat if necessary.

## Storage, retention and sharing

The extension stores two local preferences: the selected output format (`markdown` or `archive`) and the preferred capture method on Chrome (`native` or `assisted`). Firefox always uses assisted/manual capture, even if an old preference says otherwise. The preferences can be changed through the popup. When an archive permission request begins, the extension temporarily remembers only the initiating tab ID, window ID, and time in `storage.session` memory; it is cleared after processing and expires after three minutes. It never stores chat text, file bytes or tokens in that preference. Messages and asset bytes are kept in browser memory only while the export runs. The extension does not create persistent databases or send archives to a remote service. The resulting `.md` or `.zip` is saved under the user's control through the browser download mechanism.

**Your exported files may contain sensitive personal or business content, file names and original signed URLs.** Review and redact them before uploading to GitHub, filing issues or sharing with others. Asset failure records in `manifest.json` can still contain source descriptors; treat the manifest as part of the private archive.

## Limits and availability

Files with expired or unauthorized URLs, inaccessible HTML-only attachment cards, unsupported media, private origins or excessive size may not be archived. The extension records failed/missing assets and does not reconstruct them through undocumented endpoints. A completed message scan is based on observed page stability and does not guarantee an independently verified account backup.

## Changes and questions

Changes to data handling should be reflected here, in the extension UI and in browser-store declarations before publication. Use the [GitHub issue tracker](https://github.com/mw-ferretti/thread-to-md/issues) for non-sensitive questions and the private security-reporting mechanism for vulnerabilities.
