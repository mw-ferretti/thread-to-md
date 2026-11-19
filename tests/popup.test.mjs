import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const popupCode = readFileSync(new URL('../popup/popup.js', import.meta.url), 'utf8');
const localeCode = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setupPopup({
  url = 'https://chatgpt.com/c/example', uiLanguage = 'en-US', firefox = false,
  hasAccess = false, grant = true, storage = new Map(), deferredPermission = false,
  deferredContains = false
} = {}) {
  let closed = 0;
  let resolveInjection;
  let rejectInjection;
  let resolvePrompt;
  let resolveContains;
  let startHandler;
  const calls = [];
  const permissionCalls = [];
  const backgroundMessages = [];
  const uiPorts = [];
  const modes = {
    markdown: { checked: true, addEventListener(type, callback) { this[type] = callback; } },
    archive: { checked: false, addEventListener(type, callback) { this[type] = callback; } }
  };
  const start = { disabled: true, addEventListener(type, callback) {
    assert.equal(type, 'click');
    startHandler = callback;
  }};
  const status = { textContent: '', className: '' };
  const translated = [{ textContent: '', getAttribute: () => 'popupExport' }];
  const document = {
    documentElement: { lang: 'en' },
    getElementById: id => ({ start, status })[id],
    querySelectorAll: () => translated,
    querySelector: selector => {
      if (selector.endsWith('[value="markdown"]')) return modes.markdown;
      if (selector.endsWith('[value="archive"]')) return modes.archive;
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };
  const chrome = {
    i18n: { getUILanguage: () => uiLanguage },
    runtime: {
      ...(firefox ? { getBrowserInfo: () => Promise.resolve({ name: 'Firefox' }) } : {}),
      connect: (info) => { uiPorts.push(info); return {}; },
      sendMessage: (info) => { backgroundMessages.push(info); return Promise.resolve({ ok: true }); }
    },
    permissions: {
      contains: () => deferredContains
        ? new Promise(resolve => { resolveContains = resolve; })
        : Promise.resolve(hasAccess),
      request(data) {
        permissionCalls.push(data);
        if (deferredPermission) return new Promise(resolve => { resolvePrompt = resolve; });
        hasAccess = grant;
        return Promise.resolve(grant);
      }
    },
    tabs: { query: async () => [{ id: 41, windowId: 7, url }] },
    scripting: {
      executeScript(args) {
        calls.push(args);
        if (args.func) return Promise.resolve([]);
        return new Promise((resolve, reject) => {
          resolveInjection = resolve;
          rejectInjection = reject;
        });
      }
    }
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  const context = createContext({
    URL, chrome, document, localStorage,
    navigator: { language: uiLanguage },
    window: { close: () => { closed++; } }
  });
  runInContext(localeCode, context, { filename: 'src/i18n.js' });
  runInContext(popupCode, context, { filename: 'popup/popup.js' });
  return {
    start, status, calls, permissionCalls, backgroundMessages, uiPorts, document, translated, modes, storage,
    get closed() { return closed; },
    get chosenMode() { return modes.archive.checked ? 'archive' : 'markdown'; },
    choose(mode) {
      modes.markdown.checked = mode === 'markdown';
      modes.archive.checked = mode === 'archive';
      modes[mode].click?.();
    },
    click() { return start.disabled ? Promise.resolve() : startHandler(); },
    succeed() { resolveInjection([]); },
    fail(error = 'Injection failed') { rejectInjection(new Error(error)); },
    decide(granted) { hasAccess = granted; resolvePrompt?.(granted); },
    finishContains(granted) { resolveContains?.(granted); }
  };
}

test('Chrome: choosing ZIP requests permission immediately; Start injects without another prompt', async () => {
  const h = setupPopup();
  await flush();
  assert.equal(h.start.disabled, false);
  assert.equal(h.permissionCalls.length, 0);
  h.choose('archive');
  assert.equal(h.permissionCalls.length, 1, 'permission request must run during option click');
  assert.deepEqual(h.backgroundMessages.map(m => m.type), ['threadtomd-register-archive-consent']);
  assert.equal(h.backgroundMessages[0].windowId, 7);
  assert.equal(h.calls.length, 0, 'selecting ZIP must not start an export');
  assert.ok(h.permissionCalls[0].origins.includes('https://images.openai.com/*'));
  await flush();
  assert.match(h.status.textContent, /ZIP access ready/);
  const click = h.click();
  await flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].target.tabId, 41);
  assert.deepEqual(Array.from(h.calls[0].args), ['archive']);
  assert.deepEqual(Array.from(h.calls[1].files), ['/src/i18n.js', '/src/archive.js', '/src/exporter.js']);
  h.succeed();
  await click;
  assert.equal(h.closed, 1);
  assert.equal(h.permissionCalls.length, 1, 'Start must not request permission again');
});

test('Chrome: Start is disabled while ZIP authorization is pending', async () => {
  const h = setupPopup({ deferredPermission: true });
  await flush();
  h.choose('archive');
  assert.equal(h.start.disabled, true);
  await h.click();
  assert.equal(h.calls.length, 0);
  h.decide(true);
  await flush();
  assert.equal(h.start.disabled, false);
  assert.match(h.status.textContent, /ZIP access ready/);
});

