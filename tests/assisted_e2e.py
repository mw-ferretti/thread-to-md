#!/usr/bin/env python3
"""Assisted scroll E2E in a virtualized Chat/Work fixture, no live login."""
from pathlib import Path
import re, zipfile, io
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
I18N=(ROOT/'src/i18n.js').read_text()
ARCHIVE=(ROOT/'src/archive.js').read_text()
EXPORT=(ROOT/'src/exporter.js').read_text()
PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+ylQAAAAASUVORK5CYII='


def run_case(browser, archive=False):
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    html=(ROOT/'tests/fixtures/new.html').read_text()
    if archive:
        html=html.replace('Mensagem numero ${i}</p>',
            'Mensagem numero ${i}</p>${i===15?`<img alt="one" src="data:image/png;base64,'+PNG+'">`:``}')
    page.set_content(html)
    page.add_script_tag(content=I18N)
    page.add_script_tag(content=ARCHIVE)
    page.evaluate("""(mode) => {
        window.__threadtomdCaptureMode = 'assisted';
        window.__threadtomdExportMode = mode;
    }""", 'archive' if archive else 'markdown')
    page.add_script_tag(content=EXPORT)
    page.wait_for_function("window.__chatgptMdExporter?.status().fase === 'Captura assistida'", timeout=6000)
    first_top=page.evaluate("document.getElementById('scrollbox').scrollTop")
    page.wait_for_timeout(750)
    assert page.evaluate("document.getElementById('scrollbox').scrollTop") == first_top, 'assisted mode moved the page on its own'
    assert page.evaluate("window.__chatgptMdExporter.status().metodo") == 'assisted'
    assert page.locator('#threadtomd-progress-panel button').inner_text() == 'Finish & save partial'
    # Chromium browser native mouse input: NOT scripted scrollTop.
    page.mouse.move(200,250)
    for step in range(150):
        page.mouse.wheel(0,-460)
        page.wait_for_timeout(85)
        if page.evaluate("first === 0 && document.querySelector('#win')?.textContent.includes('Mensagem numero 0')") and step > 8:
            break
    else:
        raise AssertionError('fixture did not load all historical pages')
    for step in range(45):
        page.mouse.wheel(0,510)
        page.wait_for_timeout(90)
    state=page.evaluate('window.__chatgptMdExporter.status()')
    assert state['eventosWheelAcima'] > 0 and state['eventosWheelAbaixo'] > 0, state
    with page.expect_download(timeout=45000) as download:
        page.locator('#threadtomd-progress-panel button').click()
    item=download.value
    data=item.path().read_bytes()
    if archive:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            md=z.read('conversation.md').decode()
            assert 'manifest.json' in z.namelist()
            manifest=z.read('manifest.json').decode()
            assert '"scanStatus": "partial"' in manifest
            assert 'assets/images/' in ' '.join(z.namelist()), z.namelist()
    else:
        md=data.decode()
    headings=re.findall(r'^## \d+\. ', md, re.M)
    assert len(headings)==88, (len(headings), state, md[:1000])
    for i in range(44):
        assert f'Mensagem numero {i}' in md and f'Resposta numero **{i}**' in md, i
    # Every message appears exactly once and in chronological order.
    parts=re.split(r'^## \d+\. (User|Assistant)\n', md, flags=re.M)[1:]
    observed=[]
    for role, body in zip(parts[::2],parts[1::2]):
        match=re.search(r'(?:Mensagem numero|Resposta numero \*\*)\s*(\d+)' , body)
        assert match, (role, body[:140])
        observed.append((role,int(match.group(1))))
    assert observed==[(r,i) for i in range(44) for r in ('User','Assistant')], observed
    assert 'ASSISTED / UNVERIFIED' in md
    assert 'PARTIAL' in md
    assert 'assisted-user-scrolled-unverified' in md
    assert 'stabilized-heuristic' not in md
    assert not errors, errors
    print(f'PASS assisted {"ZIP" if archive else "Markdown"}: {len(headings)} messages, wheel up/down {state["eventosWheelAcima"]}/{state["eventosWheelAbaixo"]}')
    page.close();context.close()


def run_root_replace(browser):
    context=browser.new_context(accept_downloads=True)
    page=context.new_page()
    html="""<!doctype html><html><body><main>
    <div data-app-action-timeline-scroll role="region" id="box" style="height:400px;overflow-y:auto">
    <div data-turn-key="11111111-aaaa-4444-aaaa-111111111111"><div data-content-search-unit-key="t:0:user"><div data-user-message-bubble="true">First user</div></div></div><div style="height:600px"></div>
    </div></main></body></html>"""
    page.set_content(html)
    page.add_script_tag(content=I18N)
    page.add_script_tag(content=ARCHIVE)
    page.evaluate("window.__threadtomdCaptureMode='assisted';window.__threadtomdExportMode='markdown'")
    page.add_script_tag(content=EXPORT)
    page.wait_for_function("window.__chatgptMdExporter?.status().fase === 'Captura assistida'")
    page.evaluate("""() => {
      const old = document.querySelector('#box');
      const next = old.cloneNode(true);
      next.querySelector('[data-turn-key]').setAttribute('data-turn-key','22222222-bbbb-4444-bbbb-222222222222');
      next.querySelector('[data-user-message-bubble]').textContent = 'Second user';
      old.replaceWith(next);
    }""")
    page.wait_for_function("window.__chatgptMdExporter.status().mensagens===2",timeout=5000)
    with page.expect_download() as d:
        page.locator('#threadtomd-progress-panel button').click()
    md=d.value.path().read_text()
    assert 'First user' in md and 'Second user' in md
    print('PASS root replacement and Finish button')
    page.close();context.close()


with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    run_case(browser, archive=False)
    run_case(browser, archive=True)
    run_root_replace(browser)
    browser.close()
