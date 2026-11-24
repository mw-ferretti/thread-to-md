#!/usr/bin/env python3
"""Auto scroll-cycle -> safe assisted handoff E2E on deterministic virtualized-page fixture."""
from pathlib import Path
import re, io, zipfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
I18N=(ROOT/'src/i18n.js').read_text()
ARCHIVE=(ROOT/'src/archive.js').read_text()
EXPORT=(ROOT/'src/exporter.js').read_text().replace('stepDelay: 260','stepDelay: 40')
FIXTURE='''<!doctype html><html><head><meta charset="UTF-8"><title>Cycle fixture</title></head><body>
  <div data-app-action-timeline-scroll role="region" id="timeline" style="height:410px;width:720px;overflow:auto;position:relative">
  <div style="height:9000px"></div>
  <div data-turn-key="12345678-0000-4000-8000-000000000100" id="turn-0"><div data-content-search-unit-key="k:1:user"><div data-user-message-bubble="true">Already captured message</div></div></div>
  </div>
  <script>
  let resets=0;
  const el=document.querySelector('#timeline');
  el.scrollTop=el.scrollHeight;
  const max=()=>el.scrollHeight-el.clientHeight;
  el.addEventListener('scroll',()=>{
    if(el.scrollTop < max()-850){
      ++resets;
      // Match the ChatGPT symptom: the virtualizer jumps back toward the end.
      el.scrollTop=max();
    }
  });
  window.__cycle=()=>({resets,top:el.scrollTop,max:max()});
  </script></body></html>'''

with sync_playwright() as p:
    exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
    for fmt in ('markdown','archive'):
        ctx=browser.new_context(accept_downloads=True)
        page=ctx.new_page()
        failures=[]
        page.on('pageerror', lambda err:failures.append(str(err)))
        page.set_content(FIXTURE)
        page.add_script_tag(content=I18N)
        page.add_script_tag(content=ARCHIVE)
        page.evaluate("mode => {window.__threadtomdCaptureMode='automatic'; window.__threadtomdExportMode=mode}",fmt)
        page.add_script_tag(content=EXPORT)
        page.wait_for_function("window.__chatgptMdExporter?.status().metodo === 'assisted-fallback'",timeout=18000)
        state=page.evaluate('window.__chatgptMdExporter.status()')
        assert state['fase']=='Captura assistida', state
        assert state['mensagens']==1, state
        assert state['passosSemNovasMensagens']>=24, state
        assert state['saltosReversos']>=3, state
        assert page.locator('#threadtomd-progress-panel button').inner_text()=='Finish & save partial'
        assert page.evaluate('window.__cycle().resets')>=3
        before=page.evaluate('window.__cycle().resets')
        page.wait_for_timeout(450)
        assert page.evaluate('window.__cycle().resets')==before, 'Still trying automatic scroll during handoff'
        page.evaluate('''() => {
          const div=document.createElement('div');
          div.setAttribute('data-turn-key','12345678-0000-4000-8000-000000000200');
          div.innerHTML='<div data-content-search-unit-key="k:2:user"><div data-user-message-bubble="true">Manually discovered after fallback</div></div>';
          document.querySelector('#timeline').appendChild(div);
        }''')
        page.wait_for_function('window.__chatgptMdExporter.status().mensagens===2',timeout=4500)
        with page.expect_download(timeout=20000) as pending:
            page.locator('#threadtomd-progress-panel button').click()
        output=pending.value.path().read_bytes()
        if fmt=='archive':
            with zipfile.ZipFile(io.BytesIO(output)) as z:
                md=z.read('conversation.md').decode()
                assert '"scanStatus": "partial"' in z.read('manifest.json').decode()
        else:
            md=output.decode()
        assert 'Already captured message' in md and 'Manually discovered after fallback' in md
        assert 'AUTOMATIC SCROLL LOOP' in md
        assert 'auto-scroll-cycle-assisted-fallback' in md
        assert 'PARTIAL' in md
        assert len(re.findall(r'^## \d+\. ',md,re.M))==2
        assert not failures, failures
        print(f'PASS auto-loop handoff {fmt}: {state["saltosReversos"]} reverse jumps, 2 preserved messages, partial export')
        ctx.close()
    browser.close()
