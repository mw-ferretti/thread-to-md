#!/usr/bin/env python3
"""Render popup with synthetic tab context and no private conversation data."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'popup/popup.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="popup.css">', '')
html = html.replace('<script src="../src/i18n.js"></script>', '')
html = html.replace('<script src="popup.js"></script>', '')
css = (root / 'popup/popup.css').read_text(encoding='utf-8')
i18n = (root / 'src/i18n.js').read_text(encoding='utf-8')
popup = (root / 'popup/popup.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for language, name in [('en-US', 'popup.png'), ('pt-BR', 'popup-pt-BR.png')]:
        ctx = browser.new_context(viewport={'width': 440, 'height': 700}, locale=language,
                                  device_scale_factor=2)
        page = ctx.new_page()
        page.set_content(html)
        page.add_style_tag(content=css)
        page.evaluate('''() => {
          globalThis.chrome = {i18n:{getUILanguage:()=>navigator.language},
            tabs:{query:async()=>[{id:12,url:'https://chatgpt.com/c/synthetic-test'}]}};
        }''')
        page.add_script_tag(content=i18n)
        page.add_script_tag(content=popup)
        page.wait_for_timeout(150)
        out = root / 'docs/screenshots' / name
        page.screenshot(path=str(out), full_page=True)
        print(out)
        ctx.close()
    browser.close()
