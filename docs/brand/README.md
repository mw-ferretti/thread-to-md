# ThreadToMD visual assets - v0.2.4.16

- `social-preview.png` - 1280 x 640 GitHub README banner / repository social-preview image. Includes the *actual compact popup* rendered in a synthetic Chrome test context, plus the browser-specific capture description.
- `chrome-store-promo-440x280.png` - 440 x 280 promotional-art draft refreshed to match the new UI and Chrome automatic / Firefox manual split. **Not an approved store asset**.

The brand icon under `icons/` has **not** changed. The current banners use it without altering the shipped extension icon. The banner/promo script composites the real locally rendered popup, not a generated mock interface.

Regeneration:

```bash
python3 scripts/update_popup_screenshots.py
python3 scripts/update_brand_assets.py
```

The scripts require Python Playwright + Chromium and Pillow; they do not access personal conversations. The popup is rendered against synthetic tab metadata. Before submitting to a browser store, capture a real installed extension with non-sensitive content and follow the store's current asset rules. To update GitHub's social card, commit the file **and set it in repository Settings**; the README image alone does not update GitHub's social preview setting.
