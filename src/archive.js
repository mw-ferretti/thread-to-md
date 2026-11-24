/*
 * ThreadToMD archive engine v0.2.4.5 (assisted experiment).
 * Local-only; no service worker, external libraries, remote code, or telemetry.
 * Deliberately bounded (no ZIP64 / files over 24 MiB). ZIP entries use STORE:
 * images and office documents are usually pre-compressed; fewer copies matter.
 */
(() => {
  'use strict';

  const LIMITS = Object.freeze({ entries: 200, perFile: 24 * 1024 * 1024,
    total: 160 * 1024 * 1024, concurrency: 3, timeoutMs: 32000 });
  const encoder = new TextEncoder();
  const documentExt = /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|md|markdown|csv|tsv|json|jsonl|ya?ml|xml|html?|zip|tar|gz|tgz|7z|rar|log|patch|diff|ipynb|py|rs|ts|js|go|java|toml|sql|sh)(?:$|[?#])/i;
  const imageExt = /\.(?:png|jpe?g|gif|webp|avif|bmp|apng)(?:$|[?#])/i;
  const mimeExt = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/avif': '.avif', 'image/bmp': '.bmp',
    'application/pdf': '.pdf', 'text/plain': '.txt', 'text/markdown': '.md',
    'text/csv': '.csv', 'application/json': '.json', 'application/zip': '.zip',
    'application/gzip': '.gz', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
  };
  const isHttp = (url) => /^https?:\/\//i.test(url);
  const escapeName = (value) => String(value || 'file').normalize('NFKC')
    .replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, '-').replace(/^\.+/, '')
    .replace(/\s+/g, ' ').trim().slice(0, 85) || 'file';
  function fileNameFromUrl(raw) {
    if (/^(?:blob|data):/i.test(raw || '')) return '';
    try { return decodeURIComponent(new URL(raw, location.href).pathname.split('/').pop() || ''); }
    catch { return ''; }
  }
  function shouldArchiveLink(node, href) {
    if (!href) return false;
    if (node.hasAttribute('download')) return true;
    if (documentExt.test(href)) return true;
    if (node.closest('[data-testid*="attachment"], [data-testid*="file-card"], [data-testid*="file-attachment"]')) return true;
    const text = (node.textContent || '') + ' ' + (node.getAttribute('aria-label') || '');
    if (/(?:download|baixar|descargar)\s+(?:the\s+)?(?:file|document|pdf|zip|arquivo|anexo|pacote|package|source|c\u00f3digo)/i.test(text)) return true;
    if (/^(?:blob:|data:)/i.test(href) && /\b(download|baixar|descargar)\b/i.test(text)) return true;
    return false;
  }
  function attachmentButton(node) {
    const hint = [node.getAttribute('data-testid'), node.getAttribute('aria-label'), node.textContent].join(' ');
    if (/\.(?:pdf|zip|tar\.gz|docx?|xlsx?|pptx?|md|txt|csv|json)\b/i.test(hint)) return true;
    return Boolean(node.closest('[data-testid*="file-attachment"], [data-testid*="attachment-card"]'));
  }
  function crcUpdate(crc, bytes) {
    let c = crc;
    for (const b of bytes) {
      c ^= b;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
    return c >>> 0;
  }
  function crcOf(chunks) {
    let c = 0xffffffff;
    for (const chunk of chunks) c = crcUpdate(c, chunk);
    return (c ^ 0xffffffff) >>> 0;
  }
  function word16(view, offset, value) { view.setUint16(offset, value, true); }
  function word32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  function zipBlob(entries) {
    if (entries.length > 65535) throw new Error('Too many ZIP entries');
    const blobs = [], centers = [];
    let offset = 0, centralSize = 0;
    for (const entry of entries) {
      const filename = encoder.encode(entry.path);
      const chunks = entry.chunks || [encoder.encode(entry.text || '')];
      const size = chunks.reduce((n, b) => n + b.byteLength, 0);
      if (filename.byteLength > 65535 || size > 0xffffffff || offset + size > 0xffffffff) {
        throw new Error('ZIP format limit exceeded');
      }
      const crc = crcOf(chunks);
      const header = new Uint8Array(30 + filename.length), h = new DataView(header.buffer);
      word32(h, 0, 0x04034b50); word16(h, 4, 20); word16(h, 6, 0x0800);
      word16(h, 8, 0); word32(h, 14, crc); word32(h, 18, size);
      word32(h, 22, size); word16(h, 26, filename.length);
      header.set(filename, 30);
      blobs.push(header, ...chunks);
      const central = new Uint8Array(46 + filename.length), c = new DataView(central.buffer);
      word32(c, 0, 0x02014b50); word16(c, 4, 20); word16(c, 6, 20);
      word16(c, 8, 0x0800); word16(c, 10, 0); word32(c, 16, crc);
      word32(c, 20, size); word32(c, 24, size); word16(c, 28, filename.length);
      word32(c, 42, offset); central.set(filename, 46);
      centers.push(central);
      offset += header.length + size;
      centralSize += central.length;
    }
    if (offset + centralSize > 0xffffffff) throw new Error('ZIP central directory is too large');
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    word32(e, 0, 0x06054b50); word16(e, 8, entries.length);
    word16(e, 10, entries.length); word32(e, 12, centralSize); word32(e, 16, offset);
    return new Blob([...blobs, ...centers, end], { type: 'application/zip' });
  }
  function sanitizedSource(raw) {
    if (isHttp(raw)) {
      try { const u = new URL(raw); return u.origin + u.pathname; } catch { return '[invalid-url]'; }
    }
    if (raw?.startsWith('blob:')) return '[temporary-blob-url]';
    if (raw?.startsWith('data:')) return '[embedded-data-url]';
    return '[unavailable]';
  }
  function contentDispositionFile(value) {
    if (!value) return '';
    const utf = /filename\*=UTF-8''([^;]+)/i.exec(value);
    if (utf) { try { return decodeURIComponent(utf[1].trim()); } catch { /* fallback */ } }
    return /filename="?([^";]+)"?/i.exec(value)?.[1]?.trim() || '';
  }
  function extension(name) {
    const lower = name.toLowerCase();
    const multi = /\.(?:tar\.gz|tar\.bz2)$/i.exec(lower);
    return multi ? multi[0] : (/\.[a-z0-9]{1,9}$/i.exec(lower)?.[0] || '');
  }
  function safePath(asset, mime, disposition) {
    let name = escapeName(asset.hint || contentDispositionFile(disposition) ||
      fileNameFromUrl(asset.url) || (asset.kind === 'image' ? 'image' : 'document'));
    let ext = extension(name);
    if (!ext || ext === '.bin' || !/^[.a-z0-9]+$/i.test(ext)) {
      ext = mimeExt[mime] || (asset.kind === 'image' ? '.png' : '.bin');
      name += ext;
    }
    return `assets/${asset.kind === 'image' ? 'images' : 'documents'}/${String(asset.id).padStart(3, '0')}-${name}`;
  }
  function checkImage(mime, firstChunk) {
    // SVG/HTML are active content; do not archive them as images.
    if (/\b(?:svg\+xml|html|javascript)\b/i.test(mime)) return false;
    if (mime.startsWith('image/')) return /^(image\/(png|jpeg|gif|webp|avif|bmp|apng))$/.test(mime);
    // Some signed endpoints return application/octet-stream; check common signatures.
    const a = firstChunk || new Uint8Array();
    const matches = (arr) => arr.every((v, i) => a[i] === v);
    return matches([0x89,0x50,0x4e,0x47]) || matches([0xff,0xd8,0xff]) ||
      matches([0x47,0x49,0x46,0x38]) || matches([0x52,0x49,0x46,0x46]);
  }
  function safeMarkdownUrl(url) {
    return String(url).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
  }

  // CORS-free retrieval is delegated to the extension background context.
  // Chrome extension ports JSON-serialize messages, so transfer small base64
  // chunks and explicitly acknowledge each one before the next is produced.
  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function fetchViaExtension(url, signal) {
    return new Promise((resolve, reject) => {
      let port;
      let settled = false;
      let size = 0;
      let mime = '';
      let disposition = '';
      const chunks = [];
      function finish(error, result) {
        if (settled) return;
        settled = true;
        try { signal?.removeEventListener('abort', onAbort); } catch { /* ignore */ }
        try { port?.disconnect(); } catch { /* already disconnected */ }
        if (error) reject(error); else resolve(result);
      }
      const onAbort = () => finish(new DOMException('Download cancelled', 'AbortError'));
      try { port = chrome.runtime.connect({ name: 'threadtomd-asset' }); }
      catch (err) { finish(err); return; }
      if (signal?.aborted) { onAbort(); return; }
      signal?.addEventListener('abort', onAbort, { once: true });
      port.onDisconnect.addListener(() => {
        if (!settled) finish(new Error(chrome.runtime.lastError?.message || 'Asset relay disconnected'));
      });
      port.onMessage.addListener((msg) => {
        if (settled) return;
        try {
          if (msg?.type === 'meta') {
            mime = msg.mime || '';
            disposition = msg.disposition || '';
            if (Number(msg.length) > LIMITS.perFile) throw new Error('File exceeds 24 MiB limit');
          } else if (msg?.type === 'chunk') {
            const chunk = decodeBase64(msg.data);
            size += chunk.length;
            if (size > LIMITS.perFile) throw new Error('File exceeds 24 MiB limit');
            chunks.push(chunk);
            port.postMessage({ type: 'ack' });
          } else if (msg?.type === 'done') {
            let index = 0;
            // Response-like adapter preserves the common MIME/ZIP validation
            // path below without concatenating chunks or copying asset bodies.
            finish(null, {
              ok: true, type: 'basic', status: 200,
              headers: { get(name) {
                const key = name.toLowerCase();
                return key === 'content-type' ? mime :
                  key === 'content-disposition' ? disposition :
                    key === 'content-length' ? String(size) : null;
              } },
              body: { getReader() { return {
                read: async () => index < chunks.length
                  ? { value: chunks[index++], done: false } : { done: true },
                releaseLock() {}
              }; } }
            });
          } else if (msg?.type === 'error') {
            throw new Error(msg.reason || 'Privileged download failed');
          }
        } catch (err) { finish(err); }
      });
      port.postMessage({ type: 'start', url });
    });
  }
  function decorativeImage(node, url) {
    try {
      const u = new URL(url, location.href);
      if (/^www\.google\.com$/.test(u.hostname) && u.pathname.startsWith('/s2/favicons')) return true;
      if (/(?:\/favicon(?:[.-]|\/)|\/icons?\/favicon)/i.test(u.pathname)) return true;
      if (/\b(?:favicon|site icon)\b/i.test(node.getAttribute('alt') || '')) return true;
      const w = Number(node.getAttribute('width')) || node.width || 0;
      const h = Number(node.getAttribute('height')) || node.height || 0;
      if (w > 0 && w <= 36 && h > 0 && h <= 36 &&
          node.closest('[data-testid*="citation"], [data-testid*="source"], a[href]')) return true;
      return false;
    } catch { return false; }
  }

  class Collector {
    constructor() {
      this.assets = [];
      this.byKey = new Map();
      this.queue = [];
      this.active = 0;
      this.waiters = [];
      this.totalBytes = 0;
      this.overflow = 0;
      this.cancelled = false;
      this.controllers = new Set();
    }
    register(kind, rawUrl, label = '', hint = '') {
      const url = String(rawUrl || '').trim();
      const key = `${kind}:` + (url.length > 400 ? `${url.length}:${crcOf([encoder.encode(url)]).toString(16)}` : url);
      const known = this.byKey.get(key);
      if (known) return known.token;
      if (this.assets.length >= LIMITS.entries) { this.overflow++; return null; }
      const asset = this._create(kind, url, label, hint, key);
      if (asset.status === 'queued') { this.queue.push(asset); this._pump(); }
      return asset.token;
    }
    registerMissing(label) {
      const key = `missing:${label}`;
      const known = this.byKey.get(key);
      if (known) return known.token;
      if (this.assets.length >= LIMITS.entries) { this.overflow++; return null; }
      return this._create('document', '', label, label, key).token;
    }
    _create(kind, url, label, hint, key) {
      const id = this.assets.length + 1;
      let status = 'queued', reason = '';
      if (!url) { status = 'unavailable'; reason = 'No direct download URL in the rendered conversation'; }
      else {
        let parsed;
        try { parsed = new URL(url, location.href); } catch { parsed = null; }
        if (!parsed || !['https:', 'blob:', 'data:'].includes(parsed.protocol)) {
          status = 'unsupported'; reason = 'Unsupported or non-downloadable URL (HTTPS only)';
        } else if (parsed.protocol === 'https:' && (
          /^(?:localhost|.*\.localhost|.*\.local|\[::1\])$/i.test(parsed.hostname) ||
          /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(parsed.hostname) ||
          /^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(parsed.hostname)
        )) {
          status = 'unsupported'; reason = 'Private network URL blocked';
        }
      }
      const asset = { id, kind, url, label, hint, token: `__THREADTOMD_ASSET_${String(id).padStart(6, '0')}__`,
        status, reason, path: '', bytes: 0, mime: '', chunks: [], crc32: null };
      this.assets.push(asset); this.byKey.set(key, asset);
      return asset;
    }
    _wake() {
      if (this.active || this.queue.length) return;
      for (const callback of this.waiters.splice(0)) callback();
    }
    _pump() {
      while (!this.cancelled && this.active < LIMITS.concurrency && this.queue.length) {
        const asset = this.queue.shift();
        this.active++;
        this._download(asset).catch(() => { /* _download always records its own error. */ })
          .finally(() => { this.active--; this._pump(); this._wake(); });
      }
      this._wake();
    }
    async drain() {
      if (!this.active && !this.queue.length) return;
      await new Promise((resolve) => this.waiters.push(resolve));
    }
    cancel() {
      this.cancelled = true;
      for (const ctrl of this.controllers) ctrl.abort();
      for (const asset of this.queue.splice(0)) { asset.status = 'skipped'; asset.reason = 'Export stopped'; }
      this._wake();
    }
    summary() {
      return this.assets.reduce((out, a) => {
        if (a.status === 'saved') out.saved++;
        else if (a.status === 'queued' || a.status === 'downloading') out.pending++;
        else out.missing++;
        return out;
      }, { total: this.assets.length, saved: 0, pending: 0, missing: 0, bytes: this.totalBytes, overflow: this.overflow });
    }
    async _download(asset) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), LIMITS.timeoutMs);
      this.controllers.add(ctrl);
      asset.status = 'downloading';
      try {
        const parsed = new URL(asset.url, location.href);
        const sameOrigin = parsed.origin === location.origin;
        const res = parsed.protocol === 'https:' && typeof globalThis.chrome?.runtime?.connect === 'function'
          ? await fetchViaExtension(asset.url, ctrl.signal)
          : await fetch(asset.url, { signal: ctrl.signal, credentials: sameOrigin ? 'same-origin' : 'omit',
            cache: 'default', redirect: 'follow' });
        if (!res.ok || res.type === 'opaque') throw new Error(`HTTP ${res.status || 'opaque response'}`);
        const length = Number(res.headers.get('content-length'));
        if (Number.isFinite(length) && length > LIMITS.perFile) throw new Error('File exceeds 24 MiB limit');
        const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (/^(text\/html|application\/xhtml\+xml|image\/svg\+xml)/.test(mime)) {
          throw new Error('HTML/SVG response is not a downloadable asset');
        }
        const chunks = [];
        let size = 0;
        if (res.body?.getReader) {
          const reader = res.body.getReader();
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.byteLength;
              if (size > LIMITS.perFile) throw new Error('File exceeds 24 MiB limit');
              chunks.push(part.value);
            }
          } finally { try { reader.releaseLock(); } catch { /* ignore */ } }
        } else {
          const buffer = new Uint8Array(await res.arrayBuffer());
          size = buffer.length;
          if (size > LIMITS.perFile) throw new Error('File exceeds 24 MiB limit');
          chunks.push(buffer);
        }
        if (!size) throw new Error('Empty file');
        if (asset.kind === 'image' && !checkImage(mime, chunks[0])) {
          throw new Error('Unsupported image format');
        }
        if (this.totalBytes + size > LIMITS.total) throw new Error('Archive exceeds 160 MiB limit');
        // Ensure MIME is not HTML hiding behind a misleading file extension.
        const prefix = chunks[0] || new Uint8Array();
        const first = new TextDecoder().decode(prefix.slice(0, 80)).trimStart().toLowerCase();
        if (asset.kind === 'document' && (first.startsWith('<!doctype html') || first.startsWith('<html'))) {
          throw new Error('Download returned an HTML page, not a document');
        }
        asset.bytes = size;
        asset.mime = mime;
        asset.chunks = chunks;
        asset.crc32 = crcOf(chunks).toString(16).padStart(8, '0');
        asset.path = safePath(asset, mime, res.headers.get('content-disposition') || '');
        asset.status = 'saved';
        this.totalBytes += size;
      } catch (err) {
        asset.status = 'failed';
        asset.reason = (err?.name === 'AbortError' ? 'Timed out or cancelled' : String(err?.message || err))
          .slice(0, 160).replace(/https?:\/\/\S+/g, '[URL]');
      } finally {
        clearTimeout(timer); this.controllers.delete(ctrl);
      }
    }
    rewrite(content) {
      return String(content).replace(/(!?)\[([^\]\n]*(?:\\\][^\]\n]*)*)\]\(__THREADTOMD_ASSET_(\d{6})__\)/g,
        (match, bang, label, index) => {
          const asset = this.assets[Number(index) - 1];
          if (!asset) return match;
          if (asset.status === 'saved') return `${bang}[${label}](${safeMarkdownUrl(asset.path)})`;
          if (isHttp(asset.url) || /^(?:sandbox):/i.test(asset.url))
            return `${bang}[${label}](${safeMarkdownUrl(asset.url)})`;
          return `[${bang ? 'Image' : 'Attachment'} unavailable: ${label}]`;
        });
    }
    manifest(info) {
      return {
        schemaVersion: 1, generator: 'ThreadToMD', version: '0.2.4.16',
        exportedAt: new Date().toISOString(), conversation: info,
        limits: { maxAssets: LIMITS.entries, maxAssetBytes: LIMITS.perFile, maxArchiveAssetsBytes: LIMITS.total },
        summary: this.summary(),
        assets: this.assets.map((a) => ({ id: a.id, type: a.kind, label: a.label,
          source: sanitizedSource(a.url), status: a.status,
          path: a.status === 'saved' ? a.path : null, bytes: a.bytes || 0,
          mime: a.mime || null, crc32: a.crc32,
          reason: a.status === 'saved' ? null : (a.reason || 'Unavailable') }))
      };
    }
    package(markdown, info) {
      // Capture references were already resolved by rewrite() in exporter.js.
      const entries = [{ path: 'conversation.md', chunks: [encoder.encode(markdown)] }];
      for (const a of this.assets) {
        if (a.status === 'saved') entries.push({ path: a.path, chunks: a.chunks });
      }
      entries.push({ path: 'manifest.json', chunks: [encoder.encode(JSON.stringify(this.manifest(info), null, 2) + '\n')] });
      return zipBlob(entries);
    }
  }
  globalThis.ThreadToMDArchive = Object.freeze({ Collector, zipBlob, shouldArchiveLink,
    attachmentButton, decorativeImage, LIMITS });
})();
