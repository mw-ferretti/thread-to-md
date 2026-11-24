#!/usr/bin/env python3
"""Actual ChatGPT code-widget fixture: bypass only after loop and complete capture.

Reproduces a wheel-trapping viewport that stops trapping only if its nested
scrolling widget is detached. Uses trusted CDP wheel events. The attached
HTML structure is the original supplied widget, with simulated computed CSS.
"""
import asyncio
import io
import zipfile
import re
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from native_stall_recovery_e2e import BRIDGE
from native_widget_fixture import fixture

ROOT = Path(__file__).resolve().parents[1]
ENGINE = (ROOT/'src/exporter.js').read_text()
for old, new in [
 ('olderQuietMs: 24000','olderQuietMs: 1100'),
 ('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 220'),
 ('olderMinProbes: 3','olderMinProbes: 2'),
 ('newerQuietMs: 4000','newerQuietMs: 500'),
 ('nativeWheelIntervalMs: 110','nativeWheelIntervalMs: 25'),
 ('nativeNonEdgeStallLimit: 18','nativeNonEdgeStallLimit: 9'),
 ('nativeCycleRepeatThreshold: 4','nativeCycleRepeatThreshold: 3'),
 ('nativeCycleMinSpan: 20','nativeCycleMinSpan: 12'),
 ('nativeStallRecoveryWaitMs: [1400, 2400, 3500, 5000]',
  'nativeStallRecoveryWaitMs: [180, 220, 260, 300]'),
 ('initialWaitMs: 10000','initialWaitMs: 1000')
]:
 assert old in ENGINE,old
 ENGINE=ENGINE.replace(old,new)

INTERCEPT = r'''(mode) => {
 const root=document.querySelector('#scrollbox');
 const widget=root.querySelector('[data-client-defined-widget="code_block"]');
 const owner=widget.closest('[data-content-search-unit-key]');
 if(mode==='unstable') {
   owner.removeAttribute('data-chatgpt-search-message-ids');
   owner.closest('[data-turn-key]').removeAttribute('data-turn-key');
 }
 window.__intercept={trapped:0, released:0, scrolls:0, removedDuringWheel:false,
   blocked:false, shifted:false, originalWidget:widget};
 root.addEventListener('scroll',()=>window.__intercept.scrolls++);
 root.addEventListener('wheel', e=>{
   if(!e.isTrusted || e.deltaY>=0 || mode==='normal')return;
   if(!widget.isConnected) {window.__intercept.released++;return;}
   // Stop at this code widget after normal wheel traversal gets near it.
   const relative=root.scrollTop-widget.offsetTop;
   if(relative < -350 || relative > 650) return;
   e.preventDefault();
   window.__intercept.trapped++;
   window.__intercept.blocked=true;
   // A realistic oscillating virtualizer keeps the same widget visible,
   // but moves scrollTop. It does not ever settle at the root edge.
   root.scrollTop=Math.max(10,widget.offsetTop+(window.__intercept.trapped%2?105:185));
 },{capture:true,passive:false});
}'''

