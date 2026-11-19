#!/usr/bin/env python3
"""Validate that both distributables contain the cross-browser popup fix."""
from pathlib import Path
from zipfile import ZipFile
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
version = manifest['version']
for browser in ('chrome', 'firefox'):
    archive = ROOT / 'dist' / f'threadtomd-{browser}-{version}.zip'
    assert archive.is_file(), f'Missing {archive}'
    with ZipFile(archive) as z:
        assert z.testzip() is None, f'Invalid ZIP: {browser}'
        names = set(z.namelist())
        assert {'manifest.json', 'src/exporter.js', 'src/i18n.js', 'src/archive.js', 'background/assets.js', 'background/worker.js', 'background/permission_popup.js', 'popup/popup.js', 'popup/popup.html', '_locales/en/messages.json', '_locales/pt_BR/messages.json'} <= names
        pkg = json.loads(z.read('manifest.json'))
        assert pkg['version'] == version
        assert pkg['permissions'] == ['activeTab', 'scripting', 'storage']
        assert 'https://images.openai.com/*' in pkg['optional_host_permissions']
        assert pkg['background']['service_worker'] == 'background/worker.js'
        assert pkg['background']['scripts'] == ['background/assets.js','background/permission_popup.js']
        assert pkg['default_locale'] == 'en'
        assert pkg['name'] == '__MSG_extensionName__'
        assert ('browser_specific_settings' in pkg) == (browser == 'firefox')
        assert z.read('popup/popup.js') == (ROOT / 'popup/popup.js').read_bytes()
        assert f"v{version} &middot;" not in z.read('popup/popup.html').decode('utf-8')  # version uses a Unicode middle dot
        assert f'v{version} · ' in z.read('popup/popup.html').decode('utf-8')
        assert '<script src="../src/i18n.js"></script>' in z.read('popup/popup.html').decode('utf-8')
        assert z.read('src/i18n.js') == (ROOT / 'src/i18n.js').read_bytes()
        assert z.read('src/exporter.js') == (ROOT / 'src/exporter.js').read_bytes()
        assert z.read('src/archive.js') == (ROOT / 'src/archive.js').read_bytes()
        assert z.read('background/assets.js') == (ROOT / 'background/assets.js').read_bytes()
        assert z.read('background/permission_popup.js') == (ROOT / 'background/permission_popup.js').read_bytes()
        assert z.read('background/worker.js') == (ROOT / 'background/worker.js').read_bytes()
        popup = z.read('popup/popup.js').decode('utf-8')
        assert "files: ['/src/i18n.js', '/src/archive.js', '/src/exporter.js']" in popup
        assert 'window.close();' in popup
    print(f'PASS {browser}: archive OK, version {version}, i18n, path and popup close verified')
