#!/usr/bin/env python3
"""A changing scrollHeight must not hide a repeated jump to newer turns.

This models the Chrome report: the same nine units remain available in a
virtualized window while the app re-anchors the scrollbar after each write.
The synthetic scrollHeight grows, so distance-from-bottom also increases,
which fooled the previous geometry-only watchdog into declaring progress.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / 'src/exporter.js').read_text(encoding='utf-8')
JS = (JS.replace('stepDelay: 260', 'stepDelay: 35')
        .replace('edgeDelay: 1000', 'edgeDelay: 125')
        .replace('olderQuietMs: 24000', 'olderQuietMs: 800')
        .replace('olderProbeIntervalMs: 6000', 'olderProbeIntervalMs: 220')
        .replace('olderMinProbes: 3', 'olderMinProbes: 1')
        .replace('olderMaxWaitMs: 90000', 'olderMaxWaitMs: 4000')
        .replace('newerQuietMs: 4000', 'newerQuietMs: 220'))

HTML = '''<!doctype html><html lang="en"><body>
<div id="scrollbox" role="region" data-app-action-timeline-scroll
  style="height:480px;width:800px;overflow-y:auto;position:relative">
  <div id="space" style="height:6200px"></div>
  <div id="window" style="position:sticky;bottom:0;background:white"></div>
</div>
<script>
const root = document.getElementById('scrollbox');
const space = document.getElementById('space');
const win = document.getElementById('window');
win.innerHTML = Array.from({length:9}, (_,i) => {
  const id='12345678-0000-4000-8000-'+String(i+1).padStart(12,'0');
  return `<div data-turn-key="${id}"><div data-content-search-unit-key="turn-${i}:0:user" data-chatgpt-search-message-ids="${id}"><div data-user-message-bubble="true">Only visible message ${i}</div></div></div>`;
}).join('');
const native = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
root.scrollTop = root.scrollHeight;
window.__phantom = {attempts:0};
Object.defineProperty(root,'scrollTop',{
  configurable:true,
  get() { return native.get.call(this); },
  set(v) {
    native.set.call(this,v);
    if (v < this.scrollHeight-this.clientHeight-5) {
      window.__phantom.attempts++;
      // Every reset grows the scroll range; the distance from the bottom
      // increases despite not exposing any earlier message whatsoever.
      space.style.height = (6200 + window.__phantom.attempts * 1200)+'px';
      const max=this.scrollHeight-this.clientHeight;
      native.set.call(this,Math.max(0,max-(40+window.__phantom.attempts*70)));
    }
  }
});
</script></body></html>'''

with sync_playwright() as p:
    kw = {'executable_path': '/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-gpu'], **kw)
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    page.set_content(HTML)
    page.add_script_tag(content=(ROOT / 'src/i18n.js').read_text(encoding='utf-8'))
    with page.expect_download(timeout=18000) as result:
        page.evaluate(JS)
    output = ROOT / '.test-phantom-progress.md'
    result.value.save_as(output)
    md = output.read_text(encoding='utf-8')
    output.unlink()
    state = page.evaluate('''()=>({phantom:window.__phantom,
        status:window.__chatgptMdExporter.status()})''')
    assert 'Status: PARTIAL' in md, md[:700]
    assert len(re.findall(r'^## \d+\. ', md, re.M)) == 9, state
    assert state['status']['passos'] <= 20, state
    assert state['status']['retornosAoFim'] >= 5, state
    assert state['status']['descobertasAntigas'] == 0, state
    print('PASS: nine-message scroll-height phantom progress bounded as PARTIAL',
          state['status']['passos'], 'steps', flush=True)
    context.close(); browser.close()