async def run(scenario):
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        ctx=await browser.new_context(accept_downloads=True,viewport={'width':1024,'height':760})
        page=await ctx.new_page()
        errs=[]
        page.on('pageerror',lambda e: errs.append(str(e)))
        cdp=await ctx.new_cdp_session(page)
        async def dispatch(_,payload):
            await cdp.send('Input.dispatchMouseEvent',{
                'type':'mouseWheel','x':payload['x'],'y':payload['y'],
                'deltaX':0,'deltaY':payload['direction']*payload['pixels']})
        await page.expose_binding('__cdpWheel',dispatch)
        await page.set_content(fixture())
        await page.evaluate(INTERCEPT,scenario)
        check=await page.evaluate('''() => {
          const w=document.querySelector('[data-client-defined-widget="code_block"]');
          const p=w.querySelector('.InlineCodePane-EYx4bd');
          return {overflow:getComputedStyle(p).overflowY,inside:p.scrollHeight-p.clientHeight}
        }''')
        assert check['overflow'] in ('auto','scroll') and check['inside']>40,check
        await page.evaluate('''() => {const r=document.querySelector('#scrollbox');r.scrollTop=r.scrollHeight;}''')
        await page.add_script_tag(content=BRIDGE)
        await page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
        await page.add_script_tag(content=(ROOT/'src/archive.js').read_text())
        await page.evaluate('''(fmt) => {
          window.__threadtomdCaptureMode='native';
          window.__threadtomdExportMode=fmt;
        }''','archive' if scenario=='trapped_zip' else 'markdown')
        if scenario=='unstable':
            await page.add_script_tag(content=ENGINE)
            await page.wait_for_function('''() =>
              window.__chatgptMdExporter?.status().metodo==='native-assisted-fallback'
            ''',timeout=65000)
            state=await page.evaluate('window.__chatgptMdExporter.status()')
            assert state['widgetsRemovidosNative']==0,state
            assert state['widgetsNaoConfirmadosNative']>0,state
            assert await page.locator('[data-client-defined-widget="code_block"]').count()==1
            async with page.expect_download(timeout=15000) as result:
                await page.locator('#threadtomd-progress-panel button').click()
            txt=(await (await result.value).path()).read_text()
            assert 'PARTIAL' in txt,txt[:300]
            print('PASS unstable message: never detached; safe manual fallback',flush=True)
        else:
            if scenario == 'trapped_cancel':
                await page.add_script_tag(content=ENGINE)
                await page.wait_for_function('''() =>
                  window.__chatgptMdExporter?.status().widgetsRemovidosNative===1
                ''',timeout=35000)
                async with page.expect_download(timeout=15000) as result:
                    await page.evaluate('window.__chatgptMdExporter.stop()')
            else:
                async with page.expect_download(timeout=65000) as result:
                    await page.add_script_tag(content=ENGINE)
            raw=(await (await result.value).path()).read_bytes()
            if scenario == 'trapped_zip':
                with zipfile.ZipFile(io.BytesIO(raw)) as z:
                    txt=z.read('conversation.md').decode()
                    assert 'manifest.json' in z.namelist(),z.namelist()
            else:
                txt=raw.decode()
            state=await page.evaluate('window.__chatgptMdExporter.status()')
            metrics=await page.evaluate('''() => ({trapped:window.__intercept.trapped,
              released:window.__intercept.released,
              removedDuringWheel:window.__intercept.originalWidget.isConnected,
              count:document.querySelectorAll('[data-client-defined-widget="code_block"]').length})''')
            if scenario=='trapped_cancel':
                assert state['parar'],state
            else:
                assert state['metodo']=='native' and not state['erros'],state
            assert state['mensagens']==88,state
            assert len(re.findall(r'^## \d+\. ',txt,re.M))==88
            assert 'const selector' in txt and 'Timeline missing' in txt,txt[:500]
            if scenario=='trapped_cancel':
                assert 'PARTIAL' in txt,txt[:500]
            else:
                assert 'PARTIAL' not in txt,txt[:500]
            if scenario in ('trapped','trapped_zip','trapped_cancel'):
                assert metrics['trapped']>=9,metrics
                if scenario != 'trapped_cancel':
                    assert metrics['released']>0,metrics
                assert state['widgetsRemovidosNative']==1,state
                assert state['widgetsRestauradosNative']==1,state
            else:
                assert state['widgetsRemovidosNative']==0,state
            assert metrics['count']==1 and metrics['removedDuringWheel'],metrics
            print('PASS',scenario,'88 records; captured code preserved; removed/restored',
                  state['widgetsRemovidosNative'],'/',state['widgetsRestauradosNative'],flush=True)
        assert not errs,errs
        await cdp.detach()
        await ctx.close()
        await browser.close()

if __name__=='__main__':
    scenario=sys.argv[1] if len(sys.argv)>1 else 'trapped'
    assert scenario in ('trapped','trapped_zip','trapped_cancel','normal','unstable')
    asyncio.run(run(scenario))
