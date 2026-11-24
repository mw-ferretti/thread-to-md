import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root),'utf8');
const manifest = JSON.parse(read('manifest.json'));
const exporter = read('src/exporter.js');
const i18n = read('src/i18n.js');
const popup = read('popup/popup.js');
const archive = read('src/archive.js');
test('Manifest V3 with least-privilege permissions', () => {
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['activeTab','scripting','storage','debugger']);
  assert.equal(manifest.host_permissions,undefined);
  assert.match(read('background/native_wheel.js'), /Input\.dispatchMouseEvent/);
  assert.equal(manifest.content_scripts,undefined);
  assert.equal(manifest.default_locale, 'en');
});
test('Content script stays local and preserves V4 parsing', () => {
  assert.match(exporter,/function scanDirection/);
  assert.match(i18n, /getUILanguage/);
  assert.match(popup, /src\/i18n\.js/);
  assert.match(exporter,/function fencedCode/);
  assert.match(exporter,/function normalize/);
  assert.match(exporter,/function readNew/);
  assert.match(exporter,/function readOld/);
  assert.doesNotMatch(exporter,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|document\.cookie/);
  assert.match(archive,/class Collector/);
  assert.match(archive,/async _download/);
  assert.doesNotMatch(archive,/sendBeacon|document\.cookie|localStorage/);
});
test('Popup injects exporter on explicit click', () => {
  assert.match(popup,/start\.addEventListener\('click'/);
  assert.match(popup,/chrome\.scripting\.executeScript/);
  assert.match(popup,/hostname === 'chatgpt\.com'/);
});
