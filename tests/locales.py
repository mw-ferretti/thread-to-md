#!/usr/bin/env python3
"""Browser-level verification of localized Markdown without changing captured messages."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
I18N=(ROOT/'src/i18n.js').read_text(encoding='utf-8')
JS=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
JS=(JS.replace('stepDelay: 260','stepDelay: 65')
       .replace('edgeDelay: 1000','edgeDelay: 250')
       .replace('olderQuietMs: 24000','olderQuietMs: 1300')
       .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 300')
       .replace('newerQuietMs: 4000','newerQuietMs: 380'))
with sync_playwright() as p:
    kw={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kw)
    for language,role,header,slug in (
        ('pt-BR','Usu\u00e1rio','Mensagens capturadas','conversa-chatgpt-'),
        ('pt-PT','User','Captured messages','chatgpt-conversation-'),
        ('en-US','User','Captured messages','chatgpt-conversation-')
    ):
        ctx=browser.new_context(locale=language,accept_downloads=True)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content((ROOT/'tests/fixtures/old.html').read_text(encoding='utf-8'))
        page.evaluate("document.title = 'Exportar historico para Markdown - ChatGPT'")
        page.add_script_tag(content=I18N)
        with page.expect_download(timeout=60000) as d:
            page.evaluate(JS)
        assert d.value.suggested_filename.startswith(slug), d.value.suggested_filename
        output=ROOT/'.test-locale.md'
        d.value.save_as(output)
        content=output.read_text(encoding='utf-8')
        output.unlink()
        assert header+': 44' in content,(language,content[:300])
        assert f'## 1. {role}' in content,(language,content[:500])
        assert 'Mensagem numero 0' in content,(language,'conversation content changed')
        assert len(re.findall(r'^## \d+\. ',content,re.M))==44
        assert not errors,errors
        print(f'PASS language {language}: 44 messages, metadata {header}',flush=True)
        ctx.close()
    browser.close()
