#!/usr/bin/env python3
"""Real DOM click coverage for the ZIP permission flow with mocked browser APIs.

This is not a substitute for native browser permission prompt acceptance testing.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'popup/popup.html').read_text(encoding='utf-8')
HTML = HTML.replace('<link rel="stylesheet" href="popup.css">', '')
HTML = HTML.replace('<script src="../src/i18n.js"></script>', '')
HTML = HTML.replace('<script src="popup.js"></script>', '')
CSS = (ROOT / 'popup/popup.css').read_text(encoding='utf-8')
I18N = (ROOT / 'src/i18n.js').read_text(encoding='utf-8')
POPUP = (ROOT / 'popup/popup.js').read_text(encoding='utf-8')

with sync_playwright() as playwright:
    exe = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    kw = {'executable_path': exe} if exe else {}
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'], **kw)
    for is_firefox in (False, True):
        page = browser.new_page()
        page.set_content(HTML)
        page.add_style_tag(content=CSS)
        page.evaluate('''(firefox) => {
            window.__testState = { requests: [], injections: [], messages: [], ports: [], closes: 0, granted: false };
            const saved = new Map();
            Object.defineProperty(window, 'localStorage', { configurable: true, value: {
              getItem: key => saved.get(key) ?? null,
              setItem: (key, value) => saved.set(key, value)
            }});
            window.chrome = {
              i18n: { getUILanguage: () => 'en-US' },
              runtime: {
                ...(firefox ? { getBrowserInfo: () => Promise.resolve({ name: 'Firefox' }) } : {}),
                connect: options => { window.__testState.ports.push(options); return {}; },
                sendMessage: options => { window.__testState.messages.push(options); return Promise.resolve({ ok: true }); }
              },
              permissions: {
                contains: async () => window.__testState.granted,
                request: (value) => {
                  window.__testState.requests.push(value);
                  window.__testState.granted = true;
                  return Promise.resolve(true);
                }
              },
              tabs: { query: async () => [{ id: 1, windowId: 3, url: 'https://chatgpt.com/c/synthetic' }] },
              scripting: { executeScript: async (args) => {
                window.__testState.injections.push(args);
                return [];
              } }
            };
            window.close = () => { window.__testState.closes += 1; };
        }''', is_firefox)
        page.add_script_tag(content=I18N)
        page.add_script_tag(content=POPUP)
        page.locator('#start').wait_for(state='visible')
        assert page.locator('input[value=automatic]').count() == 0
        assert page.locator('input[value=native]').count() == 1
        assert page.locator('input[value=assisted]').count() == 1
        assert page.evaluate('document.querySelector("input[value=assisted]").checked' if is_firefox else 'document.querySelector("input[value=native]").checked')
        if is_firefox:
            assert page.locator('.capture-picker').is_hidden()
        page.wait_for_function('!document.querySelector("#start").disabled')
        page.get_by_text('Complete archive (.zip)').click()
        page.wait_for_function('window.__testState.requests.length === 1')
        assert page.evaluate('window.__testState.injections.length') == 0
        assert page.evaluate('window.__testState.messages.length') == 1
        assert page.evaluate('window.__testState.messages[0].windowId') == 3
        assert page.evaluate('window.__testState.requests[0].origins.includes("https://images.openai.com/*")')
        assert page.evaluate('document.querySelector("input[value=archive]").checked')
        if is_firefox:
            assert page.evaluate('window.__testState.closes') == 1
            assert page.evaluate('localStorage.getItem("threadtomd.exportFormat")') == 'archive'
            assert page.evaluate('window.__testState.injections.length') == 0
            print('PASS Firefox-mode DOM: ZIP label click requests permission and closes popup', flush=True)
        else:
            page.wait_for_function('!document.querySelector("#start").disabled')
            page.locator('#start').click()
            page.wait_for_function('window.__testState.injections.length === 2')
            assert page.evaluate('window.__testState.requests.length') == 1
            assert page.evaluate('window.__testState.injections[0].args') == ['archive', 'native']
            assert page.evaluate('window.__testState.closes') == 1
            print('PASS Chrome-mode DOM: ZIP label click requests permission before Export', flush=True)
        page.close()
    browser.close()
