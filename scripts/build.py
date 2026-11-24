#!/usr/bin/env python3
"""Build unpacked extension folders and installable archives using Python stdlib."""
from pathlib import Path
import json, shutil, zipfile

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
base=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
files=['background/assets.js','background/worker.js','background/permission_popup.js','background/native_wheel.js','popup/popup.html','popup/popup.css','popup/popup.js','src/i18n.js','src/archive.js','src/exporter.js'] + [f'_locales/{locale}/messages.json' for locale in ('en', 'pt_BR')] + [f'icons/{size}.png' for size in (16,32,48,128)]
if DIST.exists(): shutil.rmtree(DIST)
DIST.mkdir()
for target in ('chrome','firefox'):
    folder=DIST/target; folder.mkdir()
    for file in files:
        destination=folder/file; destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/file,destination)
    manifest=dict(base)
    if target=='firefox':
        # The native mode requires Chrome's privileged CDP debugger. Firefox
        # keeps assisted manual capture but neither asks for debugger nor
        # bundles the Chrome-only transport.
        manifest['permissions']=[p for p in manifest['permissions'] if p != 'debugger']
        (folder/'background/native_wheel.js').unlink()
        manifest['browser_specific_settings']={'gecko':{
            # Before AMO publication, replace with an ID you intend to keep forever.
            'id':'threadtomd@extensions.local',
            'strict_min_version':'128.0',
            # We do not collect/send data outside the browser or extension.
            'data_collection_permissions':{'required':['none']}
        }}
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    path=DIST/f"threadtomd-{target}-{base['version']}.zip"
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as arc:
        for source in sorted(folder.rglob('*')):
            if source.is_file(): arc.write(source,source.relative_to(folder))
    print(f'{target}: {path}')
