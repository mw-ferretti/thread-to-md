#!/usr/bin/env python3
"""End-to-end synthetic ChatGPT DOM tests for both layouts + ASCII diagrams."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
I18N_JS=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
# Keep production timeouts but shorten delays in synthetic tests only.
TEST_JS=(JS.replace('stepDelay: 260','stepDelay: 60')
           .replace('initialWaitMs: 10000','initialWaitMs: 2500')
           .replace('edgeDelay: 1000','edgeDelay: 260')
           .replace('olderQuietMs: 24000','olderQuietMs: 1500')
           .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 350')
           .replace('newerQuietMs: 4000','newerQuietMs: 550'))
with sync_playwright() as p:
    browser_args={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    for label in ('old','new'):
        browser=p.chromium.launch(headless=True, args=['--no-sandbox','--disable-gpu'], **browser_args)
        context=browser.new_context(accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content((ROOT/f'tests/fixtures/{label}.html').read_text(encoding='utf-8'))
        with page.expect_download(timeout=90000) as download:
            page.add_script_tag(content=I18N_JS)
            page.evaluate(TEST_JS)
        target=ROOT/f'.test-{label}.md'
        download.value.save_as(target)
        md=target.read_text(encoding='utf-8')
        target.unlink()
        expect=88 if label=='new' else 44
        count=len(re.findall(r'^## \d+\. ',md,re.M))
        assert count==expect,(label,count,expect)
        if label=='new':
            assert all(f'Mensagem numero {i}' in md and f'Resposta numero **{i}**' in md for i in range(44))
        else:
            assert all((f'Mensagem numero {i}' in md if i%2==0 else f'Resposta numero {i}' in md) for i in range(44))
        assert 'TEXTO OCULTO' not in md
        assert 'stabilized-heuristic' in md
        assert 'ThreadToMD 0.2.4' in md
        assert not errors, errors
        print(f'PASS {label}: {count} messages',flush=True)
        page.close()
        context.close()
        browser.close()
