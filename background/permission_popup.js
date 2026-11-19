/* ThreadToMD: restore a dismissed toolbar popup after optional ZIP access is granted.
 * The native consent prompt can close the toolbar panel (notably in Firefox).
 * Only a recent user-initiated consent flow may trigger popup restoration.
 * State is ephemeral and contains only tab/window IDs and a timestamp.
 */
(() => {
  'use strict';

  const PENDING_KEY = 'threadtomd.pendingArchiveConsent';
  const MAX_PENDING_MS = 3 * 60 * 1000;
  const POST_PROMPT_SETTLE_MS = 400;
  const popups = new Set();
  let checking = false;
  let runAgain = false;

  const popupURL = chrome.runtime.getURL('popup/popup.html');
  const validSender = (sender) => sender?.id === chrome.runtime.id && sender?.url === popupURL;
  const origins = chrome.runtime.getManifest().optional_host_permissions || [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clearPending = () => chrome.storage.session.remove(PENDING_KEY);

  // A live port means a toolbar popup is still visible. In Chrome it normally
  // remains open throughout the native consent dialog, so do not reopen it.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'threadtomd-popup-ui' || !validSender(port.sender)) return;
    popups.add(port);
    port.onDisconnect.addListener(() => popups.delete(port));
  });

  async function restoreIfGranted() {
    const stored = await chrome.storage.session.get(PENDING_KEY);
    const pending = stored[PENDING_KEY];
    if (!pending) return;
    if (!Number.isInteger(pending.tabId) || !Number.isInteger(pending.windowId) ||
        !Number.isFinite(pending.at) || Date.now() - pending.at > MAX_PENDING_MS ||
        Date.now() < pending.at) {
      await clearPending();
      return;
    }
    if (!(await chrome.permissions.contains({ origins }))) return;

    // The permission grant event may precede the native dialog's dismissal.
    await sleep(POST_PROMPT_SETTLE_MS);
    if (popups.size) { await clearPending(); return; }

    // Never move focus, reopen on another window, or revive a popup for a tab
    // that was closed or replaced while permission UI was visible.
    let tab;
    try { tab = await chrome.tabs.get(pending.tabId); }
    catch { await clearPending(); return; }
    if (!tab?.active || tab.windowId !== pending.windowId) {
      await clearPending();
      return;
    }

    // Already-granted access is durable. Consume this one-shot intent even if
    // popup opening fails (e.g. user switched windows, or Firefox <149).
    await clearPending();
    if (typeof chrome.action?.openPopup !== 'function') return;
    for (const waitMs of [0, 350, 800]) {
      if (waitMs) await sleep(waitMs);
      if (popups.size) return; // User may have reopened it manually.
      try {
        await chrome.action.openPopup({ windowId: pending.windowId });
        return;
      } catch {
        // Dialog/window focus can settle slightly after onAdded; retry briefly.
      }
    }
  }

  function requestCheck() {
    if (checking) { runAgain = true; return; }
    checking = true;
    void (async () => {
      try {
        do {
          runAgain = false;
          await restoreIfGranted();
        } while (runAgain);
      } catch {
        // Failed UI restoration must never interfere with ZIP permission grants.
      } finally {
        checking = false;
      }
    })();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'threadtomd-register-archive-consent') return;
    if (!validSender(sender) || !Number.isInteger(message.tabId) ||
        !Number.isInteger(message.windowId) || message.tabId < 0 || message.windowId < 0) {
      sendResponse({ ok: false });
      return;
    }
    const intent = { tabId: message.tabId, windowId: message.windowId, at: Date.now() };
    // We do not await this call in the popup: permissions.request MUST execute
    // synchronously in the original user's click handler.
    void chrome.storage.session.set({ [PENDING_KEY]: intent }).then(() => {
      sendResponse({ ok: true });
      // Covers a rare race where the permission grant precedes storage.set().
      requestCheck();
    }).catch(() => sendResponse({ ok: false }));
    return true;
  });

  chrome.permissions.onAdded.addListener((granted) => {
    if (!Array.isArray(granted.origins) || granted.origins.length === 0) return;
    requestCheck();
  });
})();
