# Publish ThreadToMD v0.2.4.16

**Repository:** https://github.com/mw-ferretti/thread-to-md  
**Existing public version:** v0.2.4  
**Next tag:** `v0.2.4.16`

This is an **update to the existing repository**, not a new project. The v0.2.4 release and its original notes remain historical records. GitHub publication is distinct from browser-store approval.

## 1. Update the existing repository

1. Work in your checkout of `https://github.com/mw-ferretti/thread-to-md` on `main`. Back up any local work and start from a clean branch or commit.
2. Copy the **contents** of the new source package's `threadtomd/` folder into the repository root, preserving the `.github/`, `docs/`, `scripts/`, and `_locales/` directories. Do not commit the package itself or `dist/`.
3. Verify that the new popup, screenshot assets, `README.md`, `CHANGELOG.md`, policies, documentation and test files are all included.
4. Run the checks below from the repository root and review `git diff --check`, `git status`, and the diff. Do not commit conversation exports or signed asset URLs.

```bash
python3 scripts/build.py
npm test
python3 tests/popup_browser.py
python3 tests/package_integrity.py
python3 tests/locales.py
python3 tests/ascii.py
# Optional: rerender documentation visuals to confirm reproducibility
python3 scripts/update_popup_screenshots.py
python3 scripts/update_brand_assets.py
```

5. Perform a short **live Chrome and Firefox installation smoke test** of the v0.2.4.16 packages. Confirm the new popup, correct browser method, download behavior, and Chrome automatic completion. The v0.2.4.15 engine succeeded in a real Chrome conversation, but that is not a fresh test of this exact packaged version.
6. Review the changes locally. Example commands for an existing checkout:

```bash
git status
git diff --check
git add -A
git commit -m "release: prepare ThreadToMD v0.2.4.16"
git push origin main
```

Do **not** run `git init` or `git remote add` inside an already existing repository. Do not overwrite any unrelated local modifications without reviewing them.

## 2. Create the GitHub release

1. Confirm all version metadata and popup footer read `0.2.4.16`.
2. Generate the **browser distribution ZIPs** with `python3 scripts/build.py`. Their exact names are:

   - `dist/threadtomd-chrome-0.2.4.16.zip`
   - `dist/threadtomd-firefox-0.2.4.16.zip`

3. Confirm that each ZIP contains `manifest.json` at the **root**, not inside an extra folder. The Chrome package includes `debugger` and `background/native_wheel.js`; the Firefox package includes neither.
4. Create/push tag `v0.2.4.16` from the tested commit, then create a GitHub Release at `https://github.com/mw-ferretti/thread-to-md/releases/new`:

```bash
git tag v0.2.4.16
git push origin v0.2.4.16
```

5. Use [Release notes v0.2.4.16](RELEASE_NOTES_v0.2.4.16.md) for the release body, **attach both ZIPs** and publish. If the exact build's live smoke tests are still pending, mark it **Pre-release** and disclose the limitation; release status can be revised after acceptance.
6. Once the release assets are uploaded, verify the README's two direct-download links, release badge, screenshots and repository social preview. The new links cannot work before the release is published with both assets.
7. Upload `docs/brand/social-preview.png` in **repository Settings > General > Social preview** if you want GitHub link cards to use the new art; merely committing the image does not change the existing repository-level social-preview setting automatically.

**Do not attach the source ZIP as a browser extension install package.** Source belongs in the repository; GitHub's built-in source archives are automatic.

## 3. Browser store publication is a separate decision

Chrome's automatic mode uses the high-privilege **`debugger`** permission to send trusted wheel input to the selected ChatGPT tab. Before Chrome Web Store submission, document and review the least-privilege justification, user disclosure, detachment behavior, any store policy restrictions and screenshots from an actual installed build. The presence of a GitHub release does not mean the permission has been approved by Google.

Firefox is **manual-only** and the Firefox build excludes `debugger`. Replace the development Gecko ID `threadtomd@extensions.local` with the intended stable add-on ID before an initial official Mozilla submission, then rebuild and revalidate its permissions and data-use declaration. Firefox `about:debugging` installation remains temporary and unsigned.

Review current store asset dimensions and policies before submission. Use [Store listing](STORE_LISTING.md), [Privacy](../PRIVACY.md), [Security](../SECURITY.md), and the [Release checklist](RELEASE_CHECKLIST.md). The repository's fixture screenshots are for GitHub documentation, **not evidence of real installed-browser behavior**. Create non-sensitive screenshots from actual installed extension sessions for store review.

Do not add store links to the README until those listings are approved and exist.

## 4. Portfolio presentation

- Repository: **`mw-ferretti/thread-to-md`**, product name **ThreadToMD**.
- One shared source tree; distinct Chrome/Firefox ZIPs.
- Demonstrated engineering: incremental capture under DOM virtualisation, Chrome trusted-wheel navigation with bounded recovery, manual Firefox flow, conservative partial-status reporting, and optional ZIP archiving with bounded downloads.
- Describe browser capabilities separately; do not promise verified 100% capture of all possible conversations or media.
