#!/usr/bin/env python3
"""Chrome-native wheel E2E: browser-trusted CDP events + real capture fixture."""
import asyncio, io, re, zipfile
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
I18N=(ROOT/'src/i18n.js').read_text()
ARCHIVE=(ROOT/'src/archive.js').read_text()
ENGINE=(ROOT/'src/exporter.js').read_text()
ENGINE=(ENGINE.replace('olderQuietMs: 24000','olderQuietMs: 1700')
  .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 350')
  .replace('olderMinProbes: 3','olderMinProbes: 2')
  .replace('newerQuietMs: 4000','newerQuietMs: 750')
  .replace('nativeWheelIntervalMs: 110','nativeWheelIntervalMs: 30')
  .replace('nativeWheelPixels: 160','nativeWheelPixels: 240')
  .replace('initialWaitMs: 10000','initialWaitMs: 2500'))
PORT_MOCK=r'''(() => {
  const info={wheels:0,trusted:0,closed:false};
  document.addEventListener('wheel', event => {
    if(event.isTrusted) info.trusted++;
  }, {capture:true,passive:true});
  window.__nativeE2e=info;
  window.chrome=window.chrome||{};
  window.chrome.runtime={
    connect({name}){
      if(name!=='threadtomd-native-wheel-v1') throw Error('Wrong channel');
      const port={
        onMessage:{listener:null,addListener(cb){this.listener=cb}},
        onDisconnect:{listener:null,addListener(cb){this.listener=cb}},
        postMessage(payload){
          if(payload.type==='close'){this.disconnect();return;}
          if(payload.type!=='wheel')throw Error('Unknown command');
          info.wheels++;
          window.__sendNativeWheel(payload).then(()=>{
            if(!info.closed) this.onMessage.listener?.({type:'wheel-ok',id:payload.id});
          },error=>{this.onMessage.listener?.({type:'error',message:String(error)})});
        },
        disconnect(){if(info.closed)return;info.closed=true;this.onDisconnect.listener?.()}
      };
      queueMicrotask(()=>port.onMessage.listener?.({type:'ready'}));
      return port;
    }
  };
})();'''

async def run(browser, archive=False):
 ctx=await browser.new_context(accept_downloads=True)
 page=await ctx.new_page()
 cdp=await ctx.new_cdp_session(page)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 async def dispatch(_src,payload):
  await cdp.send('Input.dispatchMouseEvent',{'type':'mouseWheel','x':payload['x'],'y':payload['y'],
       'deltaX':0,'deltaY':payload['pixels']*payload['direction']})
  return True
 await page.expose_binding('__sendNativeWheel',dispatch)
 html=(ROOT/'tests/fixtures/new.html').read_text()
 if archive:
  png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+ylQAAAAASUVORK5CYII='
  html=html.replace('Mensagem numero ${i}</p>',
     'Mensagem numero ${i}</p>${i===15?`<img alt="native image" src="data:image/png;base64,'+png+'">`:``}')
 await page.set_content(html)
 await page.add_script_tag(content=PORT_MOCK)
 await page.add_script_tag(content=I18N)
 await page.add_script_tag(content=ARCHIVE)
 await page.evaluate('mode=>{window.__threadtomdCaptureMode="native";window.__threadtomdExportMode=mode}',
    'archive' if archive else 'markdown')
 async with page.expect_download(timeout=65000) as download:
  await page.add_script_tag(content=ENGINE)
  for delay in range(1,81):
   await page.wait_for_timeout(600)
   state=await page.evaluate('window.__chatgptMdExporter?.status()')
   if state['fase'] in ('Exportando arquivo','Empacotando'): break
 item=await download.value
 out=await item.path()
 content=out.read_bytes()
 if archive:
  with zipfile.ZipFile(io.BytesIO(content)) as z:
   md=z.read('conversation.md').decode()
   assert '"scanStatus": "stabilized-not-independently-verified"' in z.read('manifest.json').decode()
   assert any(name.startswith('assets/images/') for name in z.namelist()),z.namelist()
 else: md=content.decode()
 state=await page.evaluate('window.__chatgptMdExporter.status()')
 stats=await page.evaluate('window.__nativeE2e')
 count=len(re.findall(r'^## \d+\. ',md,re.M))
 assert count==88,(count,state,md[:1000])
 assert all(f'Mensagem numero {i}' in md and f'Resposta numero **{i}**' in md for i in range(44))
 pieces=re.split(r'^## \d+\. (User|Assistant)\n',md,flags=re.M)[1:]
 observed=[]
 for role,body in zip(pieces[::2],pieces[1::2]):
  m=re.search(r'(?:Mensagem numero|Resposta numero \*\*)\s*(\d+)',body)
  assert m,(role,body[:100])
  observed.append((role,int(m.group(1))))
 assert observed==[(r,i) for i in range(44) for r in ('User','Assistant')],observed
 assert state['metodo']=='native',state
 assert state['limiteAntigo']=='native-wheel-stabilized-heuristic',state
 assert state['erros']==[],state
 assert stats['trusted']>40 and stats['wheels']>40,(stats,state)
 assert state['eventosNative']==stats['wheels'],(stats,state)
 assert state['wheelTrusted']==stats['trusted'],(stats,state)
 assert not errors,errors
 print('PASS native', 'ZIP' if archive else 'Markdown',count,'messages,',stats['wheels'],'real CDP wheels',flush=True)
 await ctx.close()

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  import sys
  if '--zip-only' not in sys.argv: await run(browser)
  if '--md-only' not in sys.argv: await run(browser,True)
  await browser.close()
if __name__=='__main__': asyncio.run(main())
