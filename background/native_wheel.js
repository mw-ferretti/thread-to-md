/* ThreadToMD Chrome-only native-wheel transport (experimental).
 * The trusted input mechanism is identical to the validated In-Tab Lab:
 * chrome.debugger.sendCommand({tabId}, 'Input.dispatchMouseEvent', ...).
 *
 * The only command issued to CDP is a bounded mouseWheel event. The worker
 * never reads page text/cookies/network data, nor attaches to another tab.
 * The session is attached only after an explicit native-mode start from an
 * injected extension content script, and detached when the port disconnects.
 */
(() => {
  'use strict';

  const CHANNEL = 'threadtomd-native-wheel-v1';
  const IDLE_MS = 10000;
  let active = null;

  const supported = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' &&
        (u.hostname === 'chatgpt.com' || u.hostname === 'chat.openai.com');
    } catch { return false; }
  };

  const msg = (err) => String(err?.message || err || 'Native wheel error').slice(0, 220);
  const reply = (session, data) => {
    if (session.closed) return;
    try { session.port.postMessage(data); } catch { void close(session, 'Port closed'); }
  };
  const clearIdle = (session) => {
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
  };
  const armIdle = (session) => {
    clearIdle(session);
    session.timer = setTimeout(() => void close(session, 'Native wheel session idle'), IDLE_MS);
  };

  async function close(session, reason = 'Session stopped') {
    if (session.closed) return;
    session.closed = true;
    clearIdle(session);
    if (active === session) active = null;
    // Do not wait for detach before disconnecting: a permanently suspended
    // page must not retain an attached debugger after leaving the tab.
    try { session.port.postMessage({ type: 'stopped', reason }); } catch { /* port gone */ }
    try { session.port.disconnect(); } catch { /* already closed */ }
    if (session.attached) {
      try { await chrome.debugger.detach({ tabId: session.tabId }); }
      catch { /* navigation or external debugger already detached */ }
    }
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== CHANNEL) return;
    const tabId = port.sender?.tab?.id;
    const original = port.sender?.url || port.sender?.tab?.url || '';
    const sourcePath = supported(original) ? new URL(original).origin + new URL(original).pathname : null;
    // The page itself cannot create extension ports. The sender is an injected
    // extension content script, and it must belong to an allowed HTTPS tab.
    if (port.sender?.id !== chrome.runtime.id ||
        !Number.isInteger(tabId) || tabId < 0 ||
        !sourcePath) {
      try { port.postMessage({ type: 'error', message: 'Unauthorized tab' }); }
      catch { /* ignored */ }
      try { port.disconnect(); } catch { /* ignored */ }
      return;
    }
    if (active && !active.closed) {
      try { port.postMessage({ type: 'error', message: 'Another native capture is active' }); }
      catch { /* ignored */ }
      try { port.disconnect(); } catch { /* ignored */ }
      return;
    }

    const session = {
      tabId, port, sourcePath, closed: false, attached: false,
      timer: null, busy: false
    };
    active = session;
    port.onDisconnect.addListener(() => void close(session, 'Capture disconnected'));
    port.onMessage.addListener((message) => {
      if (session.closed) return;
      armIdle(session);
      if (message?.type === 'close') { void close(session, 'Capture finished'); return; }
      if (message?.type !== 'wheel' || !session.attached || session.busy) {
        reply(session, { type: 'error', message: 'Invalid wheel command or session state' });
        return;
      }
      const { id, x, y, pixels, direction } = message;
      if (!Number.isSafeInteger(id) || id < 0 || id > 1000000 ||
          !Number.isFinite(x) || !Number.isFinite(y) ||
          x < 0 || y < 0 || x > 10000 || y > 10000 ||
          !Number.isInteger(pixels) || pixels < 20 || pixels > 600 ||
          (direction !== 1 && direction !== -1)) {
        reply(session, { type: 'error', message: 'Invalid wheel parameters' });
        return;
      }
      session.busy = true;
      // Exactly the command proven in the native-wheel browser experiment.
      chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseWheel', x, y, deltaX: 0,
        deltaY: pixels * direction
      }).then(() => {
        reply(session, { type: 'wheel-ok', id });
      }).catch((error) => {
        reply(session, { type: 'error', message: msg(error) });
        void close(session, 'Input dispatch failed');
      }).finally(() => { session.busy = false; });
    });

    // The debugger is attached only to the tab which initiated the capture.
    // This is not a persistent browser debugger or a background crawler.
    (async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (session.closed || !supported(tab.url || '') ||
            new URL(tab.url).origin + new URL(tab.url).pathname !== session.sourcePath)
          throw new Error('ChatGPT conversation changed');
        await chrome.debugger.attach({ tabId }, '1.3');
        session.attached = true;
        if (session.closed) {
          try { await chrome.debugger.detach({ tabId }); } catch { /* ignored */ }
          return;
        }
        armIdle(session);
        reply(session, { type: 'ready' });
      } catch (error) {
        reply(session, { type: 'error', message: msg(error) });
        await close(session, 'Debugger attach failed');
      }
    })();
  });

  chrome.debugger.onDetach.addListener((source, reason) => {
    if (active && source.tabId === active.tabId) {
      active.attached = false;
      void close(active, 'Chrome detached debugger: ' + String(reason));
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (active?.tabId === tabId) void close(active, 'Tab closed');
  });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (active?.tabId === tabId && change.url &&
        (!supported(change.url) ||
         new URL(change.url).origin + new URL(change.url).pathname !== active.sourcePath)) {
      void close(active, 'Tab navigated away from this conversation');
    }
  });
})();
