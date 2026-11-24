#!/usr/bin/env python3
"""Regression: ChatGPT's virtualized timeline sporadically snaps to the bottom.

A finite number of rebounds must recover the full history. A persistent
rebound must produce a PARTIAL file and a clear warning rather than looping.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
I18N = (ROOT / 'src/i18n.js').read_text(encoding='utf-8')
ENGINE = (ROOT / 'src/exporter.js').read_text(encoding='utf-8')
TEST_ENGINE = (ENGINE.replace('stepDelay: 260', 'stepDelay: 65')
    .replace('edgeDelay: 1000', 'edgeDelay: 240')
    .replace('olderQuietMs: 24000', 'olderQuietMs: 1600')
    .replace('olderProbeIntervalMs: 6000', 'olderProbeIntervalMs: 360')
    .replace('olderMaxWaitMs: 90000', 'olderMaxWaitMs: 7000')
    .replace('newerQuietMs: 4000', 'newerQuietMs: 430'))

with sync_playwright() as p:
    kw = {'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser = p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    for case in ('sporadic', 'persistent'):
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.set_content((ROOT / 'tests/fixtures/new.html').read_text(encoding='utf-8'))
        # Interfere ONLY with upward movement, mimicking an app-driven
        # scroll-to-latest effect that fires after the exporter's scrollTop write.
        page.evaluate('''(mode) => {
            const box = document.querySelector('#scrollbox');
            const fixture = window.__scrollRebound = {remaining: mode === 'sporadic' ? 7 : 10000,
                applied: 0, pending: false};
            box.addEventListener('scroll', () => {
                const maximum = box.scrollHeight - box.clientHeight;
                if (fixture.remaining <= 0 || fixture.pending || box.scrollTop >= maximum-25) return;
                fixture.pending = true;
                setTimeout(() => {
                    fixture.pending = false;
                    const max = box.scrollHeight-box.clientHeight;
                    if (fixture.remaining > 0 && box.scrollTop < max-25) {
                        fixture.applied++;
                        fixture.remaining--;
                        box.scrollTop = max;
                    }
                }, 15);
            });
        }''', case)
        page.add_script_tag(content=I18N)
        with page.expect_download(timeout=45000) as result:
            page.evaluate(TEST_ENGINE)
        output = ROOT / f'.test-rebound-{case}.md'
        result.value.save_as(output)
        md = output.read_text(encoding='utf-8')
        output.unlink()
        count = len(re.findall(r'^## \d+\. ', md, re.M))
        state = page.evaluate('''() => ({...window.__scrollRebound,
            exporter: window.__chatgptMdExporter.status()})''')
        assert not errors, (case, errors)
        assert state['applied'] >= 7, (case, state)
        if case == 'sporadic':
            assert count == 88, (case, count, state)
            assert 'Status: Scan completed' in md, (case, md[:750])
            assert 'Mensagem numero 0' in md, (case, count)
            print('PASS sporadic rebound: recovered 88/88 messages', flush=True)
        else:
            assert count < 88, (case, count, state)
            assert 'Status: PARTIAL' in md, (case, md[:800])
            assert 'scroll position' in md.lower(), (case, md[:800])
            assert state['exporter']['retornosAoFim'] or state['exporter']['recuperacoesRolagem'], (case, state)
            assert state['exporter']['passos'] < 140, (case, state)
            print(f'PASS persistent rebound: partial {count}/88; bounded {state["exporter"]["passos"]} steps', flush=True)
        context.close()
    browser.close()
