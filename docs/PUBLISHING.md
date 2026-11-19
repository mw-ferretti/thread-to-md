# Publishing ThreadToMD

This guide separates three independent milestones: **public GitHub source**, **GitHub release assets**, and **browser store approval**. ThreadToMD v0.2.4 has completed manual release acceptance on Google Chrome 158.0.8127.36 and Mozilla Firefox 160.0 and is ready for a normal GitHub Release. Do not describe the build as store-approved or guarantee complete exports; browser-store review remains a separate milestone and message completeness is heuristic.

## 1. Publish the GitHub source

1. Create a **public** GitHub repository named `ThreadToMD`. Do not initialize it with another README, license or .gitignore; these already exist here.
2. Extract the **GitHub source ZIP** and work from the inner `threadtomd/` folder. The repository root must contain `README.md`, `manifest.json`, `src/`, `popup/`, `.github/` and `docs/`.
3. Confirm the source contains **no exported conversations or private files**. `dist/` is generated and excluded by `.gitignore`.
4. From the project root, create the initial Git history and push. Replace `YOUR_GITHUB_USER` with your actual account name:

   ```bash
   git init -b main
   git add .
   git commit -m "Initial public release v0.2.4"
   git remote add origin https://github.com/YOUR_GITHUB_USER/ThreadToMD.git
   git push -u origin main
   ```

5. Confirm that the README's preview image and screenshots display correctly on GitHub and that CI starts.
6. Recommended repository description: **"Export ChatGPT conversations to Markdown or portable ZIP archives with virtualized-history capture."**
7. Recommended topics: `browser-extension`, `webextensions`, `markdown`, `chatgpt`, `chrome-extension`, `firefox-extension`, `javascript`, `open-source`.
8. In **Settings**, enable Issues and private vulnerability reporting (when available). Set the repository social preview to `docs/brand/social-preview.png`.

The static badges in the README identify the tested v0.2.4 release and MIT license; there are no fabricated store links, star counts or CI-success claims.

## 2. Create a GitHub Release

1. From a clean checkout, run `python3 scripts/build.py`, `npm test` and the relevant browser tests.
2. Verify that `dist/threadtomd-chrome-0.2.4.zip` and `dist/threadtomd-firefox-0.2.4.zip` each place `manifest.json` **at the archive root**.
3. Create a normal GitHub Release tagged **`v0.2.4`**. Manual browser acceptance for this build is already recorded in `TEST_RESULTS_v0.2.4.md`.
4. Attach both browser-specific ZIPs. Use [Release notes](RELEASE_NOTES_v0.2.4.md) as the release body and link to the README's installation steps.
5. Explain that the user must **extract** the ZIP before loading it in developer mode. Note that a Firefox temporary extension is removed after restarting.

**Do not upload the full source ZIP as the browser extension package.** It has a different root layout.

## 3. Chrome Web Store (later)

Before submission:

- Complete developer account verification in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- Upload only the archive built for Chrome.
- Use truthful copy from [Store listing draft](STORE_LISTING.md), updated to match the tested package.
- Prepare the bundled 128 x 128 extension icon, **at least one real in-browser screenshot** (1280 x 800 or 640 x 400) and the required **440 x 280 promotional tile**. Original draft artwork is available under `docs/brand/`.
- Publish the privacy policy at a stable public URL, e.g. the GitHub `PRIVACY.md`, and complete the data-use/permission disclosures consistently.
- Capture **actual installed-browser behavior**, with synthetic or appropriately redacted conversations; the included fixture preview is not evidence of a live store-tested export.
- Review the current [image requirements](https://developer.chrome.com/docs/webstore/images) and [listing policies](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements) at submission time.

Update the README with an official Chrome Web Store link **only after approval**.

## 4. Mozilla Add-ons (later)

1. Select a **stable and unique Firefox extension ID**, replacing `threadtomd@extensions.local` in `scripts/build.py` before the first submission. The existing ID is only a development placeholder.
2. Rebuild, inspect `dist/firefox/manifest.json`, and verify the Gecko-specific settings including `data_collection_permissions.required = ["none"]` match the actual behavior.
3. Submit the Firefox package through the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/), with truthful listing copy, privacy policy, relevant screenshots and source/build documentation if requested.
4. Wait for successful review/signing. Temporary development installation is not an approved Firefox release.
5. Recheck Mozilla's [submission guidance](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) and [data collection guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) at the time of submission.

## 5. Evidence required before store release

The current v0.2.4 package has completed manual acceptance on **Google Chrome 158.0.8127.36** and **Mozilla Firefox 160.0**. Before submitting a later build to either browser store, repeat the release checklist against the exact package being submitted: initial/final message boundaries on a long conversation, chronological ordering, preserved code/ASCII, local archive links, inline and uploaded media, an accessible PDF or ZIP, failed/expired files recorded in `manifest.json`, permission consent/recovery, and pause/resume behavior. Follow [Release checklist](RELEASE_CHECKLIST.md).

## 6. Portfolio presentation

Use **ThreadToMD** as both the project title and repository name. The portfolio-friendly angle is **incremental capture over a virtualized DOM, conservative completeness reporting, cross-browser extension packaging and bounded binary archive transport**. Describe these as implementation choices, not as claims that the extension captures every private ChatGPT asset.

Suggested one-line description:

> Open-source Chrome and Firefox extension that exports long ChatGPT conversations to developer-friendly Markdown and portable archives, with virtualized-DOM capture and optional accessible attachments.
