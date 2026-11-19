#!/usr/bin/env python3
"""Real-time lazy-loading regression: a page needs repeated top entry + 4.8s latency."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
I18N_JS=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
# Deliberately longer than v0.1.1's four-second false-edge condition.
TEST_JS=(JS.replace('stepDelay: 260','stepDelay: 60')
           .replace('edgeDelay: 1000','edgeDelay: 300')
           .replace('olderQuietMs: 24000','olderQuietMs: 6500')
           .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 1200')
           .replace('newerQuietMs: 4000','newerQuietMs: 550'))
with sync_playwright() as p:
    browser_args={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**browser_args)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'tests/fixtures/slow-older.html').read_text(encoding='utf-8'))
    with page.expect_download(timeout=110000) as d:
        page.add_script_tag(content=I18N_JS)
        page.evaluate(TEST_JS)
    output=ROOT/'.test-slow.md';d.value.save_as(output)
    content=output.read_text(encoding='utf-8');output.unlink()
    assert not errors,errors
    entries=re.findall(r'^## \d+\. ',content,re.M)
    status=page.evaluate('window.__fixtureStatus()')
    assert len(entries)==160,(len(entries),status)
    assert status['first']==0,status
    assert status['loads']==4,status
    assert all(f'Slow user {i}' in content and f'Slow assistant {i}' in content for i in range(80))
    assert 'stabilized-heuristic' in content
    print('PASS slow-older: 160/160 messages, four delayed batches, top probes required',flush=True)
    page.close();context.close();browser.close()
