#!/usr/bin/env python3
"""Verify ASCII code fences stay intact in a synthetic ChatGPT UI."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
I18N_JS=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
TEST_JS=(JS.replace('stepDelay: 260','stepDelay: 20')
           .replace('initialWaitMs: 10000','initialWaitMs: 2500')
           .replace('edgeDelay: 1000','edgeDelay: 120')
           .replace('olderQuietMs: 24000','olderQuietMs: 800')
           .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 200')
           .replace('newerQuietMs: 4000','newerQuietMs: 450'))
with sync_playwright() as p:
    browser_args={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    # code fence regression from browser-rendered "Plain text" code widget
    browser=p.chromium.launch(headless=True, args=['--no-sandbox','--disable-gpu'], **browser_args)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    page.set_content("""<!doctype html><html><title>ASCII fixture - ChatGPT</title><main>
      <div data-app-action-timeline-scroll role="region" style="height:360px;overflow:auto"><div style="height:480px">
      <div data-turn-key="11111111-1111-4111-8111-111111111111">
      <div data-content-search-unit-key="fallback:1:assistant" data-chatgpt-search-message-ids="11111111-1111-4111-8111-111111111113">
      <div data-markdown-text-style="assistant-message"><p>Diagram:</p><div>Plain text<code>      A
      │
  ┌───┴───┐
  ↓       ↓
  B       C</code></div><p>inline <code>value</code>.</p></div>
      </div></div></div></main></html>""")
    with page.expect_download(timeout=90000) as download:
        page.add_script_tag(content=I18N_JS)
        page.evaluate(TEST_JS)
    target=ROOT/'.test-ascii.md'
    download.value.save_as(target)
    md=target.read_text(encoding='utf-8')
    target.unlink()
    assert '```text\n      A\n      │\n  ┌───┴───┐\n  ↓       ↓\n  B       C\n```' in md,repr(md)
    assert 'inline `value`.' in md
    print('PASS ASCII: fenced diagrams keep whitespace',flush=True)
    page.close()
    context.close()
    browser.close()
