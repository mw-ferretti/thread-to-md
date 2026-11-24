#!/usr/bin/env python3
"""CDP-trusted wheel tests for visually oscillating timelines and tall single turns.

An oscillating virtualizer alternates two scroll positions forever; it does
not hold scrollTop fixed and never rebases to the newest edge. This was missed
by the v0.2.4.9 stall checks. The corrected engine must recover via native
wheel, or fail over safely after bounded attempts. A truly tall message must
not be mistaken for an oscillation merely because no new turn is discovered.
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright
from native_stall_recovery_e2e import BRIDGE

ROOT = Path(__file__).resolve().parents[1]
ENGINE = (ROOT / 'src/exporter.js').read_text()
for old, new in [
    ('olderQuietMs: 24000', 'olderQuietMs: 1050'),
    ('olderProbeIntervalMs: 6000', 'olderProbeIntervalMs: 230'),
    ('olderMinProbes: 3', 'olderMinProbes: 2'),
    ('newerQuietMs: 4000', 'newerQuietMs: 600'),
    ('nativeWheelIntervalMs: 110', 'nativeWheelIntervalMs: 30'),
    ('nativeStallRecoveryWaitMs: [1400, 2400, 3500, 5000]',
     'nativeStallRecoveryWaitMs: [200, 220, 240, 260]'),
    ('initialWaitMs: 10000', 'initialWaitMs: 1500'),
]:
    assert old in ENGINE, old
    ENGINE = ENGINE.replace(old, new)

BLOCKER = r'''(mode) => {
 const root = document.querySelector('#scrollbox');
 const center = root.scrollTop - 30;
 const record = {up:0, down:[], released:false, center};
 window.__oscillator=record;
 root.addEventListener('wheel', event => {
   if (!event.isTrusted) return;
   if (event.deltaY > 0) {
     record.down.push(event.deltaY);
     if (mode === 'release-on-reverse' && event.deltaY >= 320)
       record.released = true;
   }
   if (event.deltaY < 0 && !record.released) {
     event.preventDefault();
     record.up++;
     // Artificially make the timeline move on every wheel, but never
     // expose older content. It oscillates without going to an edge.
     root.scrollTop = center + (record.up % 2 ? -80 : 80);
   }
 }, {capture:true, passive:false});
}'''

TALL = '''<!doctype html><html><head><title>Tall-message test</title></head><body>
<main><div id="scrollbox" role="region" data-app-action-timeline-scroll
 style="height:500px;width:900px;overflow-y:auto;position:relative">
<div data-turn-key="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa">
 <div data-content-search-unit-key="n:0:user" data-chatgpt-search-message-ids="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb">
 <div data-user-message-bubble="true"><p>First message and tall technical content</p>
 <pre style="height:17000px">Example of a very long code block</pre></div></div></div>
<div data-turn-key="cccccccc-cccc-4ccc-cccc-cccccccccccc">
 <div data-content-search-unit-key="n:1:assistant" data-chatgpt-search-message-ids="dddddddd-dddd-4ddd-dddd-dddddddddddd">
 <div data-markdown-text-style="assistant-message"><p>Most recent answer</p></div></div></div>
</div></main><script>document.querySelector('#scrollbox').scrollTop=100000;</script></body></html>'''

async def test(browser, mode):
    ctx = await browser.new_context(accept_downloads=True, viewport={'width':1030,'height':760})
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    cdp = await ctx.new_cdp_session(page)
    async def dispatch(_, payload):
        await cdp.send('Input.dispatchMouseEvent', {
            'type':'mouseWheel', 'x':payload['x'], 'y':payload['y'],
            'deltaX':0, 'deltaY':payload['direction']*payload['pixels']})
    await page.expose_binding('__cdpWheel', dispatch)
    await page.set_content(TALL if mode=='tall' else (ROOT/'tests/fixtures/new.html').read_text())
    if mode!='tall': await page.evaluate(BLOCKER, mode)
    await page.add_script_tag(content=BRIDGE)
    await page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
    await page.add_script_tag(content=(ROOT/'src/archive.js').read_text())
    await page.evaluate('''() => {
      window.__threadtomdCaptureMode = 'native';
      window.__threadtomdExportMode = 'markdown';
    }''')
    if mode=='permanent':
        await page.add_script_tag(content=ENGINE)
        await page.wait_for_function("window.__chatgptMdExporter?.status().metodo === 'native-assisted-fallback'", timeout=35000)
        state = await page.evaluate('window.__chatgptMdExporter.status()')
        assert state['recuperacoesNative']==4, state
        assert state['ciclosNative']>=2, state
        assert state['eventosNative']<250, state
        async with page.expect_download(timeout=15000) as dl:
            await page.locator('#threadtomd-progress-panel button').click()
        markdown=(await (await dl.value).path()).read_text()
        assert 'PARTIAL' in markdown
        print('PASS permanent oscillation -> safe manual fallback at',state['eventosNative'],'events',flush=True)
    else:
        async with page.expect_download(timeout=75000) as dl:
            await page.add_script_tag(content=ENGINE)
        markdown=(await (await dl.value).path()).read_text()
        state=await page.evaluate('window.__chatgptMdExporter.status()')
        assert state['metodo']=='native',state
        assert state['erros']==[],state
        assert 'PARTIAL' not in markdown,markdown[:600]
        if mode=='tall':
            assert state['mensagens']==2, state
            assert state['recuperacoesNative']==0, state
            assert state['ciclosNative']==0, state
            print('PASS very tall single message -> normal 2-message export, no false recovery',flush=True)
        else:
            assert state['mensagens']==88, state
            osc=await page.evaluate('window.__oscillator')
            assert osc['up']>=20 and osc['released'], osc
            assert any(v>=320 for v in osc['down']),osc
            assert state['ciclosNative']>=1, state
            assert state['recuperacoesNative']>=3, state
            assert len(re.findall(r'^## \d+\. ',markdown,re.M))==88
            print('PASS moving scrollbar oscillation -> native recovery, 88 messages',state['recuperacoesNative'],'recoveries',flush=True)
    assert not errors, errors
    await cdp.detach()
    await ctx.close()

async def main(scenario):
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        try:
            await test(browser,scenario)
        finally:
            await browser.close()

if __name__=='__main__':
    import sys
    scenarios=('release-on-reverse','permanent','tall')
    assert len(sys.argv) <= 2 and (len(sys.argv) == 1 or sys.argv[1] in scenarios), (
        'Usage: python3 tests/native_oscillation_e2e.py '
        '[release-on-reverse|permanent|tall]')
    # One CDP/Playwright session per invocation: prevents cross-test teardown
    # issues observed when chaining Chrome sessions in this local environment.
    asyncio.run(main(sys.argv[1] if len(sys.argv) == 2 else 'release-on-reverse'))
