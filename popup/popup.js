/* ThreadToMD popup — optional archive access is requested when ZIP is chosen. */
(() => {
  'use strict';

  const i18n = globalThis.ThreadToMDI18n;
  const t = (key, vars) => i18n.t(key, vars);
  document.documentElement.lang = i18n.locale === 'pt_BR' ? 'pt-BR' : 'en';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.getAttribute('data-i18n'));
  }

  const ARCHIVE_ORIGINS = [
    'https://images.openai.com/*',
    'https://*.oaiusercontent.com/*',
    'https://cdn.oaistatic.com/*',
    'https://d2ol7oe51mr4n9.cloudfront.net/*',
    'https://chatgpt.com/*',
    'https://chat.openai.com/*'
  ];
  const FORMAT_KEY = 'threadtomd.exportFormat';
  const start = document.getElementById('start');
  const status = document.getElementById('status');
  const markdown = document.querySelector('input[name="exportFormat"][value="markdown"]');
  const archive = document.querySelector('input[name="exportFormat"][value="archive"]');
  // Firefox normally dismisses the toolbar panel to show its native prompt.
  const firefoxPopup = typeof chrome.runtime?.getBrowserInfo === 'function';
  // The background uses the port to detect whether this popup is still open.
  // Chrome can retain it during permission consent, while Firefox usually can't.
  try { chrome.runtime.connect({ name: 'threadtomd-popup-ui' }); }
  catch { /* Consent and export remain usable without presence tracking. */ }

  let currentTab = null;
  let tabReady = false;
  let exporting = false;
  let permissionPending = false;
  let archiveGranted = false;
  let archivePermissionDeclined = false;

  const supported = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' &&
        (parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com');
    } catch { return false; }
  };
  const currentMode = () => archive.checked ? 'archive' : 'markdown';
  const message = (value, kind = '') => {
    status.textContent = value;
    status.className = `status ${kind}`.trim();
  };
  const syncButton = () => {
    start.disabled = !tabReady || exporting || permissionPending;
  };
  const showReady = () => {
    if (!tabReady || exporting || permissionPending) return;
    if (currentMode() === 'archive') {
      if (archiveGranted) message(t('popupPermissionGranted'), 'ok');
      else if (archivePermissionDeclined) message(t('popupPermissionDeclined'), 'error');
      else message(t('popupPermissionRequired'));
    } else {
      message(t('popupReady'), 'ok');
    }
  };

  // A format preference contains no conversation content and survives Firefox's
  // required popup close while the native permission prompt is displayed.
  try {
    if (globalThis.localStorage?.getItem(FORMAT_KEY) === 'archive') {
      archive.checked = true;
      markdown.checked = false;
    }
  } catch { /* Storage may be unavailable; the default is Markdown. */ }
  const rememberFormat = (format) => {
    try { globalThis.localStorage?.setItem(FORMAT_KEY, format); }
    catch { /* Keep working without saving the preference. */ }
  };

  async function init() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0] || null;
      if (!currentTab || typeof currentTab.id !== 'number' || !supported(currentTab.url)) {
        message(t('popupUnsupported'));
        return;
      }
      tabReady = true;
      syncButton();
      showReady();

      // Read already-approved access when the popup opens (including after
      // Firefox closed to expose the native permission prompt).
      try {
        const alreadyGranted = await chrome.permissions.contains({ origins: ARCHIVE_ORIGINS });
        // Do not let an older contains() result overwrite a new consent decision.
        if (!permissionPending && !archiveGranted) archiveGranted = Boolean(alreadyGranted);
      } catch {
        archiveGranted = false;
      }
      showReady();
    } catch (error) {
      message(t('popupAccessError', { error: String(error) }), 'error');
    }
  }

  function selectArchive() {
    rememberFormat('archive');
    if (archiveGranted || permissionPending) {
      showReady();
      return;
    }
    archivePermissionDeclined = false;
    permissionPending = true;
    syncButton();
    message(t('popupPermissionRequesting'));

    // Record this user-initiated consent, so a background event can reopen
    // the UI if the native browser dialog dismisses the popup. Do NOT await:
    // permission requests require the original click's transient user gesture.
    if (currentTab && Number.isInteger(currentTab.id) && Number.isInteger(currentTab.windowId)) {
      try {
        void Promise.resolve(chrome.runtime.sendMessage({
          type: 'threadtomd-register-archive-consent',
          tabId: currentTab.id, windowId: currentTab.windowId
        })).catch(() => {});
      } catch { /* Permission request still works without restoration. */ }
    }

    // IMPORTANT: request() must be called synchronously in this click handler.
    // Awaiting permissions.contains() beforehand loses the user gesture.
    let request;
    try {
      request = chrome.permissions.request({ origins: ARCHIVE_ORIGINS });
    } catch (error) {
      permissionPending = false;
      archivePermissionDeclined = true;
      syncButton();
      showReady();
      return;
    }

    if (firefoxPopup) {
      // Firefox's toolbar panel can obscure its own native permission doorhanger.
      // Closing the panel AFTER issuing request() makes the browser prompt usable.
      // The background will reopen the popup on grant (Chrome 127+/Firefox 149+).
      // The saved format also survives manual reopening if restoration is denied.
      window.close();
      return;
    }

    Promise.resolve(request).then((granted) => {
      archiveGranted = Boolean(granted);
      archivePermissionDeclined = !archiveGranted;
    }).catch(() => {
      archivePermissionDeclined = true;
    }).finally(() => {
      permissionPending = false;
      syncButton();
      showReady();
    });
  }

  // The label forwards a real pointer click to the radio input. Keyboard
  // activation also generates a click. Both count as a browser user gesture.
  archive.addEventListener('click', selectArchive);
  markdown.addEventListener('click', () => {
    rememberFormat('markdown');
    showReady();
  });

  start.addEventListener('click', async () => {
    if (!tabReady || exporting || permissionPending || !currentTab) return;
    exporting = true;
    syncButton();
    message(t('popupStarting'));
    try {
      const mode = currentMode();
      // Starting a scan must not trigger permissions or await permission UI.
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: (format) => { globalThis.__threadtomdExportMode = format; },
        args: [mode]
      });
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['/src/i18n.js', '/src/archive.js', '/src/exporter.js']
      });
      window.close();
    } catch (error) {
      exporting = false;
      syncButton();
      message(t('popupStartError', { error: String(error) }), 'error');
    }
  });

  void init();
})();
