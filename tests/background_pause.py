#!/usr/bin/env python3
"""Simulate hidden tabs / window focus loss at the oldest-edge boundary.

The exported .md must not appear while inactive even when the simulated
quiet/timeout windows would otherwise have elapsed. On foregrounding, the
same instance must resume and export all 88 messages from the virtual DOM.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
I18N=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
ENGINE=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
ENGINE=(ENGINE.replace('stepDelay: 260','stepDelay: 55')
       .replace('edgeDelay: 1000','edgeDelay: 225')
       .replace('olderQuietMs: 24000','olderQuietMs: 1400')
       .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 300')
       .replace('olderMaxWaitMs: 90000','olderMaxWaitMs: 2400')
       .replace('newerQuietMs: 4000','newerQuietMs: 340'))

with sync_playwright() as p:
    kw={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    for case in ('hidden', 'blur'):
        context=browser.new_context(accept_downloads=True)
        page=context.new_page()
        errors=[]; downloads=[]
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.on('download',lambda download: downloads.append(download))
        page.set_content((ROOT/'tests/fixtures/new.html').read_text(encoding='utf-8'))
        page.evaluate('''() => {
           window.__testAttention={hidden:false,focused:true};
           Object.defineProperty(document,'visibilityState',{
             configurable:true, get:()=>window.__testAttention.hidden?'hidden':'visible'
           });
           document.hasFocus=()=>window.__testAttention.focused;
        }''')
        page.add_script_tag(content=I18N)
        page.evaluate(ENGINE)
        # Pause while already probing the oldest currently loaded page.
        page.wait_for_function('window.__chatgptMdExporter?.status()?.sondas >= 1',timeout=25000)
        if case == 'hidden':
            page.evaluate('''() => {
              window.__testAttention.hidden=true;
              document.dispatchEvent(new Event('visibilitychange'));
            }''')
        else:
            page.evaluate('''() => {
              window.__testAttention.focused=false;
              window.dispatchEvent(new Event('blur'));
            }''')
        page.wait_for_function('window.__chatgptMdExporter?.status()?.pausado===true',timeout=3000)
        before=page.evaluate('window.__chatgptMdExporter.status()')
        page.wait_for_timeout(3600) # greater than BOTH quiet and max-wait windows
        during=page.evaluate('window.__chatgptMdExporter.status()')
        assert not downloads, (case,'Premature export while in background')
        assert during['pausado'] and before['passos']==during['passos'],(case,before,during)
        assert during['limiteAntigo']=='not-scanned',(case,during)
        with page.expect_download(timeout=35000) as receipt:
            if case == 'hidden':
                page.evaluate('''() => {
                  window.__testAttention.hidden=false;
                  document.dispatchEvent(new Event('visibilitychange'));
                }''')
            else:
                page.evaluate('''() => {
                  window.__testAttention.focused=true;
                  window.dispatchEvent(new Event('focus'));
                }''')
        output=ROOT/f'.test-background-{case}.md'
        receipt.value.save_as(output)
        data=output.read_text(encoding='utf-8'); output.unlink()
        assert len(re.findall(r'^## \d+\. ',data,re.M))==88,(case,'Lost messages after resume')
        assert 'Upper boundary: stabilized-heuristic' in data,(case,data[:500])
        assert 'ThreadToMD 0.2.4' in data,(case,data[:500])
        assert not errors,(case,errors)
        after=page.evaluate('window.__chatgptMdExporter.status()')
        assert after['pausas']>=1 and after['pausado'] is False,(case,after)
        print(f'PASS background-{case}: 88/88 messages, no premature file, resumed safely',flush=True)
        context.close()
    browser.close()
