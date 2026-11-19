#!/usr/bin/env python3
"""An unresolved loading indicator must cause a partial warning, not success."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'src/exporter.js').read_text()
I18N_JS=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
TEST_JS=(JS.replace('stepDelay: 260','stepDelay: 20')
           .replace('edgeDelay: 1000','edgeDelay: 120')
           .replace('olderQuietMs: 24000','olderQuietMs: 700')
           .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 200')
           .replace('olderMinProbes: 3','olderMinProbes: 1')
           .replace('olderMaxWaitMs: 90000','olderMaxWaitMs: 2500')
           .replace('newerQuietMs: 4000','newerQuietMs: 200'))
with sync_playwright() as p:
    kw={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    page.set_content((ROOT/'tests/fixtures/old.html').read_text())
    page.evaluate("""() => {
        const spinner=document.createElement('div');
        spinner.setAttribute('aria-busy','true');
        spinner.style.position='absolute';spinner.style.top='0';
        document.getElementById('scrollbox').appendChild(spinner);
    }""")
    with page.expect_download(timeout=15000) as result:
        page.add_script_tag(content=I18N_JS)
        page.evaluate(TEST_JS)
    target=ROOT/'.test-timeout.md';result.value.save_as(target)
    data=target.read_text();target.unlink()
    assert 'PARTIAL: review warnings' in data, data[:900]
    assert 'Upper boundary: timed-out' in data, data[:900]
    assert 'beginning is unconfirmed' in data, data[:900]
    print('PASS timeout: stalled loader is explicitly marked partial',flush=True)
    page.close();context.close();browser.close()
