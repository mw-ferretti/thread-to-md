import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const background = readFileSync(new URL('../background/assets.js', import.meta.url), 'utf8');
const archive = readFileSync(new URL('../src/archive.js', import.meta.url), 'utf8');
const image = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5iXQAAAAASUVORK5CYII=', 'base64'));
const flush = () => new Promise(resolve => setImmediate(resolve));

function makePortPair() {
  const callbacks = { client: [], server: [], clientClose: [], serverClose: [] };
  let disconnected = false;
  const create = (kind) => ({
    name: 'threadtomd-asset',
    sender: kind === 'server' ? { tab: { url: 'https://chatgpt.com/c/example' } } : undefined,
    onMessage: { addListener(fn) { callbacks[kind].push(fn); } },
    onDisconnect: { addListener(fn) { callbacks[`${kind}Close`].push(fn); } },
    postMessage(msg) {
      if (disconnected) return;
      queueMicrotask(() => {
        if (!disconnected) callbacks[kind === 'server' ? 'client' : 'server'].forEach(fn => fn(msg));
      });
    },
    disconnect() {
      if (disconnected) return;
      disconnected = true;
      queueMicrotask(() => {
        for (const fn of [...callbacks.clientClose, ...callbacks.serverClose]) fn();
      });
    }
  });
  return { client: create('client'), server: create('server') };
}
function setup(fetcher) {
  let connected;
  let fetchCalls = 0;
  const server = createContext({
    chrome: { runtime: { onConnect: { addListener(fn) { connected = fn; } } } },
    fetch: (url, opts) => { fetchCalls++; return fetcher(url, opts); },
    URL, btoa, AbortController, setTimeout, clearTimeout
  });
  runInContext(background, server);
  const client = createContext({
    TextEncoder, TextDecoder, Blob, AbortController, DOMException, URL,
    atob, setTimeout, clearTimeout,
    location: { href: 'https://chatgpt.com/c/example', origin: 'https://chatgpt.com' },
    chrome: { runtime: { connect() {
      const pair = makePortPair();
      connected(pair.server);
      return pair.client;
    } } }
  });
  runInContext(archive, client);
  return { Collector: client.ThreadToMDArchive.Collector, get fetchCalls() { return fetchCalls; } };
}

test('Privileged relay archives a CORS-restricted OpenAI image', async () => {
  const h = setup(async (_url, options) => {
    assert.equal(options.credentials, 'omit');
    const response = new Response(image, { headers: { 'content-type': 'image/png' } });
    Object.defineProperty(response, 'url', { value: _url });
    return response;
  });
  const c = new h.Collector();
  const ref = c.register('image', 'https://images.openai.com/static-rsc-4/example', 'Diagram');
  await c.drain();
  assert.equal(h.fetchCalls, 1);
  assert.equal(c.summary().saved, 1);
  assert.match(c.rewrite(`![Diagram](${ref})`), /!\[Diagram\]\(assets\/images\/001-/);
});

test('Relay transfers large binary in acknowledged chunks', async () => {
  const data = new Uint8Array(320000);
  data.set(new TextEncoder().encode('%PDF-1.4\n'));
  const h = setup(async (url) => {
    const response = new Response(data, { headers: { 'content-type': 'application/pdf' } });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  });
  const c = new h.Collector();
  const ref = c.register('document', 'https://d2ol7oe51mr4n9.cloudfront.net/example.zip', 'Example', 'example.pdf');
  await c.drain();
  assert.equal(c.summary().saved, 1);
  assert.equal(c.assets[0].bytes, data.length);
  assert.match(c.rewrite(`[Example](${ref})`), /assets\/documents\/001-example\.pdf/);
});

test('Background refuses unknown origins and never fetches them', async () => {
  const h = setup(async () => new Response(image));
  const c = new h.Collector();
  const ref = c.register('image', 'https://unrelated-site.example/image.png', 'Photo');
  await c.drain();
  assert.equal(h.fetchCalls, 0);
  assert.equal(c.summary().saved, 0);
  assert.equal(c.summary().missing, 1);
  assert.match(c.assets[0].reason, /Origin not supported/);
  assert.match(c.rewrite(`![Photo](${ref})`), /https:\/\/unrelated-site\.example\/image\.png/);
});

test('Decorative favicons are not treated as conversation images', () => {
  const h = setup(async () => new Response(image));
  const { decorativeImage } = (() => {
    const scope = createContext({ TextEncoder, TextDecoder, Blob, AbortController, URL,
      location: { href: 'https://chatgpt.com/c/x' } });
    runInContext(archive, scope);
    return scope.ThreadToMDArchive;
  })();
  const element = { getAttribute: () => '', width: 32, height: 32, closest: () => ({}) };
  assert.equal(decorativeImage(element, 'https://www.google.com/s2/favicons?domain=github.com'), true);
  assert.equal(decorativeImage(element, 'https://images.openai.com/diagram.png'), true);
  const large = { ...element, width: 500, height: 400, closest: () => null };
  assert.equal(decorativeImage(large, 'https://images.openai.com/diagram.png'), false);
});
