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
  const methods = {
    assisted: {checked: false, addEventListener(type, callback) { this[type] = callback; }},
    native: {checked: false, addEventListener(type, callback) { this[type] = callback; }}
  };
  const start = { disabled: true, textContent: '', addEventListener(type, callback) {
    assert.equal(type, 'click');
    startHandler = callback;
  }};
  const status = { textContent: '', className: '' };
  const nativeWarning = { hidden: true };
  const nativeChoice = { hidden: false };
  const capturePicker = { hidden: false };
  const translated = [{ textContent: '', getAttribute: () => 'popupExport' }];
  const document = {
    documentElement: { lang: 'en' },
    getElementById: id => ({ start, status, 'native-warning': nativeWarning, 'native-choice': nativeChoice })[id],
    querySelectorAll: () => translated,
    querySelector: selector => {
      if (selector === '.capture-picker') return capturePicker;
      if (selector.endsWith('[value="markdown"]')) return modes.markdown;
      if (selector.endsWith('[value="archive"]')) return modes.archive;
      if (selector.endsWith('[value="assisted"]')) return methods.assisted;
      if (selector.endsWith('[value="native"]')) return methods.native;
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
    start, status, nativeWarning, nativeChoice, capturePicker, calls, permissionCalls, backgroundMessages, uiPorts, document, translated, modes, methods, storage,
    get closed() { return closed; },
    get chosenMode() { return modes.archive.checked ? 'archive' : 'markdown'; },
    get chosenMethod() { return methods.native.checked ? 'native' : 'assisted'; },
    chooseMethod(method) {
      assert.ok(['assisted','native'].includes(method), 'Classic method was removed from popup');
      methods.assisted.checked = method === 'assisted';
      methods.native.checked = method === 'native';
      methods[method].click?.();
    },
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
  assert.equal(h.chosenMethod, 'native', 'Chrome should default to native wheel');
  assert.equal(h.nativeWarning.hidden, false, 'Sensitive permission warning must be visible');
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
  assert.deepEqual(Array.from(h.calls[0].args), ['archive', 'native']);
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
  assert.deepEqual(Array.from(h.calls[0].args), ['archive', 'native']);
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
  assert.deepEqual(Array.from(second.calls[0].args), ['archive', 'assisted']);
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
  assert.deepEqual(Array.from(reopened.calls[0].args), ['markdown', 'assisted']);
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
  assert.equal(h.translated[0].textContent, 'Exportar conversa');
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
  assert.equal(h.translated[0].textContent, 'Export conversation');
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


test('Chrome: popup offers only native automatic and manual, and persists manual', async () => {
  const storage = new Map();
  const first = setupPopup({ storage });
  await flush();
  assert.equal(first.chosenMethod, 'native');
  first.chooseMethod('assisted');
  assert.equal(storage.get('threadtomd.captureMethod'), 'assisted');
  assert.equal(first.start.textContent, 'Start assisted capture');
  const click = first.click();
  await flush();
  assert.deepEqual(Array.from(first.calls[0].args), ['markdown', 'assisted']);
  first.succeed(); await click;
  const next = setupPopup({ storage });
  await flush();
  assert.equal(next.chosenMethod, 'assisted');
  assert.equal(next.capturePicker.hidden, false);
  assert.equal(next.methods.automatic, undefined);
});

test('Assisted ZIP in Firefox retains optional permission flow and method selection', async () => {
  const storage = new Map();
  const first = setupPopup({ storage, firefox: true, deferredPermission: true });
  await flush();
  first.chooseMethod('assisted');
  first.choose('archive');
  assert.equal(first.closed, 1);
  const reopened = setupPopup({ storage, firefox: true, hasAccess: true });
  await flush();
  assert.equal(reopened.chosenMethod, 'assisted');
  assert.equal(reopened.chosenMode, 'archive');
  const click = reopened.click();
  await flush();
  assert.deepEqual(Array.from(reopened.calls[0].args), ['archive', 'assisted']);
  reopened.succeed();
  await click;
});

test('Chrome native capture is explicit and localized, and persists method preference', async () => {
  const storage = new Map();
  const h = setupPopup({ storage });
  await flush();
  h.chooseMethod('native');
  assert.equal(h.nativeWarning.hidden, false);
  assert.equal(h.nativeChoice.hidden, false);
  assert.equal(storage.get('threadtomd.captureMethod'), 'native');
  const pending = h.click();
  await flush();
  assert.deepEqual(Array.from(h.calls[0].args), ['markdown', 'native']);
  h.succeed(); await pending;
  const again = setupPopup({ storage });
  await flush();
  assert.equal(again.chosenMethod, 'native');
});

test('Firefox never presents native capture even if preference is native', async () => {
  const storage = new Map([['threadtomd.captureMethod', 'native']]);
  const h = setupPopup({ storage, firefox: true });
  await flush();
  assert.equal(h.nativeChoice.hidden, true);
  assert.equal(h.nativeWarning.hidden, true);
  assert.equal(h.chosenMethod, 'assisted');
  assert.equal(h.capturePicker.hidden, true);
});


test('Chrome: historical automatic preference migrates to native wheel without selecting legacy', async () => {
  const storage = new Map([['threadtomd.captureMethod', 'automatic']]);
  const h = setupPopup({ storage });
  await flush();
  assert.equal(h.chosenMethod, 'native');
  assert.equal(h.nativeWarning.hidden, false);
  const click = h.click(); await flush();
  assert.deepEqual(Array.from(h.calls[0].args), ['markdown', 'native']);
  h.succeed(); await click;
});

test('Chrome: old explicit legacy preference migrates to native', async () => {
  for (const old of ['automatic','legacy','native']) {
    const storage = new Map([['threadtomd.captureMethod', old]]);
    const h = setupPopup({ storage });
    await flush();
    assert.equal(h.chosenMethod, 'native');
    assert.equal(h.nativeWarning.hidden, false);
    const click = h.click(); await flush();
    assert.deepEqual(Array.from(h.calls[0].args), ['markdown', 'native']);
    h.succeed(); await click;
  }
});

test('Firefox: manual is the only mode, including stale native/legacy preferences', async () => {
  for (const stored of [null, 'automatic', 'native', 'legacy', 'assisted']) {
    const storage = new Map(stored ? [['threadtomd.captureMethod', stored]] : []);
    const h = setupPopup({ firefox: true, storage });
    await flush();
    assert.equal(h.chosenMethod, 'assisted');
    assert.equal(h.nativeChoice.hidden, true);
    assert.equal(h.capturePicker.hidden, true);
    assert.equal(h.nativeWarning.hidden, true);
    assert.equal(h.start.textContent, 'Start assisted capture');
    const click = h.click(); await flush();
    assert.deepEqual(Array.from(h.calls[0].args), ['markdown', 'assisted']);
    h.succeed(); await click;
  }
});

// The old UI choice must not be exposed in a new build.
test('Classic automatic option is absent from popup HTML', () => {
  const html = readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('value="automatic"'));
  assert.ok(html.includes('value="native"'));
  assert.ok(html.includes('value="assisted"'));
});
