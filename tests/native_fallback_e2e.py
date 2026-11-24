#!/usr/bin/env python3
"""Native debugger attach denial hands off to assisted without losing turns."""
from pathlib import Path
import re, io, zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML='''<!doctype html><html><head><title>Native fallback fixture - ChatGPT</title></head><body>
<main><div data-app-action-timeline-scroll role="region" id="box" style="width:650px;height:360px;overflow-y:auto">
<div data-turn-key="11111111-aaaa-4444-aaaa-111111111111"><div data-content-search-unit-key="t:0:user"><div data-user-message-bubble="true"><p>Initial message before debugger denial</p></div></div></div><div style="height:900px"></div>
</div></main></body></html>'''
DENIED_JS='''(() => {
 window.chrome={runtime:{connect(){
  const port={onMessage:{addListener(cb){this.cb=cb}},onDisconnect:{addListener(cb){this.cb=cb}},
   postMessage(){},disconnect(){}};
  queueMicrotask(()=>port.onMessage.cb({type:'error',message:'Debugger denied by browser'}));
  return port;
 }}};
})();'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for fmt in ('markdown','archive'):
  ctx=browser.new_context(accept_downloads=True)
  page=ctx.new_page()
  page.set_content(HTML)
  page.add_script_tag(content=DENIED_JS)
  page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
  page.add_script_tag(content=(ROOT/'src/archive.js').read_text())
  page.evaluate('fmt=>{window.__threadtomdCaptureMode="native";window.__threadtomdExportMode=fmt}',fmt)
  page.add_script_tag(content=(ROOT/'src/exporter.js').read_text())
  page.wait_for_function("window.__chatgptMdExporter?.status().metodo === 'native-assisted-fallback'",timeout=10000)
  state=page.evaluate('window.__chatgptMdExporter.status()')
  assert state['mensagens']==1 and state['fase']=='Captura assistida',state
  assert 'native-wheel-interrupted-assisted-fallback'==state['limiteAntigo']
  assert page.locator('#threadtomd-progress-panel button').inner_text()=='Finish & save partial'
  page.evaluate('''() => {
   const div=document.createElement('div');
   div.setAttribute('data-turn-key','22222222-bbbb-4444-bbbb-222222222222');
   div.innerHTML='<div data-content-search-unit-key="t:1:assistant"><div data-markdown-text-style="assistant-message"><p>Additional message after native failure</p></div></div>';
   document.querySelector('#box').appendChild(div);
  }''')
  page.wait_for_function('window.__chatgptMdExporter.status().mensagens===2',timeout=7000)
  with page.expect_download(timeout=15000) as download:
   page.locator('#threadtomd-progress-panel button').click()
  data=download.value.path().read_bytes()
  md=data.decode() if fmt=='markdown' else zipfile.ZipFile(io.BytesIO(data)).read('conversation.md').decode()
  assert len(re.findall(r'^## \d+\. ',md,re.M))==2
  assert 'Initial message before debugger denial' in md
  assert 'Additional message after native failure' in md
  assert 'native-wheel-interrupted-assisted-fallback' in md
  assert 'NATIVE SCAN INTERRUPTED' in md
  assert 'PARTIAL' in md
  print('PASS debugger denied -> assisted ->',fmt,'preserved both turns',flush=True)
  ctx.close()
 browser.close()
