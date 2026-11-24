# Documentation screenshots - v0.2.4.16

The popup screenshots show **the real bundled v0.2.4.16 popup HTML, CSS and JavaScript**, rendered in Chromium with an artificial ChatGPT tab response (no signed-in user or private conversation):

| File | View |
| --- | --- |
| `popup.png` | Chrome, English, native automatic selected by default |
| `popup-pt-BR.png` | Chrome, Brazilian Portuguese |
| `popup-firefox.png` | Firefox-mode mock, English, manual only; the method picker is hidden |
| `popup-firefox-pt-BR.png` | Firefox-mode mock, Brazilian Portuguese, manual only |
| `progress-demo.png` | Synthetic conversation illustrating the existing on-page progress panel, not a live ChatGPT session |

The compact popup displays its action button without internal scrolling in an approximately 600 CSS px action popup. These images represent the current **layout**, not proof of a real browser installation, complete history capture, native permissions, or browser-store approval.

Rebuild these images using:

```bash
python3 scripts/update_popup_screenshots.py
```

Never replace these screenshots with private conversation content. For a store submission, separately capture the extension installed in the actual target browser with non-sensitive, test-only data and verify current image requirements.
