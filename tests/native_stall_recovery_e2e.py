#!/usr/bin/env python3
"""A trusted-wheel non-edge stall is recovered with an opposite-direction nudge.

The test uses actual Chrome DevTools Protocol wheel input (no synthetic
WheelEvent), plus a realistic intercepting virtualizer boundary inside a
virtualized Chat/Work fixture. A persistent blockade must fall back safely.
"""
import asyncio
import re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
ENGINE = (ROOT/'src/exporter.js').read_text()
for before, after in [
 ('olderQuietMs: 24000','olderQuietMs: 950'),
 ('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 220'),
 ('olderMinProbes: 3','olderMinProbes: 2'),
 ('newerQuietMs: 4000','newerQuietMs: 550'),
 ('nativeWheelIntervalMs: 110','nativeWheelIntervalMs: 25'),
 ('nativeWheelPixels: 160','nativeWheelPixels: 240'),
 ('nativeNonEdgeStallLimit: 18','nativeNonEdgeStallLimit: 8'),
 ('nativeStallRecoveryWaitMs: [1400, 2400, 3500, 5000]',
  'nativeStallRecoveryWaitMs: [250, 300, 350, 400]'),
 ('initialWaitMs: 10000','initialWaitMs: 2500'),
]:
 assert before in ENGINE, before
 ENGINE = ENGINE.replace(before,after)

BRIDGE = r'''(() => {
 const stats={trusted:0,wheels:0,closed:false};
 window.__wheelTest=stats;
 document.addEventListener('wheel',e=>{if(e.isTrusted)stats.trusted++},
   {capture:true,passive:true});
 window.chrome=window.chrome||{};
 window.chrome.runtime={connect({name}){
  if(name!=='threadtomd-native-wheel-v1')throw Error('Unexpected port');
  let closed=false;
  const port={
   onMessage:{addListener(fn){this.fn=fn}},
   onDisconnect:{addListener(fn){this.fn=fn}},
   postMessage(message){
    if(message.type==='close'){this.disconnect();return;}
    if(message.type!=='wheel')throw Error('Unexpected command');
    stats.wheels++;
    window.__cdpWheel(message).then(()=>{
      if(!closed)port.onMessage.fn?.({type:'wheel-ok',id:message.id});
    },error=>{port.onMessage.fn?.({type:'error',message:String(error)})});
   },
   disconnect(){if(closed)return;closed=true;stats.closed=true;this.onDisconnect.fn?.()}
  };
  queueMicrotask(()=>port.onMessage.fn?.({type:'ready'}));
  return port;
 }};
})();'''
BLOCKER=r'''(kind) => {
 const root=document.getElementById('scrollbox');
 const b={blocked:0,reversed:0,released:false};
 window.__blocker=b;
 root.addEventListener('wheel',e=>{
  if(!e.isTrusted)return;
  if(e.deltaY>0){
    b.reversed++;
    if(kind==='release-on-reverse')b.released=true;
  }
  if(e.deltaY<0 && (kind==='permanent' || !b.released)){
    b.blocked++;
    e.preventDefault();
  }
 },{capture:true,passive:false});
}'''

async def exercise(browser, kind):
 ctx=await browser.new_context(accept_downloads=True)
 page=await ctx.new_page()
 errors=[]
 page.on('pageerror', lambda err: errors.append(str(err)))
 cdp=await ctx.new_cdp_session(page)
 async def send(_,payload):
  await cdp.send('Input.dispatchMouseEvent', {
   'type':'mouseWheel','x':payload['x'],'y':payload['y'],
   'deltaX':0,'deltaY':payload['direction']*payload['pixels']})
  return True
 await page.expose_binding('__cdpWheel',send)
 await page.set_content((ROOT/'tests/fixtures/new.html').read_text())
 await page.evaluate(BLOCKER,kind)
 await page.add_script_tag(content=BRIDGE)
 await page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
 await page.add_script_tag(content=(ROOT/'src/archive.js').read_text())
 await page.evaluate('''() => {
   window.__threadtomdCaptureMode='native';
   window.__threadtomdExportMode='markdown';
 }''')
 if kind == 'permanent':
  await page.add_script_tag(content=ENGINE)
  await page.wait_for_function("window.__chatgptMdExporter?.status().metodo === 'native-assisted-fallback'",timeout=30000)
  state=await page.evaluate('window.__chatgptMdExporter.status()')
  assert state['recuperacoesNative']==4,state
  assert state['sondasInversasNative']==3,state
  assert state['mensagens']>=1,state
  assert state['limiteAntigo']=='native-wheel-interrupted-assisted-fallback',state
  async with page.expect_download(timeout=15000) as dl:
   await page.locator('#threadtomd-progress-panel button').click()
  markdown=(await (await dl.value).path()).read_text()
  assert 'PARTIAL' in markdown,markdown[:1200]
  print('PASS permanent non-edge blockage -> bounded assisted fallback:',state['mensagens'],'messages',flush=True)
 else:
  async with page.expect_download(timeout=65000) as dl:
   await page.add_script_tag(content=ENGINE)
  markdown=(await (await dl.value).path()).read_text()
  state=await page.evaluate('window.__chatgptMdExporter.status()')
  stats=await page.evaluate('window.__wheelTest')
  blocker=await page.evaluate('window.__blocker')
  assert state['metodo']=='native',state
  assert state['mensagens']==88,state
  assert state['recuperacoesNative']>=2,state
  assert state['sondasInversasNative']>=1,state
  assert blocker['blocked']>=8 and blocker['reversed']>=1 and blocker['released'],blocker
  assert stats['trusted']>stats['wheels']-5,(stats,state)
  assert len(re.findall(r'^## \d+\. ',markdown,re.M))==88
  assert all(f'Mensagem numero {i}' in markdown for i in range(44))
  print('PASS non-edge stall -> wait+rotate+nudge -> native 88 messages:',state['recuperacoesNative'],'recoveries',flush=True)
 assert not errors,errors
 await ctx.close()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  await exercise(browser,'release-on-reverse')
  await exercise(browser,'permanent')
  await browser.close()

if __name__=='__main__': asyncio.run(main())
