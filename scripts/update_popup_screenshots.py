#!/usr/bin/env python3
"""Render reproducible documentation screenshots using the shipped popup.

No real ChatGPT conversation or browser permission is accessed. All content is synthetic.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / 'docs' / 'screenshots'
HTML = (ROOT / 'popup/popup.html').read_text(encoding='utf-8')
for tag in ('<link rel="stylesheet" href="popup.css">',
            '<script src="../src/i18n.js"></script>',
            '<script src="popup.js"></script>'):
    HTML = HTML.replace(tag, '')
CSS = (ROOT / 'popup/popup.css').read_text(encoding='utf-8')
I18N = (ROOT / 'src/i18n.js').read_text(encoding='utf-8')
POPUP = (ROOT / 'popup/popup.js').read_text(encoding='utf-8')

MOCK = r'''(opts) => {
    const { firefox, language } = opts;
    window.chrome = {
      i18n: { getUILanguage: () => language },
      runtime: {
        ...(firefox ? {getBrowserInfo: () => Promise.resolve({name:'Firefox'})} : {}),
        connect: () => ({}),
        sendMessage: () => Promise.resolve({ok:true})
      },
      permissions: {contains: async () => false, request: async () => false},
      tabs: {query: async () => [{id:12, windowId:1, url:'https://chatgpt.com/c/synthetic-example'}]},
      scripting: {executeScript: async () => []}
    };
}'''

# This is intentionally a synthetic illustration of the existing on-page progress panel.
PROGRESS_HTML = '''<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f5f7f6;color:#293a35}
.header{height:49px;border-bottom:1px solid #dce3e0;padding:14px 28px;background:#fff;font-size:13px;font-weight:700}
main{width:700px;margin:24px auto 0}h1{text-align:center;font-size:19px;margin:0 0 18px}
h1 span{font-weight:400;color:#71847e}.chat{border:1px solid #dce3e0;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 5px 18px #15352908}
.turn{padding:15px 22px;border-bottom:1px solid #e6eae8;font-size:14px;line-height:1.5}
.turn.user{background:#e5f3ee;margin:10px 18px 8px auto;border:0;border-radius:12px;width:max-content;max-width:85%;padding:11px 14px}
.turn:last-child{border-bottom:0}
.note{text-align:left;color:#7c8b86;font-size:11px;margin-top:10px}
#threadtomd-progress-panel{position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:14px;max-width:calc(100vw - 32px);width:320px;background:#12231d;color:white;border:1px solid #8eb4a5;border-radius:10px;box-shadow:0 5px 24px #0006;font:13px/1.5 system-ui,sans-serif}
#threadtomd-progress-status{margin-top:7px}
#threadtomd-progress-panel button{margin-top:9px;padding:7px 10px;background:#315b4d;color:#fff;border:1px solid #94b5aa;border-radius:5px;font:inherit}
</style></head><body>
<div class="header">ThreadToMD &nbsp;/&nbsp; Demonstration (synthetic)</div>
<main><h1>Example conversation <span>(synthetic)</span></h1>
<div class="chat">
<div class="turn user">Can I save a long conversation in Markdown?</div>
<div class="turn">ThreadToMD captures rendered messages while navigating virtualized chat history.</div>
<div class="turn user">Does it keep code blocks and ASCII diagrams?</div>
<div class="turn">It preserves formatted text, links, tables, fenced code, and whitespace-sensitive diagrams.</div>
<div class="turn user">What if a code block traps scrolling?</div>
<div class="turn">On Chrome, native automatic capture can recover by temporarily bypassing a captured scrolling widget.</div>
</div><div class="note">Illustration only. No personal conversations or account data.</div></main>
<div id="threadtomd-progress-panel"><b>ThreadToMD \u00b7 Exporting</b>
<div id="threadtomd-progress-status">Scanning older messages | 42 messages | 126 steps | New (Chat/Work)</div>
<button type="button">Stop &amp; save partial</button></div>
</body></html>'''

def render_popup(browser, language, firefox, filename):
    context = browser.new_context(viewport={'width':440,'height':740}, locale=language,
                                  device_scale_factor=2)
    page = context.new_page()
    page.set_content(HTML)
    page.add_style_tag(content=CSS)
    page.evaluate(MOCK, {'firefox': firefox, 'language':language})
    page.add_script_tag(content=I18N)
    page.add_script_tag(content=POPUP)
    page.wait_for_function("document.querySelector('#status').textContent.includes('Ready.') || document.querySelector('#status').textContent.includes('Pronto.')")
    size = page.locator('main').bounding_box()
    assert size is not None and int(size['width']) == 356, size
    assert size['height'] < 595, f'{filename}: popup would scroll in a 600px action window: {size}'
    assert page.locator('#start').is_visible(), filename
    assert not page.locator('#start').is_disabled(), filename
    assert page.locator('input[value="native"]').is_checked() is (not firefox)
    assert page.locator('.capture-picker').is_hidden() is firefox
    path = SCREENSHOTS / filename
    page.locator('main').screenshot(path=str(path))
    print(f'{filename}: {round(size["height"])} CSS px, button visible')
    context.close()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, args=['--no-sandbox'])
    render_popup(browser, 'en-US', False, 'popup.png')
    render_popup(browser, 'pt-BR', False, 'popup-pt-BR.png')
    render_popup(browser, 'en-US', True, 'popup-firefox.png')
    render_popup(browser, 'pt-BR', True, 'popup-firefox-pt-BR.png')
    page = browser.new_page(viewport={'width':1000,'height':650}, device_scale_factor=1)
    page.set_content(PROGRESS_HTML)
    page.screenshot(path=str(SCREENSHOTS / 'progress-demo.png'))
    page.close()
    browser.close()
    print('progress-demo.png: 1000x650 synthetic on-page panel')
