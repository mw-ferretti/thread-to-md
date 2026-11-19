#!/usr/bin/env python3
"""Accelerated four-batch lazy loading regression for CI / local quick checks."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'tests/fixtures/slow-older.html').read_text(encoding='utf-8')
assert '},4800);' in HTML
HTML=HTML.replace('},4800);','},1000);')
JS=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
JS=(JS.replace('stepDelay: 260','stepDelay: 50')
       .replace('edgeDelay: 1000','edgeDelay: 250')
       .replace('olderQuietMs: 24000','olderQuietMs: 3500')
       .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 650')
       .replace('olderMaxWaitMs: 90000','olderMaxWaitMs: 12000')
       .replace('newerQuietMs: 4000','newerQuietMs: 400'))
I18N=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    kw={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML)
    page.add_script_tag(content=I18N)
    with page.expect_download(timeout=45000) as result:
        page.evaluate(JS)
    output=ROOT/'.test-slow-older-fast.md'
    result.value.save_as(output)
    body=output.read_text(encoding='utf-8'); output.unlink()
    assert len(re.findall(r'^## \d+\. ',body,re.M))==160
    assert all(f'Slow user {i}' in body and f'Slow assistant {i}' in body for i in range(80))
    state=page.evaluate('window.__fixtureStatus()')
    assert state['first']==0 and state['loads']==4,state
    assert not errors,errors
    print('PASS slow-older-fast: 160/160, four asynchronous older batches',flush=True)
    context.close();browser.close()
