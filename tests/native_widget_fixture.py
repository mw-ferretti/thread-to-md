"""Actual user-supplied code-block HTML with representative computed CSS.

The original markup is a byte-identical fixture; the private ChatGPT CSS
was not supplied, so the wrapper styles are a controlled approximation.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_WIDGET = (ROOT / 'tests/fixtures/real-chatgpt-code-block.html').read_text()

STYLE = '''
  <style>
    html,body {padding:0;margin:0;background:#171717;color:#eee;font-family:Arial,sans-serif}
    #scrollbox {position:relative;width:800px;height:520px;overflow-y:auto;overflow-x:hidden;border:1px solid #777}
    .turn {padding:12px 20px;border-bottom:1px solid #444;min-height:90px;box-sizing:border-box}
    .turn p {line-height:1.6}
    [data-client-defined-widget=code_block] {margin:12px 0 22px}
    [data-code-block=true] {overflow:clip;background:#454545;border:1px solid #777;border-radius:20px;position:relative}
    .ActionBar-KWWAct {height:52px;display:flex;align-items:center;padding:0 12px;box-sizing:border-box}
    .InlineCodePane-EYx4bd {max-height:430px;overflow-x:hidden; /* overflow-y computes to auto */ }
    .chatgpt-code-scrollport {display:flex;width:100%;overflow-x:auto;overscroll-behavior-x:contain}
    .ViewerContent-Cg8AgN {white-space:pre;font:14px/22px monospace;min-width:max-content;margin:0;padding:5px 20px 15px}
  </style>
'''

def fixture():
    turns=[]
    for i in range(44):
        u=f'12345678-0000-4000-8000-{i*10+1:012d}'
        a=f'12345678-0000-4000-8000-{i*10+2:012d}'
        turns.append(f'''<div class="turn" data-turn-key="{u}">
          <div data-content-search-unit-key="n:{i}:user" data-chatgpt-search-message-ids="{u}">
            <div data-user-message-bubble="true"><p>Mensagem numero {i}</p></div></div>
        </div>''')
        widget=RAW_WIDGET if i==18 else ''
        turns.append(f'''<div class="turn" data-turn-key="{a}">
          <div data-content-search-unit-key="n:{i}:assistant" data-chatgpt-search-message-ids="{a}">
            <div data-markdown-text-style="assistant-message"><p>Resposta numero <strong>{i}</strong></p>{widget}</div></div>
        </div>''')
    return f'<!doctype html><html><head><meta charset="utf-8"><title>Real code widget regression</title>{STYLE}</head><body><main><div id="scrollbox" data-app-action-timeline-scroll role="region">{"".join(turns)}</div></main></body></html>'

