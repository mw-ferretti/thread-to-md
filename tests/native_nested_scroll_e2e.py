#!/usr/bin/env python3
"""Regression for large nested scrollboxes and stronger bounded native recovery.

Uses Chrome's real CDP mouseWheel input in a virtualized Chat/Work fixture.
No synthetic WheelEvent is used to fake the navigation behavior.
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright
from native_stall_recovery_e2e import ENGINE, BRIDGE

ROOT = Path(__file__).resolve().parents[1]

# The same input transport as the Chrome extension, in a test-only page shim.
async def run_case(browser, case):
    context = await browser.new_context(accept_downloads=True, viewport={'width': 1030, 'height': 760})
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    cdp = await context.new_cdp_session(page)

    async def dispatch(_, payload):
        await cdp.send('Input.dispatchMouseEvent', {
            'type': 'mouseWheel', 'x': payload['x'], 'y': payload['y'],
            'deltaX': 0, 'deltaY': payload['pixels'] * payload['direction']
        })
        return True

    await page.expose_binding('__cdpWheel', dispatch)
    await page.set_content((ROOT / 'tests/fixtures/new.html').read_text())

    if case == 'nested':
        await page.evaluate('''() => {
            const root = document.querySelector('#scrollbox');
            const rect = root.getBoundingClientRect();
            const nested = document.createElement('div');
            nested.id = 'nested-codebox';
            nested.style.cssText = `position:fixed; z-index:100; left:${rect.left + 15}px;
                top:${rect.top + 8}px; width:${rect.width - 30}px;
                height:${rect.height - 16}px; overflow:auto;
                overscroll-behavior:contain; background:#ddd`;
            nested.innerHTML = '<pre style="height:6000px">A very large nested code block</pre>';
            nested.addEventListener('wheel', () => window.__nestedWheels++, {capture:true});
            window.__nestedWheels = 0;
            root.append(nested);
        }''')
    else:
        # The original recovery's 100 px reverse is insufficient. The new
        # third recovery uses 320 px and must restore upward navigation.
        await page.evaluate('''() => {
            const root = document.querySelector('#scrollbox');
            window.__reverseTest = {upBlocked:0, nudges:[], released:false};
            root.addEventListener('wheel', event => {
                if (!event.isTrusted) return;
                if (event.deltaY > 0) {
                    window.__reverseTest.nudges.push(event.deltaY);
                    if (event.deltaY >= 320) window.__reverseTest.released = true;
                }
                if (event.deltaY < 0 && !window.__reverseTest.released) {
                    window.__reverseTest.upBlocked++;
                    event.preventDefault();
                }
            }, {capture:true, passive:false});
        }''')

    await page.add_script_tag(content=BRIDGE)
    await page.add_script_tag(content=(ROOT / 'src/i18n.js').read_text())
    await page.add_script_tag(content=(ROOT / 'src/archive.js').read_text())
    await page.evaluate('''() => {
        window.__threadtomdCaptureMode='native';
        window.__threadtomdExportMode='markdown';
    }''')

    async with page.expect_download(timeout=65000) as transfer:
        await page.add_script_tag(content=ENGINE)
    markdown = (await (await transfer.value).path()).read_text()
    state = await page.evaluate('window.__chatgptMdExporter.status()')
    assert state['metodo'] == 'native', state
    assert state['mensagens'] == 88, state
    assert state['erros'] == [], state
    assert len(re.findall(r'^## \d+\. ', markdown, re.M)) == 88
    assert all(f'Mensagem numero {i}' in markdown for i in range(44))
    if case == 'nested':
        nested_wheels = await page.evaluate('window.__nestedWheels')
        assert nested_wheels == 0, f'Wheel events incorrectly entered nested scrollbox: {nested_wheels}'
        print('PASS nested code block: original wheel points blocked; gutter point captured 88 messages', flush=True)
    else:
        metrics = await page.evaluate('window.__reverseTest')
        assert metrics['upBlocked'] >= 10 and metrics['released'], metrics
        assert any(delta >= 320 for delta in metrics['nudges']), metrics
        assert state['recuperacoesNative'] >= 3, state
        assert state['sondasInversasNative'] >= 2, state
        print('PASS 320 px reverse nudge + 600 px forward recovery: 88 messages', flush=True)
    assert not errors, errors
    await context.close()

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        try:
            await run_case(browser, 'nested')
            await run_case(browser, 'strong-reverse')
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
