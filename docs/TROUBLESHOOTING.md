# Troubleshooting

This page covers common issues in ThreadToMD v0.2.4.16. Check your browser's developer console for additional diagnostics, but remove private conversation text and signed URLs before sharing logs.

## The extension is disabled or says to open a conversation

Open a **specific** chat on `https://chatgpt.com/` or `https://chat.openai.com/`. Reload the chat tab after installing the extension. It does not export from the ChatGPT home screen or arbitrary websites.

## Chrome will not load the ZIP

Do not select the ZIP directly in **Load unpacked**. Extract it first, open `chrome://extensions/`, enable **Developer mode**, and select the folder that contains `manifest.json`.

## Firefox loaded the extension, but it disappears after restart

Firefox's **Load Temporary Add-on** is a development feature. Reload `manifest.json` in `about:debugging#/runtime/this-firefox` after restarting. Permanent installation requires an appropriately signed Firefox build.

## The popup says it could not start

Update to the latest matched Chrome/Firefox package and reload the extension. The popup injects root-relative bundled scripts, including `/src/exporter.js`. In Firefox, a stale package with a relative path can otherwise look for `popup/src/exporter.js`.

## The Chrome automatic export appears paused

Chrome automatic capture deliberately pauses when the chat tab is hidden or the browser window loses focus. **Return to that conversation** to resume. Keep the tab open; reloading or closing it discards the in-memory capture. Manual mode (the only Firefox mode) requires you to navigate the history yourself and click Finish.

## The Chrome debugger permission or browser banner appears

This is expected **only for Chrome automatic**, which uses Chrome's sensitive `debugger` permission to deliver native wheel events to the selected tab. The extension attempts to detach after finishing/stopping or when the page navigates. It does not request debugger access in Firefox. Do not inspect the same chat tab with DevTools during an automatic capture; use the manual option if you do not want to grant this capability.

## Native automatic export loops or the ChatGPT layout shifts

ThreadToMD detects repeated viewport cycles and may temporarily detach a code widget **only after its entire owner message has already been captured**. The operation is bounded and restoration is best effort. The site controls its React DOM, so the chat may visually remount or change after a recovery. If scrolling is still blocked, use the assisted fallback and explicitly review the partial/unverified export. Reload the chat after exporting if the UI looks inconsistent; never claim a successful scan was independently verified.

## Firefox: where is the automatic method?

Firefox intentionally offers **manual capture only**. Open the chat, click **Start assisted capture**, scroll to the earliest message, then back to the latest, and click Finish. The Chrome native wheel mechanism and its `debugger` permission are not bundled in Firefox.

## The Markdown is missing older or newer messages

The conversation may not have loaded its full history, or the DOM may have changed. Compare the **first and last messages** with the source. Check the output metadata for a partial/stalled status; do not treat a heuristic completion marker as an authoritative count. If reproducible, report a sanitized sample and browser version using the bug report template.

## Diagrams or code blocks do not look right

View the Markdown in a renderer that supports fenced code blocks with a monospaced font (for example, GitHub or VS Code). If spaces are lost **inside** a fence, report a synthetic minimal diagram, not a confidential project diagram.

## ZIP is selected but the export does not start after permission consent

**Permission consent and exporting are separate actions.** Choose **Complete archive (.zip)** once, approve the browser dialog, then click **Export current conversation**.

**Firefox 149+:** the extension popup closes when requesting permission so the native dialog remains visible. After you **allow** access, ThreadToMD attempts to reopen the popup automatically, with ZIP already selected. If the popup does not reopen (for example because focus changed or a browser version blocks it), click the toolbar icon manually. After a **denial**, reopening may require a manual click. **Chrome:** the popup normally remains open; if it is closed by the browser, the same background restoration mechanism attempts to bring it back after permission is granted.

If you decline host access, a ZIP export can still include Markdown and original links, but inaccessible media will appear as missing in `manifest.json`. Click the ZIP option again to retry authorization. **Already granted access persists through extension updates**; to test first-time consent, revoke the optional site permissions in the browser extension settings or use a clean profile.

## No files appear under `assets/`

Choose **Complete archive (.zip)**, allow the optional host permission prompt if you want compatible remote attachments, and extract the entire ZIP. The site may expose only preview images, expired URLs or file buttons without an accessible link. Review `manifest.json`: it tells you which files were saved, unavailable or failed. The extension does not bypass server authorization.

## A link works in ChatGPT but not offline

A `sandbox:` or time-limited external link may only be valid in its original environment. The exporter cannot manufacture bytes it could not retrieve. Only **successfully saved assets** are rewritten to `assets/` paths.

## The ZIP uses a lot of memory or has missing large files

v0.2.4.16 limits assets to 200 items, 24 MiB per file and 160 MiB total. ZIP creation uses uncompressed STORE entries and does not support ZIP64. For very large chats or media, try Markdown-only mode and keep the archive private.

## How can I report a bug safely?

Use the [GitHub bug report template](https://github.com/mw-ferretti/thread-to-md/issues/new/choose). Include the browser/version, ThreadToMD version, short sanitized steps, whether the scan was marked partial, and the expected/actual behavior. **Never attach full exports or unredacted logs.**
