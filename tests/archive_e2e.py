#!/usr/bin/env python3
"""Archive-mode E2E: DOM -> ZIP -> Markdown/asset links (synthetic private data only)."""
from pathlib import Path
from zipfile import ZipFile
import re, json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
base=(ROOT/'src/exporter.js').read_text(encoding='utf-8')
TEST_JS=(base.replace('stepDelay: 260','stepDelay: 40')
    .replace('initialWaitMs: 10000','initialWaitMs: 2500')
    .replace('edgeDelay: 1000','edgeDelay: 150')
    .replace('olderQuietMs: 24000','olderQuietMs: 650')
    .replace('olderProbeIntervalMs: 6000','olderProbeIntervalMs: 150')
    .replace('newerQuietMs: 4000','newerQuietMs: 350'))
HTML='''<!doctype html><html><head><title>Exportar historico para Markdown - ChatGPT</title></head><body><main>
<div data-app-action-timeline-scroll role="region" id="timeline" style="height:380px;overflow:auto;">
  <div style="min-height:680px;padding-top:10px;">
    <div data-turn-key="11111111-1111-4111-8111-111111111111">
      <div data-content-search-unit-key="fixture:1:user" data-chatgpt-search-message-ids="11111111-1111-4111-8111-111111111112">
        <div data-user-message-bubble="true"><p>My picture:</p><img alt="blue square" id="picture">
          <p>Read <a href="data:application/pdf,%25PDF-1.4%0Aexample" download="example.pdf">example.pdf</a>.</p>
        </div>
      </div>
    </div>
    <div data-turn-key="22222222-2222-4222-8222-222222222222">
      <div data-content-search-unit-key="fixture:2:assistant" data-chatgpt-search-message-ids="22222222-2222-4222-8222-222222222223">
        <div data-markdown-text-style="assistant-message"><p>Screenshot:</p>
          <img id="blob-picture" alt="attached chart">
          <p>Second image: <img id="picture-duplicate" alt="same blue square"></p>
          <p><a href="sandbox:/mnt/data/missing.zip" download="missing.zip">missing.zip</a></p>
          <button data-testid="file-attachment">internal-file.docx</button>
          <p>Code:</p><pre><code>  A\n  |\n  B</code></pre>
        </div>
      </div>
    </div>
  </div>
</div></main></body></html>'''

with sync_playwright() as p:
    kwargs={'executable_path':'/usr/bin/chromium'} if Path('/usr/bin/chromium').exists() else {}
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'],**kwargs)
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(HTML)
    page.evaluate('''() => {
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5iXQAAAAASUVORK5CYII=';
      document.getElementById('picture').src = 'data:image/png;base64,' + png;
      document.getElementById('picture-duplicate').src = 'data:image/png;base64,' + png;
      const binary = Uint8Array.from(atob(png), ch => ch.charCodeAt(0));
      document.getElementById('blob-picture').src=URL.createObjectURL(new Blob([binary], {type:'image/png'}));
      window.__threadtomdExportMode='archive';
    }''')
    page.add_script_tag(content=(ROOT/'src/i18n.js').read_text())
    page.add_script_tag(content=(ROOT/'src/archive.js').read_text())
    with page.expect_download(timeout=25000) as download:
        page.evaluate(TEST_JS)
    target=ROOT/'.test-archive.zip'
    assert download.value.suggested_filename.startswith('chatgpt-conversation-'), download.value.suggested_filename
    download.value.save_as(target)
    assert not errors, errors
    with ZipFile(target) as z:
        assert z.testzip() is None, 'Bad ZIP CRC'
        names=z.namelist()
        md=z.read('conversation.md').decode()
        manifest=json.loads(z.read('manifest.json'))
        print('names',names,flush=True)
        print('summary',manifest['summary'],flush=True)
        print('MD body:',md[-1300:],flush=True)
        assert len(re.findall(r'^## \d+\. ',md,re.M))==2
        assert md.index('My picture') < md.index('Read') < md.index('Screenshot')
        assert '[example.pdf](assets/documents/' in md
        assert md.count('![blue square](assets/images/')==1
        assert re.search(r'^!\[attached chart\]\(assets/images/',md,re.M), 'Image must render, not be indented into a code block'
        assert '[Attachment unavailable: internal-file.docx]' in md
        assert '![same blue square](assets/images/' in md
        assert '[missing.zip](sandbox:/mnt/data/missing.zip)' in md
        assert '```text\n  A\n  |\n  B\n```' in md
        assert len([n for n in names if n.startswith('assets/images/')])==2
        assert len([n for n in names if n.startswith('assets/documents/')])==1
        assert manifest['summary']['saved']==3
        assert manifest['summary']['missing']==2
        for asset in manifest['assets']:
            if asset['status']=='saved':
                assert asset['path'] in names
                assert f'({asset["path"]})' in md
    target.unlink()
    print('PASS archive e2e: ZIP valid, images and document embedded, 2 missing noted',flush=True)
    page.close();context.close();browser.close()
