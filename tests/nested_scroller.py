#!/usr/bin/env python3
"""Timeline may be marked on an inner non-scrolling wrapper."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
js=(ROOT/'src/exporter.js').read_text()
for a,b in [('stepDelay: 260','stepDelay: 20'),('edgeDelay: 1000','edgeDelay: 120'),('olderQuietMs: 24000','olderQuietMs: 600'),('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 160'),('olderMinProbes: 3','olderMinProbes: 1'),('olderMaxWaitMs: 90000','olderMaxWaitMs: 2500'),('newerQuietMs: 4000','newerQuietMs: 200')]:js=js.replace(a,b)
html='''<!doctype html><html><body>
<div id="realScroller" style="overflow-y:auto;height:420px;width:800px">
  <div id="timeline" data-app-action-timeline-scroll role="region" style="height:3000px">
   <div id="turns"></div>
  </div>
</div><script>
const turns=document.getElementById('turns');
turns.innerHTML=Array.from({length:18},(_,i)=>{
 let id='12345678-0000-4000-8000-'+String(i+1).padStart(12,'0');
 return `<div data-turn-key="${id}" style="height:165px"><div data-content-search-unit-key="turn-${i}:0:user" data-chatgpt-search-message-ids="${id}"><div data-user-message-bubble="true">Content ${i}</div></div></div>`;
}).join('');
const root=document.getElementById('realScroller'); root.scrollTop=5000;
</script></body></html>'''
with sync_playwright() as p:
    kw={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    b=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    c=b.new_context(accept_downloads=True);page=c.new_page();page.set_content(html)
    page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
    with page.expect_download(timeout=18000) as d:page.evaluate(js)
    path=ROOT/'.test-nested-scroller.md';d.value.save_as(path)
    text=path.read_text();path.unlink()
    state=page.evaluate('window.__chatgptMdExporter.status()')
    assert state['rolagem']['scrollRootId']=='realScroller', state
    assert state['mensagens']==18, state
    assert 'PARTIAL' not in text, text[:800]
    print('PASS: ancestor-scroller selected, 18 messages exported', flush=True)
    c.close();b.close()
