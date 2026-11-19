import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../src/archive.js', import.meta.url), 'utf8');
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5iXQAAAAASUVORK5CYII=';
function runtime(fetcher = fetch) {
  const scope = { TextEncoder, TextDecoder, Blob, AbortController, URL,
    fetch: fetcher, setTimeout, clearTimeout,
    location: { href: 'https://chatgpt.com/c/fixture', origin: 'https://chatgpt.com' } };
  runInNewContext(code, scope);
  return scope.ThreadToMDArchive;
}
async function readStoredZip(blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(data.buffer);
  const files = new Map();
  let pos = 0;
  while (pos + 30 <= data.length && view.getUint32(pos, true) === 0x04034b50) {
    assert.equal(view.getUint16(pos + 8, true), 0);
    assert.equal(view.getUint16(pos + 6, true), 0x800);
    const length = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(data.slice(pos + 30, pos + 30 + nameLen));
    const offset = pos + 30 + nameLen + extraLen;
    files.set(name, data.slice(offset, offset + length));
    pos = offset + length;
  }
  assert.equal(view.getUint32(pos, true), 0x02014b50, 'central directory must be present');
  return files;
}

test('ZIP archive saves embedded images and documents with local Markdown links', async () => {
  const { Collector } = runtime();
  const collector = new Collector();
  const img = collector.register('image', `data:image/png;base64,${pngBase64}`, 'tiny image');
  const doc = collector.register('document', 'data:application/pdf,%25PDF-1.4%0Aexample', 'architecture.pdf', 'architecture.pdf');
  assert.equal(img, collector.register('image', `data:image/png;base64,${pngBase64}`, 'tiny image'));
  await collector.drain();
  const message = collector.rewrite(`![tiny image](${img})\n\n[architecture.pdf](${doc})`);
  assert.match(message, /!\[tiny image\]\(assets\/images\/001-/);
  assert.match(message, /\[architecture\.pdf\]\(assets\/documents\/002-architecture\.pdf\)/);
  const zip = collector.package(message, { messages: 1, source: 'https://chatgpt.com/c/fixture' });
  const entries = await readStoredZip(zip);
  assert.equal(entries.size, 4);
  assert.equal(new TextDecoder().decode(entries.get('conversation.md')), message);
  const manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json')));
  assert.equal(manifest.summary.saved, 2);
  assert.equal(manifest.summary.missing, 0);
  assert.equal(manifest.assets.length, 2);
  assert.ok(entries.has(manifest.assets[0].path));
  assert.ok(entries.has(manifest.assets[1].path));
  assert.ok(entries.get(manifest.assets[0].path).byteLength > 10);
  assert.equal(new TextDecoder().decode(entries.get(manifest.assets[1].path)).startsWith('%PDF-1.4'), true);
});

test('Expired/CORS documents preserve external links and a manifest failure', async () => {
  const { Collector } = runtime(async () => { throw new TypeError('Failed to fetch'); });
  const c = new Collector();
  const token = c.register('document', 'https://files.example.org/report.pdf', 'report.pdf');
  const noURL = c.registerMissing('private.docx');
  await c.drain();
  const md = c.rewrite(`[report.pdf](${token}) [private.docx](${noURL})`);
  assert.match(md, /\[report\.pdf\]\(https:\/\/files\.example\.org\/report\.pdf\)/);
  assert.match(md, /\[Attachment unavailable: private\.docx\]/);
  const files = await readStoredZip(c.package(md, { messages: 1 }));
  assert.equal(files.size, 2);
  const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.equal(manifest.summary.missing, 2);
  assert.ok(manifest.assets.every(a => a.path === null));
});

test('Rejects oversized responses before reading them', async () => {
  let read = false;
  const { Collector } = runtime(async () => ({
    ok: true, type: 'basic', status: 200,
    headers: new Headers({ 'content-length': String(30 * 1024 * 1024), 'content-type': 'application/pdf' }),
    body: { getReader() { read = true; throw new Error('should not read'); } }
  }));
  const c = new Collector();
  const token = c.register('document', 'https://chatgpt.com/large.pdf', 'large');
  await c.drain();
  assert.equal(read, false);
  assert.equal(c.summary().saved, 0);
  assert.match(c.rewrite(`[large](${token})`), /https:\/\/chatgpt\.com\/large\.pdf/);
});

test('Recognizes file links, not arbitrary website links', () => {
  const { shouldArchiveLink } = runtime();
  const el = { hasAttribute: () => false, closest: () => null, textContent: 'Some website', getAttribute: () => null };
  assert.equal(shouldArchiveLink(el, 'https://example.com/home'), false);
  assert.equal(shouldArchiveLink(el, 'https://example.com/architecture.pdf?x=1'), true);
  assert.equal(shouldArchiveLink(el, 'https://example.com/model.tar.gz'), true);
});
