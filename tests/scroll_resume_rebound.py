#!/usr/bin/env python3
"""Simulate the reported bug: lose focus mid-scan, ChatGPT jumps to the
latest turn, then attempts to jump to the latest turn on subsequent scrolls.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
I18N = (ROOT / 'src/i18n.js').read_text(encoding='utf-8')
JS = (ROOT / 'src/exporter.js').read_text(encoding='utf-8')
JS = (JS.replace('stepDelay: 260', 'stepDelay: 70')
        .replace('edgeDelay: 1000', 'edgeDelay: 250')
        .replace('olderQuietMs: 24000', 'olderQuietMs: 1550')
        .replace('olderProbeIntervalMs: 6000', 'olderProbeIntervalMs: 370')
        .replace('olderMaxWaitMs: 90000', 'olderMaxWaitMs: 7000')
        .replace('newerQuietMs: 4000', 'newerQuietMs: 440'))

with sync_playwright() as p:
    kw = {'executable_path': '/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-gpu'], **kw)
    for scenario in ('sporadic', 'persistent'):
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        failures = []
        page.on('pageerror', lambda err: failures.append(str(err)))
        page.set_content((ROOT / 'tests/fixtures/new.html').read_text(encoding='utf-8'))
        page.evaluate('''(scenario) => {
            window.__attention = {focused:true};
            document.hasFocus = () => window.__attention.focused;
            const root = document.getElementById('scrollbox');
            const test = window.__resumeRebound = {
                remaining: scenario === 'sporadic' ? 7 : 10000,
                applied: 0, armed: false, pending: false
            };
            root.addEventListener('scroll', () => {
                const max = root.scrollHeight - root.clientHeight;
                if (!test.armed || test.remaining <= 0 ||
                    test.pending || root.scrollTop >= max - 25) return;
                test.pending = true;
                setTimeout(() => {
                    test.pending = false;
                    const m = root.scrollHeight - root.clientHeight;
                    if (test.armed && test.remaining > 0 && root.scrollTop < m-25) {
                        test.applied++;
                        test.remaining--;
                        root.scrollTop = m;
                    }
                }, 14);
            });
        }''', scenario)
        page.add_script_tag(content=I18N)
        page.evaluate(JS)
        page.wait_for_function('window.__chatgptMdExporter?.status()?.passos >= 2', timeout=20000)
        page.evaluate('''() => {
            window.__attention.focused = false;
            window.dispatchEvent(new Event('blur'));
        }''')
        page.wait_for_function('window.__chatgptMdExporter?.status()?.pausado', timeout=3000)
        before = page.evaluate('window.__chatgptMdExporter.status()')
        page.evaluate('''() => {
            const box = document.getElementById('scrollbox');
            box.scrollTop = box.scrollHeight - box.clientHeight;
        }''')
        page.wait_for_timeout(350)
        paused = page.evaluate('window.__chatgptMdExporter.status()')
        assert paused['passos'] == before['passos'], (scenario, before, paused)
        with page.expect_download(timeout=60000) as dl:
            page.evaluate('''() => {
                window.__resumeRebound.armed = true;
                window.__attention.focused = true;
                window.dispatchEvent(new Event('focus'));
            }''')
        output = ROOT / f'.test-focus-rebound-{scenario}.md'
        dl.value.save_as(output)
        text = output.read_text(encoding='utf-8')
        output.unlink()
        found = len(re.findall(r'^## \d+\. ', text, re.M))
        state = page.evaluate('''() => ({...window.__resumeRebound,
            status:window.__chatgptMdExporter.status()})''')
        assert not failures, (scenario, failures)
        assert state['applied'] >= 7, (scenario, state)
        if scenario == 'sporadic':
            assert found == 88, (scenario, found, state)
            assert 'Status: Scan completed' in text, (scenario, text[:700])
            print('PASS: pause/resume and 7 rebounds recovered all 88 messages', flush=True)
        else:
            assert found < 88, (scenario, found, state)
            assert 'Status: PARTIAL' in text, (scenario, text[:800])
            assert state['status']['passos'] < 180, (scenario, state)
            assert 'scroll position' in text.lower(), (scenario, text[:800])
            print(f'PASS: pause/resume persistent rebound stopped safely at {found}/88', flush=True)
        context.close()
    browser.close()
