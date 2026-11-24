import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const code = readFileSync(new URL('../background/native_wheel.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
function setup() {
  const handlers = {};
  const calls = [];
  const chrome = {
    runtime: { id: 'ext-id', onConnect: { addListener: cb => handlers.connect = cb } },
    tabs: {
      get: async id => ({id, url:'https://chatgpt.com/c/test'}),
      onRemoved: { addListener: cb => handlers.tabRemoved = cb },
      onUpdated: { addListener: cb => handlers.tabUpdated = cb }
    },
    debugger: {
      attach: async (target, version) => { calls.push(['attach',target.tabId,version]); },
      detach: async target => { calls.push(['detach', target.tabId]); },
      sendCommand: async (target, method, args) => { calls.push(['wheel',target.tabId,method,args]); },
      onDetach: { addListener: cb => handlers.detached = cb }
    }
  };
  runInContext(code, createContext({ chrome, URL, setTimeout, clearTimeout }));
  function port({ url='https://chatgpt.com/c/test', id='ext-id', tabId=7 }={}) {
    const listeners = {}, received = [];
    const p = {
      name:'threadtomd-native-wheel-v1',
      sender: { id, url, tab: {id:tabId, url} },
      onMessage: { addListener(cb) { listeners.message = cb; } },
      onDisconnect: { addListener(cb) { listeners.disconnect = cb; } },
      postMessage(data) { received.push(data); },
      disconnect() { p.disconnected = true; listeners.disconnect?.(); },
      emit(data) { listeners.message?.(data); },
      received
    };
    handlers.connect(p);
    return p;
  }
  return { calls, port, handlers };
}

test('Native worker dispatches exactly the lab trusted-wheel command and detaches on close', async () => {
  const h = setup();
  const p = h.port();
  await flush();
  assert.deepEqual(h.calls[0], ['attach',7,'1.3']);
  assert.equal(p.received[0].type, 'ready');
  p.emit({type:'wheel', id:1, direction:-1, pixels:160, x:520, y:360});
  await flush();
  const wheel = h.calls.find(c=>c[0]==='wheel');
  assert.equal(wheel[1],7);
  assert.equal(wheel[2],'Input.dispatchMouseEvent');
  assert.equal(wheel[3].type,'mouseWheel');
  assert.equal(wheel[3].deltaY,-160);
  assert.equal(wheel[3].deltaX,0);
  assert.equal(p.received.at(-1).type,'wheel-ok');
  p.emit({type:'close'});
  await flush();
  assert.ok(h.calls.some(c=>c[0]==='detach' && c[1]===7));
});

test('Native worker denies non-ChatGPT and foreign extension senders', async () => {
  const h = setup();
  const bad = h.port({url:'https://example.com/c/test'});
  assert.equal(bad.received[0].type,'error');
  const foreign = h.port({id:'other-ext'});
  assert.equal(foreign.received[0].type,'error');
  await flush();
  assert.equal(h.calls.length,0);
});

test('Native worker rejects malformed wheels and does not attach twice', async () => {
  const h=setup(), p=h.port();
  await flush();
  const other=h.port({tabId:8});
  assert.equal(other.received[0].type,'error');
  assert.ok(other.disconnected);
  p.emit({type:'wheel',id:1,direction:-1,pixels:999999,x:12,y:12});
  await flush();
  assert.ok(p.received.some(c=>c.message==='Invalid wheel parameters'));
  assert.ok(!h.calls.some(c=>c[0]==='wheel'));
  p.emit({type:'close'});
  await flush();
});

test('Native worker detaches if tab navigates away', async () => {
  const h=setup(), p=h.port();
  await flush();
  h.handlers.tabUpdated(7,{url:'https://example.com/'},{});
  await flush();
  assert.ok(p.disconnected);
  assert.ok(h.calls.some(c=>c[0]==='detach' && c[1]===7));
});

test('Native debugger does not follow a different ChatGPT conversation', async () => {
  const h=setup(), p=h.port();
  await flush();
  h.handlers.tabUpdated(7,{url:'https://chatgpt.com/c/a-different-chat'},{});
  await flush();
  assert.ok(p.disconnected);
  assert.ok(h.calls.some(c=>c[0]==='detach' && c[1]===7));
});
