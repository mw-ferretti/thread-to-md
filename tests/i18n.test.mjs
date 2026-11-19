import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');

function locale(ui, fallback = 'de-DE') {
  const context = {
    chrome: { i18n: { getUILanguage: () => ui } },
    navigator: { language: fallback }
  };
  runInNewContext(source, context, { filename: 'src/i18n.js' });
  return context.ThreadToMDI18n;
}

test('Only pt and pt-BR use Portuguese; every other UI locale uses English', () => {
  for (const ui of ['pt', 'PT', 'pt-BR', 'pt_br', 'PT-br']) {
    assert.equal(locale(ui).locale, 'pt_BR', ui);
    assert.match(locale(ui).t('phaseOlder'), /mensagens anteriores/);
  }
  for (const ui of ['en', 'en-US', 'en-GB', 'es', 'fr-FR', 'de', 'pt-PT', 'ja-JP', 'zh-CN']) {
    assert.equal(locale(ui).locale, 'en', ui);
    assert.equal(locale(ui).t('phaseOlder'), 'Scanning older messages', ui);
  }
});

test('Missing browser locale API falls back to navigator; unknown language is English', () => {
  const ctx = { navigator: { language: 'pt-BR' } };
  runInNewContext(source, ctx);
  assert.equal(ctx.ThreadToMDI18n.locale, 'pt_BR');
  const ctxUnknown = { navigator: { language: 'ru-RU' } };
  runInNewContext(source, ctxUnknown);
  assert.equal(ctxUnknown.ThreadToMDI18n.locale, 'en');
});

test('Interpolation supports dynamic statuses, while keys exist in both languages', () => {
  for (const ui of ['en', 'pt-BR']) {
    const dict = locale(ui);
    assert.match(dict.t('progressLine', { phase: dict.t('phaseOlder'), count: 143, steps: 3210, layout: dict.t('layoutNew'), extra: '' }), /143/);
    assert.match(dict.t('popupStartError', { error: 'test-code' }), /test-code/);
    assert.match(dict.t('fileUnstableIds', { count: 10 }), /10/);
  }
});
