/* ThreadToMD asset relay, v0.2.4.
 * Runs in Chrome MV3 service worker / Firefox MV3 event page.
 * Only serves requests from an extension content script on ChatGPT, for
 * explicitly allowed HTTPS asset origins; no cookies on third-party hosts.
 * Each 48 KiB chunk requires an ACK before another chunk is read.
 */
(() => {
  'use strict';

  const MAX_BYTES = 24 * 1024 * 1024;
  const CHUNK_BYTES = 48 * 1024;
  const FETCH_TIMEOUT_MS = 30000;
  const allowedSource = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(u.hostname);
    } catch { return false; }
  };
  const allowedDestination = (raw) => {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.username || u.password) return false;
      const host = u.hostname.toLowerCase();
      return host === 'images.openai.com' ||
        host === 'files.oaiusercontent.com' ||
        host.endsWith('.oaiusercontent.com') ||
        host === 'cdn.oaistatic.com' ||
        host === 'd2ol7oe51mr4n9.cloudfront.net' ||
        host === 'chatgpt.com' || host === 'chat.openai.com';
    } catch { return false; }
  };
  function encode64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'threadtomd-asset') return;
    let started = false;
    let disconnected = false;
    let pendingAck = null;
    let controller = null;
    const sender = port.sender?.tab?.url || port.sender?.url || '';
    const post = (obj) => { if (!disconnected) port.postMessage(obj); };
    const fail = (reason) => post({ type: 'error', reason: String(reason || 'Download unavailable').slice(0, 180) });
    const onDisconnect = () => {
      disconnected = true;
      controller?.abort();
      pendingAck?.reject(new Error('Port disconnected'));
      pendingAck = null;
    };
    port.onDisconnect.addListener(onDisconnect);
    const waitForAck = () => new Promise((resolve, reject) => {
      pendingAck = { resolve, reject };
    });
    async function run(url) {
      if (!allowedSource(sender)) { fail('Unauthorized source tab'); return; }
      if (!allowedDestination(url)) { fail('Origin not supported for privileged download'); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let reader;
      try {
        const u = new URL(url);
        const firstParty = u.hostname === 'chatgpt.com' || u.hostname === 'chat.openai.com';
        const response = await fetch(url, {
          signal: controller.signal, credentials: firstParty ? 'include' : 'omit',
          redirect: 'error', cache: 'default'
        });
        if (!response.ok || response.type === 'opaque') throw new Error(`HTTP ${response.status || 'opaque'}`);
        // Deny cross-origin redirects that leave the narrow approved set.
        if (!allowedDestination(response.url)) throw new Error('Redirect to unsupported origin');
        const length = Number(response.headers.get('content-length') || 0);
        if (length > MAX_BYTES) throw new Error('File exceeds 24 MiB limit');
        const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (/^(text\/html|application\/xhtml\+xml|image\/svg\+xml)/.test(mime))
          throw new Error('Remote response was HTML/SVG, not a downloadable asset');
        post({ type: 'meta', mime, disposition: response.headers.get('content-disposition') || '', length });
        let received = 0;
        if (!response.body?.getReader) throw new Error('Streaming response not supported');
        reader = response.body.getReader();
        while (!disconnected) {
          const { value, done } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > MAX_BYTES) throw new Error('File exceeds 24 MiB limit');
          for (let offset = 0; offset < value.length; offset += CHUNK_BYTES) {
            post({ type: 'chunk', data: encode64(value.subarray(offset, offset + CHUNK_BYTES)) });
            await waitForAck();
          }
        }
        if (!disconnected) post({ type: 'done' });
      } catch (err) {
        if (!disconnected) fail(err?.name === 'AbortError' ? 'Download timed out' : err?.message || err);
      } finally {
        clearTimeout(timeout);
        try { await reader?.cancel(); } catch { /* ignore */ }
      }
    }
    port.onMessage.addListener((message) => {
      if (message?.type === 'ack') {
        const waiter = pendingAck;
        pendingAck = null;
        waiter?.resolve();
      } else if (message?.type === 'start' && !started) {
        started = true;
        void run(message.url);
      }
    });
  });
})();