test('Chrome: declined permission still allows ZIP containing Markdown and available links', async () => {
  const h = setupPopup({ grant: false });
  await flush();
  h.choose('archive');
  await flush();
  assert.match(h.status.textContent, /Media access not granted/);
  const click = h.click();
  await flush();
  assert.deepEqual(Array.from(h.calls[0].args), ['archive']);
  h.succeed();
  await click;
  assert.equal(h.closed, 1);
  assert.equal(h.permissionCalls.length, 1);
});

test('Firefox: selecting ZIP starts prompt, closes overlay, and restores mode on reopening', async () => {
  const storage = new Map();
  const first = setupPopup({ firefox: true, storage, deferredPermission: true });
  await flush();
  first.choose('archive');
  assert.equal(first.permissionCalls.length, 1);
  assert.equal(first.closed, 1, 'Firefox toolbar popup must not obscure native permission prompt');
  assert.equal(first.backgroundMessages.length, 1, 'background gets one-shot popup restore intent');
  assert.equal(first.calls.length, 0, 'granting permission must not implicitly export');
  assert.equal(storage.get('threadtomd.exportFormat'), 'archive');
  // The popup is gone; Firefox may never resolve its abandoned JS promise.
  const second = setupPopup({ firefox: true, storage, hasAccess: true });
  await flush();
  assert.equal(second.chosenMode, 'archive');
  assert.match(second.status.textContent, /ZIP access ready/);
  const click = second.click();
  await flush();
  assert.deepEqual(Array.from(second.calls[0].args), ['archive']);
  second.succeed();
  await click;
  assert.equal(second.closed, 1);
  assert.equal(second.permissionCalls.length, 0, 'already granted: no second prompt');
});

test('Firefox: declining ZIP access preserves format, and Markdown remains available', async () => {
  const storage = new Map();
  const first = setupPopup({ firefox: true, storage, deferredPermission: true });
  await flush();
  first.choose('archive');
  assert.equal(first.closed, 1);
  const reopened = setupPopup({ firefox: true, storage, hasAccess: false });
  await flush();
  assert.equal(reopened.chosenMode, 'archive');
  reopened.choose('markdown');
  assert.equal(reopened.permissionCalls.length, 0);
  const click = reopened.click();
  await flush();
  assert.deepEqual(Array.from(reopened.calls[0].args), ['markdown']);
  reopened.succeed();
  await click;
});

test('Existing ZIP permission does not display a new prompt when selected again', async () => {
  const h = setupPopup({ hasAccess: true });
  await flush();
  h.choose('archive');
  assert.equal(h.permissionCalls.length, 0);
  assert.match(h.status.textContent, /ZIP access ready/);
});

test('Markdown mode never prompts for extra host permissions', async () => {
  const h = setupPopup();
  await flush();
  h.choose('markdown');
  const click = h.click();
  await flush();
  h.succeed();
  await click;
  assert.equal(h.permissionCalls.length, 0);
  assert.equal(h.closed, 1);
});

test('Popup keeps localized error and re-enables button after injection failure', async () => {
  const h = setupPopup({ uiLanguage: 'pt-BR' });
  await flush();
  assert.equal(h.document.documentElement.lang, 'pt-BR');
  assert.equal(h.translated[0].textContent, 'Exportar conversa atual');
  assert.match(h.status.textContent, /Pronto/);
  const click = h.click();
  await flush();
  h.fail('not permitted');
  await click;
  assert.equal(h.closed, 0);
  assert.equal(h.start.disabled, false);
  assert.match(h.status.textContent, /N.o foi poss.vel iniciar:.*not permitted/);
  assert.equal(h.status.className, 'status error');
});

test('Unsupported UI locale defaults to English, even pt-PT', async () => {
  const h = setupPopup({ uiLanguage: 'pt-PT' });
  await flush();
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.translated[0].textContent, 'Export current conversation');
  assert.equal(h.status.textContent, 'Ready. No conversation content is sent to ThreadToMD.');
});

test('Popup cannot inject into unsupported tabs', async () => {
  const h = setupPopup({ url: 'https://example.com', uiLanguage: 'es' });
  await flush();
  assert.equal(h.start.disabled, true);
  await h.click();
  assert.equal(h.calls.length, 0);
  assert.equal(h.closed, 0);
  assert.match(h.status.textContent, /^Open a conversation/);
});

test('Stale initial permission check does not override a grant made while popup initializes', async () => {
  const h = setupPopup({ deferredContains: true });
  await flush();
  h.choose('archive');
  await flush();
  h.finishContains(false);
  await flush();
  assert.match(h.status.textContent, /ZIP access ready/);
});

test('Chrome/Firefox: remembered Markdown selection is respected on reopening', async () => {
  const storage = new Map([['threadtomd.exportFormat', 'archive']]);
  const h = setupPopup({ storage, hasAccess: true });
  await flush();
  assert.equal(h.chosenMode, 'archive');
  h.choose('markdown');
  assert.equal(storage.get('threadtomd.exportFormat'), 'markdown');
  const again = setupPopup({ storage, hasAccess: true });
  await flush();
  assert.equal(again.chosenMode, 'markdown');
});
