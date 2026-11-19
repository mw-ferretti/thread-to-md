import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../background/permission_popup.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function tick() { for (let i = 0; i < 8; i++) await flush(); }

function setupBackground({ granted = false, active = true, openFails = 0 } = {}) {
  const listeners = { onConnect: [], onMessage: [], onAdded: [] };
  const values = new Map();
  const attempted = [];
  const opens = [];
  const origins = ['https://images.openai.com/*','https://chatgpt.com/*'];
  const popupURL = 'moz-extension://extension/popup/popup.html';
  let permission = granted;
  let failures = openFails;
  const tab = { id: 41, windowId: 7, active };
  const event = kind => ({ addListener(handler) { listeners[kind].push(handler); } });
  const chrome = {
    runtime: {
      id: 'threadtomd', getURL: () => popupURL,
      getManifest: () => ({ optional_host_permissions: origins }),
      onMessage: event('onMessage'), onConnect: event('onConnect')
    },
    storage: { session: {
      async get(key) { return { [key]: values.get(key) }; },
      async set(data) { for (const [k,v] of Object.entries(data)) values.set(k,v); },
      async remove(key) { values.delete(key); }
    }},
    permissions: {
      contains: async () => permission,
      onAdded: event('onAdded')
    },
    tabs: { get: async (id) => id === tab.id ? tab : Promise.reject(new Error('Tab gone')) },
    action: {
      async openPopup(options) {
        attempted.push(options);
        if (failures > 0) { failures--; throw Error('Window is not yet ready'); }
        opens.push(options);
      }
    }
  };
  const context = createContext({ chrome, Date, Number, setTimeout: cb => { queueMicrotask(cb); } });
  runInContext(source, context, { filename: 'background/permission_popup.js' });
  const sender = { id: 'threadtomd', url: popupURL };
  return {
    listeners, values, attempted, opens, chrome, tab,
    async register({ badSender = false, tabId = 41, windowId = 7 } = {}) {
      const responses = [];
      listeners.onMessage[0]({ type: 'threadtomd-register-archive-consent', tabId, windowId },
        badSender ? { id: 'other', url: 'https://chatgpt.com' } : sender,
        x => responses.push(x));
      await tick();
      return responses;
    },
    async grant() {
      permission = true;
      for (const fn of listeners.onAdded) fn({ origins });
      await tick();
    },
    async unrelatedPermissionEvent() {
      for (const fn of listeners.onAdded) fn({ permissions: ['bookmarks'] });
      await tick();
    },
    connectPopup() {
      const disconnect = [];
      const port = {
        name:'threadtomd-popup-ui', sender,
        onDisconnect: { addListener(fn) { disconnect.push(fn); } }
      };
      for (const fn of listeners.onConnect) fn(port);
      return () => disconnect.forEach(fn => fn());
    },
    async removeConsent() {
      values.delete('threadtomd.pendingArchiveConsent');
    }
  };
}

test('Firefox-style popup closes: after ZIP grant, background reopens popup once', async () => {
  const h = setupBackground();
  assert.equal((await h.register())[0]?.ok, true);
  assert.equal(h.opens.length, 0, 'not authorized yet');
  await h.grant();
  assert.equal(h.opens.length, 1);
  assert.equal(h.opens[0].windowId, 7);
  assert.equal(h.values.size, 0, 'one-shot consent state cleared');
  await h.grant();
  assert.equal(h.opens.length, 1, 'no duplicate reopening');
});

test('Chrome-style popup stays open: authorization does not reopen an existing popup', async () => {
  const h = setupBackground();
  const disconnect = h.connectPopup();
  await h.register();
  await h.grant();
  assert.equal(h.opens.length, 0);
  assert.equal(h.values.size, 0);
  disconnect();
});

test('Permission denied: no popup restoration or unexpected exports', async () => {
  const h = setupBackground();
  await h.register();
  await h.unrelatedPermissionEvent();
  assert.equal(h.opens.length, 0);
  assert.equal(h.values.size, 1);
});

test('Manual reopening before grant consumes one-shot intent without a duplicate', async () => {
  const h = setupBackground();
  await h.register();
  h.connectPopup();
  await h.grant();
  assert.equal(h.opens.length, 0);
});

test('Background ignores forged permission-restore registration', async () => {
  const h = setupBackground();
  assert.equal((await h.register({ badSender: true }))[0]?.ok, false);
  await h.grant();
  assert.equal(h.opens.length, 0);
});

test('Background avoids auto-reopening if user switched tabs', async () => {
  const h = setupBackground({ active: false });
  await h.register();
  await h.grant();
  assert.equal(h.opens.length, 0);
  assert.equal(h.values.size, 0);
});

test('Background retries the popup API after native dialog focus settles', async () => {
  const h = setupBackground({ openFails: 1 });
  await h.register();
  await h.grant();
  assert.equal(h.attempted.length, 2);
  assert.equal(h.opens.length, 1);
});

test('Grant that arrives before session write is still handled', async () => {
  const h = setupBackground({ granted: true });
  await h.register();
  assert.equal(h.opens.length, 1);
});

test('Expired restore intent is dropped without reopening unrelated windows', async () => {
  const h = setupBackground();
  await h.register();
  const pending = h.values.get('threadtomd.pendingArchiveConsent');
  pending.at = Date.now() - 4 * 60 * 1000;
  await h.grant();
  assert.equal(h.opens.length, 0);
  assert.equal(h.values.size, 0);
});
