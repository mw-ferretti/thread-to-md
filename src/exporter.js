/*
 * ThreadToMD | ChatGPT -> Markdown engine V4.5 (19/11/2026)
 * Supports classic ChatGPT and the new Chat/Work layout (app-shell).
 *
 * USO: acionado pela extensao com permissao temporaria para a aba ativa.
 * Faz captura local incremental: sobe ate o inicio, depois desce ate o final.
 * Mensagens removidas do DOM pelo scroll virtualizado ficam na memoria.
 *
 * PRIVACIDADE: no modo Markdown nao faz fetch. No modo ZIP, o navegador
 * recupera apenas arquivos visiveis e referenciados; sem servidores nossos.
 * Nao le cookies, localStorage nem faz telemetria.
 * V4.5: pausas seguras quando a aba perde visibilidade/foco; retoma sem
 * considerar tempo em segundo plano como estabilidade do historico.
 *
 * Para cancelar e salvar o que ja foi encontrado: botao no painel ou
 * window.__chatgptMdExporter.stop()
 */
void (async function exportarChatGPTParaMarkdownV4() {
  'use strict';

  if (window.__chatgptMdExporter?.running) {
    console.warn(globalThis.ThreadToMDI18n?.t('consoleAlreadyRunning') || '[ThreadToMD] An export is already running.');
    return;
  }

  const VERSION = '4.5';
  const exportMode = globalThis.__threadtomdExportMode === 'archive' ? 'archive' : 'markdown';
  const captureMode = ['native', 'assisted'].includes(globalThis.__threadtomdCaptureMode)
    ? globalThis.__threadtomdCaptureMode : 'automatic';
  const archive = exportMode === 'archive' ? new globalThis.ThreadToMDArchive.Collector() : null;
  // The popup injects the shared locale runtime before this exporter.
  const t = globalThis.ThreadToMDI18n?.t;
  if (typeof t !== 'function') {
    console.error('[ThreadToMD] Missing locale runtime; reload the extension.');
    return;
  }
  const layoutLabel = (mode) => ({
    'novo (Chat/Work)': t('layoutNew'),
    'classico': t('layoutClassic'),
    'novo (carregando)': t('layoutNewLoading'),
    'nao reconhecido': t('layoutUnrecognized')
  }[mode] || mode);
  const CFG = {
    stepRatio: 0.50,
    stepDelay: 260,
    edgeDelay: 1000,
    // ChatGPT fetches older pages asynchronously. Four quiet seconds is unsafe.
    olderQuietMs: 24000,
    olderProbeIntervalMs: 6000,
    olderMinProbes: 3,
    olderMaxWaitMs: 90000,
    newerQuietMs: 4000,
    maxStepsPerDirection: 20000,
    autoLoopMinStaleSteps: 24,
    autoLoopReverseLimit: 3,
    autoLoopMaxStaleSteps: 160,
    initialWaitMs: 10000,
    // Matches the successful 600-event Chrome Native Wheel In-Tab Lab.
    nativeWheelPixels: 160,
    nativeWheelIntervalMs: 110,
    nativeNonEdgeStallLimit: 18,
    // A bouncing virtualizer can move the scrollbar indefinitely while
    // showing the same viewport. Detect repeated semantic viewport states.
    nativeCycleSampleEvery: 4,
    nativeCycleRepeatThreshold: 4,
    nativeCycleMinSpan: 20,
    // A narrow intervention; never alter the original wheel, edge or timing rules.
    nativeMaxWidgetRemovals: 3,
    nativeScrollableMinPixels: 40,
    nativeStallRecoveryLimit: 4,
    nativeStallRecoveryWaitMs: [1400, 2400, 3500, 5000],
    logEvery: 25
  };
  const S = {
    running: true, stopping: false, partial: false, phase: 'Inicializando',
    mode: '?', steps: 0, records: new Map(), order: [], errors: [],
    withoutStableKey: 0, began: Date.now(), observer: null,
    root: null, updatePending: false, olderEdge: 'not-scanned', olderProbes: 0,
    paused: false, pauses: 0, resumeEpoch: 0, timingDisruptions: 0,
    foregroundWaiters: new Set(), lastLoggedStep: -1,
    assistedDirection: 'up', assistedWheelUp: 0, assistedWheelDown: 0,
    unanchoredWindows: 0, assistedResolve: null,
    assistedFallback: false, autoNoNovelSteps: 0, autoReverseJumps: 0,
    nativeFallback: false, nativeBridge: null, nativeWheelEvents: 0,
    nativeRebases: 0, nativeTrustedWheel: 0, nativeReturnAnchor: null,
    nativeStallRecoveries: 0, nativeStallNudges: 0, nativeWheelTarget: 0,
    nativeCycles: 0,
    nativeRemovedWidgets: [], nativeRemovedOwners: new Set(),
    nativeWidgetSkips: 0, nativeWidgetRestores: 0,
    nativeWidgetSkipRejected: 0
  };

  const isAssisted = () => captureMode === 'assisted' || S.assistedFallback;

  // Browsers throttle timers and may freeze DOM work in background tabs.
  // Scanning is an interactive DOM operation: suspend it while the tab/window
  // is not foregrounded rather than treating a long timeout as a quiet edge.
  const isForeground = () => document.visibilityState === 'visible' &&
    (typeof document.hasFocus !== 'function' || document.hasFocus());
  function wakeWaiters() {
    for (const wake of S.foregroundWaiters) wake();
    S.foregroundWaiters.clear();
  }
  function updateActivity() {
    const active = isForeground();
    if (!active && !S.paused) {
      S.paused = true;
      // Privileged debugging must not remain attached to an inactive tab.
      if (S.nativeBridge) { S.nativeBridge.close(); S.nativeBridge = null; }
      S.pauses++;
      status();
    } else if (active && S.paused) {
      S.paused = false;
      S.resumeEpoch++;
      status();
    }
    if (active || S.stopping) wakeWaiters();
  }
  async function waitForForeground() {
    updateActivity();
    while (!isForeground() && !S.stopping) {
      await new Promise((resolve) => {
        S.foregroundWaiters.add(resolve);
        // Avoid losing a resume between checking focus and registering.
        if (isForeground() || S.stopping) {
          S.foregroundWaiters.delete(resolve);
          resolve();
        }
      });
      updateActivity();
    }
  }
  async function sleep(ms) {
    await waitForForeground();
    if (S.stopping) return;
    const began = performance.now();
    await new Promise((resolve) => setTimeout(resolve, ms));
    const observed = performance.now() - began;
    await waitForForeground();
    // A busy/temporarily throttled page can produce a very late timer even
    // without a delivered visibility event. Invalidate edge stability then.
    if (observed > Math.max(2000, ms * 3)) {
      S.timingDisruptions++;
      S.resumeEpoch++;
    }
  }
  async function drainAssets() {
    if (!archive) return;
    await archive.drain();
    await waitForForeground();
  }
  const clean = (s) => String(s || '').replace(/\u00a0/g, ' ');
  const qs = (root, selector) => [...root.querySelectorAll(selector)];
  const isFromPanel = (el) => Boolean(el?.closest?.('#threadtomd-progress-panel'));
  const isHiddenTimeline = (el) => Boolean(el?.closest?.('[role="presentation"]'));
  const isRejected = (el) => isFromPanel(el) || isHiddenTimeline(el);

  // Codigos ASCII devem virar fenced blocks para Markdown preservar espacos,
  // novas linhas e alinhamentos. O navegador tambem pode renderizar um
  // bloco de codigo fora de <pre> acompanhado da legenda visual "Plain text".
  function fencedCode(raw, language = 'text') {
    const value = clean(raw).replace(/\n+$/, '');
    const width = Math.max(3, ...(value.match(/`+/g) || []).map(x => x.length + 1));
    const fence = '`'.repeat(width);
    return `\n\n${fence}${language}\n${value}\n${fence}\n\n`;
  }

  // Conversao HTML renderizado -> Markdown. Nao executa HTML da pagina.
  function md(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = clean(node.nodeValue);
      // HTML indentation between elements is layout whitespace, not Markdown code.
      if (/^\s*\n\s*$/.test(raw)) return '\n';
      return raw;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (isFromPanel(node) || node.getAttribute('aria-hidden') === 'true') return '';
    if (node.classList.contains('sr-only') || node.classList.contains('select-none') && /^h[1-6]$/.test(tag)) return '';
    if (node.matches('[data-conversation-role="assistant"], [data-conversation-role="user"]')) return '';
    if (tag === 'button' && archive && globalThis.ThreadToMDArchive.attachmentButton(node)) {
      const label = clean(node.textContent || node.getAttribute('aria-label') || 'attachment').trim().slice(0, 140);
      const parent = node.closest('[data-testid*="attachment"], [data-testid*="file-card"]');
      const siblingLink = parent?.querySelector('a[href], a[data-download-url]');
      const rawUrl = node.getAttribute('data-download-url') || parent?.getAttribute('data-download-url') ||
        siblingLink?.getAttribute('data-download-url') || siblingLink?.getAttribute('href') || '';
      const token = rawUrl ? archive.register('document', rawUrl, label, label) : archive.registerMissing(label);
      return token ? `\n\n[${label.replace(/\]/g, '\\]')}](${token})\n\n`
        : `\n\n[Attachment unavailable: ${label}]\n\n`;
    }
    if (['script', 'style', 'noscript', 'svg', 'button', 'nav', 'form', 'input', 'textarea', 'select', 'canvas'].includes(tag)) return '';
    const testId = node.getAttribute('data-testid') || '';
    if (/(message-actions|copy-turn-action|toolbar|feedback|composer)/i.test(testId)) return '';
    const parts = () => [...node.childNodes].map((x) => md(x, depth)).join('');

    if (tag === 'pre') {
      const code = node.querySelector('code') || node;
      const cls = String(code.className || '');
      const lang = (cls.match(/(?:language|lang)-([\w+#.-]+)/) || [])[1] || 'text';
      return fencedCode(code.textContent, lang);
    }
    if (tag === 'code') {
      const raw = clean(node.textContent);
      // A interface nova frequentemente usa <code> sem <pre>. Nesses casos
      // o inline Markdown corromperia diagrams e codigos de varias linhas.
      if (/[\r\n]/.test(raw)) return fencedCode(raw, 'text');
      const ticks = '`'.repeat(Math.max(1, ...(raw.match(/`+/g) || []).map(x => x.length + 1)));
      return `${ticks}${raw}${ticks}`;
    }
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${parts().trim()}\n\n`;
    if (tag === 'b' || tag === 'strong') return `**${parts()}**`;
    if (tag === 'i' || tag === 'em') return `*${parts()}*`;
    if (['del', 's', 'strike'].includes(tag)) return `~~${parts()}~~`;
    if (tag === 'a') {
      const label = parts().trim() || clean(node.textContent).trim();
      const href = node.getAttribute('href') || node.getAttribute('data-download-url') || '';
      if (!href || /^javascript:/i.test(href)) return label;
      try {
        const absolute = new URL(href, location.href).href;
        if (archive && globalThis.ThreadToMDArchive.shouldArchiveLink(node, href)) {
          const token = archive.register('document', absolute, label, node.getAttribute('download') || '');
          return `[${label.replace(/\]/g, '\\]')}](${token || absolute})`;
        }
        return /^(blob:|data:)/i.test(href) ? label : `[${label.replace(/\]/g, '\\]')}](${absolute})`;
      } catch { return label; }
    }
    if (tag === 'img') {
      const alt = clean(node.getAttribute('alt') || t('imageAltDefault')).replace(/\]/g, '\\]');
      const url = node.currentSrc || node.getAttribute('src') || '';
      if (!url) return t('imageAttachment', { alt });
      try {
        const absolute = new URL(url, location.href).href;
        if (archive) {
          if (globalThis.ThreadToMDArchive.decorativeImage(node, absolute)) {
            return /^https?:/i.test(absolute) ? `![${alt}](${absolute})` : '';
          }
          const hint = node.getAttribute('data-filename') || node.getAttribute('download') || '';
          const token = archive.register('image', absolute, alt, hint);
          return token ? `![${alt}](${token})` :
            (/^https?:/i.test(absolute) ? `![${alt}](${absolute})` : t('imageAttachment', { alt }));
        }
        return /^(blob:|data:)/i.test(url) ? t('imageAttachment', { alt }) : `![${alt}](${absolute})`;
      } catch { return t('imageLabel', { alt }); }
    }
    if (tag === 'p') return `\n\n${parts().trim()}\n\n`;
    if (tag === 'blockquote') {
      const body = parts().trim();
      return `\n\n${body.split('\n').map((x) => `> ${x}`).join('\n')}\n\n`;
    }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      const start = Number(node.getAttribute('start') || 1);
      const items = [...node.children].filter((x) => x.tagName.toLowerCase() === 'li');
      let out = '\n';
      for (let i = 0; i < items.length; i++) {
        const child = items[i];
        // Mantem listas aninhadas sem contar seu texto duas vezes.
        const clone = child.cloneNode(true);
        clone.querySelectorAll('ul, ol').forEach((x) => x.remove());
        const body = md(clone, depth + 1).trim().replace(/\n{3,}/g, '\n\n');
        const prefix = ordered ? `${start + i}. ` : '- ';
        out += `${'  '.repeat(depth)}${prefix}${body.replace(/\n/g, `\n${'  '.repeat(depth + 1)}`)}\n`;
        [...child.children].filter((x) => /^(ul|ol)$/i.test(x.tagName))
          .forEach((x) => { out += md(x, depth + 1); });
      }
      return `${out}\n`;
    }
    if (tag === 'table') {
      const rows = qs(node, 'tr').map((r) => [...r.children]
        .filter((c) => /^(td|th)$/i.test(c.tagName))
        .map((c) => md(c).trim().replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')));
      if (!rows.length) return '';
      const cols = Math.max(...rows.map((r) => r.length));
      const fmt = (cells) => `| ${Array.from({length: cols}, (_, i) => cells[i] || '').join(' | ')} |`;
      return `\n\n${[fmt(rows[0]), fmt(Array(cols).fill('---')), ...rows.slice(1).map(fmt)].join('\n')}\n\n`;
    }
    if (tag === 'li') return parts();
    return parts();
  }

  function normalize(input) {
    // Preserva CADA espaco e linha em fenced blocks enquanto limpa somente a
    // prosa. O marcador interno nunca e enviado ao arquivo exportado.
    const blocks = [];
    const pattern = /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[ \t]*$)/gm;
    const shield = (text) => text.replace(pattern, (block) => {
      const marker = '\uE000MD' + blocks.length + '\uE001';
      blocks.push(block);
      return marker;
    });
    let s = shield(String(input).replace(/\r\n?/g, '\n'));
    // Quando a interface imprime o label "Plain text" antes de um bloco ja
    // cercado, ele e apenas decoracao visual e nao faz parte da mensagem.
    s = s.replace(/(^|\n)[ \t]*Plain text(?=\s*\uE000MD\d+\uE001)/g, '$1');
    // Nas exportacoes HTML antigas, o widget exibe "Plain text`...`" em vez
    // de <pre>. Resgatamos inclusive blocos de uma linha e multiplos blocos
    // colados em uma mesma linha.
    s = s.replace(/Plain text`([^`]*)`/g, (_, raw) => fencedCode(raw, 'text'));
    s = shield(s);
    s = s.replace(/\n[ \t]+\n/g, '\n\n').replace(/\n{4,}/g, '\n\n\n').trim();
    return s.replace(/\uE000MD(\d+)\uE001/g, (_, index) => blocks[Number(index)]);
  }
  function topLevel(nodes) {
    const set = new Set(nodes);
    return nodes.filter((n) => {
      let p = n.parentElement;
      while (p) { if (set.has(p)) return false; p = p.parentElement; }
      return true;
    });
  }
  function renderContent(parts) { return normalize(parts.map((n) => md(n)).join('\n\n')); }
  function stableId(raw) {
    const parts = clean(raw).split(/[\s,;]+/).filter(Boolean);
    // So IDs com aparencia de UUID ou chaves longas: nunca usar 'fallback-turn-N'.
    return parts.find((x) => /^(?:[a-f0-9]{8}-[a-f0-9-]{24,}|[a-zA-Z0-9_-]{20,})$/.test(x)) || null;
  }
  function hashText(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function timeline() {
    const roots = qs(document, '[data-app-action-timeline-scroll][role="region"]')
      .filter((r) => !isRejected(r) && r.getBoundingClientRect().height > 40);
    return roots.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0] || null;
  }
  function findLegacyNodes() {
    const main = document.querySelector('main') || document;
    const roles = qs(main, '[data-message-author-role]')
      .filter((el) => !isRejected(el) && !el.parentElement?.closest('[data-message-author-role]'));
    if (roles.length) return roles;
    return qs(main, '[data-testid^="conversation-turn-"]')
      .filter((el) => !isRejected(el) && !el.parentElement?.closest('[data-testid^="conversation-turn-"]'));
  }
  function findNewNodes(root) {
    // Nova UI: unidade :user ou :assistant dentro da timeline visivel.
    const unitNodes = qs(root, '[data-content-search-unit-key]')
      .filter((el) => /:(?:user|assistant)$/.test(el.getAttribute('data-content-search-unit-key') || '')
        && !isRejected(el) && !el.parentElement?.closest('[data-content-search-unit-key]'));
    if (unitNodes.length) return unitNodes;
    // Fallback para builds que exponham somente bolhas/markdown.
    return qs(root, '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]')
      .filter((el) => !isRejected(el));
  }
  function layout() {
    const root = timeline();
    if (root) {
      const nodes = findNewNodes(root);
      if (nodes.length) return { mode: 'novo (Chat/Work)', nodes, root };
    }
    const old = findLegacyNodes();
    if (old.length) return { mode: 'classico', nodes: old, root: null };
    // Pode estar carregando: nao inventar mensagens a partir de todo o <main>.
    return { mode: root ? 'novo (carregando)' : 'nao reconhecido', nodes: [], root };
  }

  function readNew(node) {
    const unitKey = node.getAttribute('data-content-search-unit-key') || '';
    let role = unitKey.endsWith(':user') ? 'user' : unitKey.endsWith(':assistant') ? 'assistant' : null;
    if (!role) role = node.matches('[data-user-message-bubble]') ? 'user' : 'assistant';
    const turn = node.closest('[data-turn-key]');
    const parentMsg = node.closest('[data-chatgpt-search-message-ids]');
    const ownMsg = node.querySelector('[data-chatgpt-search-message-ids]');
    const messageId = stableId(node.getAttribute('data-chatgpt-search-message-ids'))
      || stableId(parentMsg?.getAttribute('data-chatgpt-search-message-ids'))
      || stableId(ownMsg?.getAttribute('data-chatgpt-search-message-ids'));
    const turnId = stableId(turn?.getAttribute('data-turn-key'));

    let body = [];
    if (role === 'user') {
      const bubble = node.matches('[data-user-message-bubble="true"]')
        ? node : node.querySelector('[data-user-message-bubble="true"]');
      body = [bubble || node];
    } else {
      const sections = qs(node, '[data-markdown-text-style="assistant-message"], .markdown, .prose')
        .filter((el) => !isRejected(el) && !el.closest('[data-user-message-bubble]'));
      body = topLevel(sections);
      if (!body.length) body = [node];
    }
    if (archive && !body.includes(node)) {
      // The new app shell may render uploaded media *outside* the user bubble
      // or assistant markdown block. Include only relevant media/card siblings.
      const extras = qs(node, 'img, a[download], a[data-download-url], button[data-testid*="file"], [data-testid*="file-attachment"]')
        .filter((el) => !isRejected(el) && !el.closest('[data-testid*="avatar"]')
          && !body.some((part) => part.contains(el)));
      body = topLevel([...body, ...extras]).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    }
    const content = renderContent(body);
    if (!content) return null;
    // O mesmo texto pode aparecer duas vezes: uma em sua resposta normal e
    // outra em um wrapper fallback. O ID da mensagem une as duas ocorrencias.
    const id = messageId || turnId;
    const key = id ? `${role}:${id}` : `${role}:hash:${hashText(content)}`;
    return { key, role, content, stable: Boolean(id), turnIndex: null };
  }

  function readOld(node) {
    const wrapper = node.matches('[data-testid^="conversation-turn-"]')
      ? node : node.closest('[data-testid^="conversation-turn-"]');
    const roleEl = node.matches('[data-message-author-role]') ? node : node.querySelector('[data-message-author-role]');
    const role = roleEl?.getAttribute('data-message-author-role') || wrapper?.getAttribute('data-turn') || 'unknown';
    const root = roleEl || node;
    const u = root.querySelector('[data-testid="user-message"], .whitespace-pre-wrap');
    const sections = topLevel(qs(root, '.markdown, .prose'));
    const content = renderContent(role === 'user' && u ? [u] : sections.length ? sections : [root]);
    if (!content) return null;
    const testId = wrapper?.getAttribute('data-testid') || '';
    const turnIndex = /conversation-turn-(\d+)/.test(testId) ? Number(testId.match(/conversation-turn-(\d+)/)[1]) : null;
    const messageId = stableId(roleEl?.getAttribute('data-message-id'))
      || stableId(root.closest('[data-message-id]')?.getAttribute('data-message-id'))
      || stableId(wrapper?.getAttribute('data-turn-id'));
    const id = messageId || (turnIndex !== null ? String(turnIndex) : null);
    const key = id ? `${role}:old:${id}` : `${role}:hash:${hashText(content)}`;
    return { key, role, content, stable: Boolean(id), turnIndex };
  }

  // Mescla a janela visivel com a ordem global, usando a sobreposicao entre
  // janelas. Sem indice no novo layout, o scroll determina a cronologia.
  function mergeOrder(keys, direction) {
    let i = 0;
    while (i < keys.length) {
      if (S.order.includes(keys[i])) { i++; continue; }
      const start = i;
      while (i < keys.length && !S.order.includes(keys[i])) i++;
      const missing = keys.slice(start, i);
      const following = keys.slice(i).find((k) => S.order.includes(k));
      const previous = keys.slice(0, start).reverse().find((k) => S.order.includes(k));
      if (following) S.order.splice(S.order.indexOf(following), 0, ...missing);
      else if (previous) S.order.splice(S.order.indexOf(previous) + 1, 0, ...missing);
      else if (direction === 'up') S.order.unshift(...missing);
      else S.order.push(...missing);
    }
  }

  function capture(direction = isAssisted()
    ? S.assistedDirection : (S.phase === 'Subindo' ? 'up' : 'down')) {
    const info = layout();
    const modeNew = info.mode.startsWith('novo');
    const parsed = [];
    let oldestNode = null;
    for (const node of info.nodes) {
      try {
        const m = modeNew ? readNew(node) : readOld(node);
        if (m) {
          parsed.push(m);
          oldestNode ||= node;
        }
      } catch (err) {
        if (S.errors.length < 10) S.errors.push(t('errorMessageParse', { error: String(err) }));
      }
    }
    if (parsed.length) S.mode = info.mode;
    let added = 0, updated = 0;
    const keys = [];
    for (const record of parsed) {
      const old = S.records.get(record.key);
      if (!old) {
        S.records.set(record.key, record);
        if (!record.stable) S.withoutStableKey++;
        added++;
      } else if (record.content.length > old.content.length) {
        S.records.set(record.key, record);
        updated++;
      }
      if (!keys.includes(record.key)) keys.push(record.key);
    }
    // If a new virtualized window has no known neighbor, directional order is
    // only a best effort. Count the discontinuity; never assert completeness.
    if ((isAssisted() || captureMode === 'native') && added && S.order.length &&
        !keys.some((key) => S.order.includes(key))) S.unanchoredWindows++;
    mergeOrder(keys, direction);
    return {
      added, updated, visible: parsed.length, root: info.root,
      oldestKey: keys[0] || null, newestKey: keys[keys.length - 1] || null,
      // Visual position within the oldest rendered message. This increases
      // when moving UP inside a long message, even without a new message key.
      // It is relative to the timeline, so opening DevTools does not by
      // itself change the semantic viewport fingerprint.
      oldestOffset: oldestNode && info.root
        ? Math.round(oldestNode.getBoundingClientRect().top -
                     info.root.getBoundingClientRect().top)
        : null
    };
  }

  function getRoot() {
    const appRoot = timeline();
    if (appRoot) return appRoot;
    const oldNode = findLegacyNodes()[0];
    for (let parent = oldNode?.parentElement; parent; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowY;
      if (/auto|scroll|overlay/.test(overflow) && parent.scrollHeight - parent.clientHeight > 40)
        return parent;
    }
    const page = document.scrollingElement || document.documentElement;
    if (page.scrollHeight - page.clientHeight > 40) return page;
    return null;
  }
  function maxScroll(root) { return Math.max(0, root.scrollHeight - root.clientHeight); }
  function toPosition(root, y) {
    const target = Math.max(0, Math.min(maxScroll(root), y));
    if (root === document.scrollingElement || root === document.documentElement) {
      window.scrollTo({ top: target, behavior: 'instant' });
    } else {
      root.scrollTop = target;
    }
  }
  function diagnostic() {
    return {
      legacyRoles: qs(document, '[data-message-author-role]').length,
      legacyTurns: qs(document, '[data-testid^="conversation-turn-"]').length,
      newTurns: qs(document, '[data-turn-key]').length,
      newUnits: qs(document, '[data-content-search-unit-key]').length,
      newBubbles: qs(document, '[data-user-message-bubble="true"]').length,
      newAssistantText: qs(document, '[data-markdown-text-style="assistant-message"]').length,
      visibleTimelines: qs(document, '[data-app-action-timeline-scroll][role="region"]').length,
      mainCount: qs(document, 'main').length
    };
  }
  function detectFailure() {
    const d = diagnostic();
    console.warn('[ThreadToMD]', t('diagnosticLabel'), d);
    return d;
  }

  const panel = document.createElement('div');
  panel.id = 'threadtomd-progress-panel';
  Object.assign(panel.style, {
    position: 'fixed', bottom: '16px', right: '16px', zIndex: 2147483647,
    padding: '14px', maxWidth: 'calc(100vw - 32px)', width: '320px',
    background: '#12231d', color: 'white', border: '1px solid #8eb4a5',
    borderRadius: '10px', boxShadow: '0 5px 24px #0006',
    font: '13px/1.5 system-ui, sans-serif'
  });
  panel.innerHTML = '<b id="threadtomd-progress-title"></b><div id="threadtomd-progress-status" style="margin-top:7px"></div>';
  panel.querySelector('#threadtomd-progress-title').textContent = t('panelTitle');
  const description = panel.querySelector('#threadtomd-progress-status');
  const stop = document.createElement('button');
  stop.textContent = t(captureMode === 'assisted' ? 'assistedFinish' : 'buttonStop');
  stop.type = 'button';
  Object.assign(stop.style, {
    marginTop: '9px', padding: '7px 10px', background: '#315b4d',
    color: '#fff', border: '1px solid #94b5aa', borderRadius: '5px', cursor: 'pointer'
  });
  function requestStop() {
    if (S.stopping) return;
    // Assisted Finish is a normal export. Do not cancel ZIP asset downloads.
    if (!isAssisted()) archive?.cancel();
    S.stopping = true;
    if (S.nativeBridge) { S.nativeBridge.close(); S.nativeBridge = null; }
    S.assistedResolve?.();
    wakeWaiters();
  }
  stop.addEventListener('click', requestStop);
  panel.appendChild(stop);
  document.body.appendChild(panel);

  function status(extra = '') {
    const human = S.paused ? t('phasePaused') : ({ 'Inicializando': t('phaseInitializing'), 'Aguardando mensagens': t('phaseWaiting'), 'Subindo': t('phaseOlder'), 'Descendo': t('phaseNewer'), 'Captura assistida': t('assistedPhase'), 'Exportando arquivo': t('phaseSaving'), 'Empacotando': t('phaseArchiving') })[S.phase] || S.phase;
    description.textContent = t('progressLine', { phase: human, count: S.records.size, steps: S.steps, layout: layoutLabel(S.mode), extra: extra ? ' | ' + extra : '' });
    if (archive) {
      const a = archive.summary();
      description.textContent += ' | ' + t('assetProgress', { saved: a.saved, total: a.total, missing: a.missing });
    }
    if (S.steps > 0 && S.steps % CFG.logEvery === 0 && S.steps !== S.lastLoggedStep) {
      S.lastLoggedStep = S.steps;
      console.info('[ChatGPT MD]', description.textContent);
    }
  }
  window.__chatgptMdExporter = {
    running: true, stop: requestStop,
    status() { return {
      fase: S.phase, mensagens: S.records.size, passos: S.steps,
      layout: S.mode, parar: S.stopping,
      limiteAntigo: S.olderEdge, sondas: S.olderProbes, pausado: S.paused,
      pausas: S.pauses, interrupcoesTimer: S.timingDisruptions, erros: [...S.errors],
      metodo: S.assistedFallback ? (S.nativeFallback ? 'native-assisted-fallback' : 'assisted-fallback') : captureMode,
      eventosNative: S.nativeWheelEvents, wheelTrusted: S.nativeTrustedWheel,
      reposicionamentosNative: S.nativeRebases,
      recuperacoesNative: S.nativeStallRecoveries,
      sondasInversasNative: S.nativeStallNudges,
      ciclosNative: S.nativeCycles,
      widgetsRemovidosNative: S.nativeWidgetSkips,
      widgetsRestauradosNative: S.nativeWidgetRestores,
      widgetsNaoConfirmadosNative: S.nativeWidgetSkipRejected,
      passosSemNovasMensagens: S.autoNoNovelSteps, saltosReversos: S.autoReverseJumps,
      eventosWheelAcima: S.assistedWheelUp,
      eventosWheelAbaixo: S.assistedWheelDown, janelasSemSobreposicao: S.unanchoredWindows
    }; },
    diagnostic
  };

  // Visibility and window focus are separate signals: another desktop app
  // may take focus without changing the document's visibility state.
  const activityEvents = [
    [document, 'visibilitychange'], [window, 'focus'], [window, 'blur'],
    [window, 'pageshow'], [document, 'freeze'], [document, 'resume']
  ];
  activityEvents.forEach(([target, name]) => target.addEventListener(name, updateActivity));
  updateActivity();

  function attachObserver(root) {
    S.observer?.disconnect();
    if (!root) return;
    S.observer = new MutationObserver(() => {
      if (S.updatePending || S.stopping) return;
      S.updatePending = true;
      queueMicrotask(() => {
        S.updatePending = false;
        try { capture(); } catch { /* captura principal tambem faz validacao */ }
      });
    });
    S.observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  // A scrollTop of zero may be only the oldest *loaded page*, not the
  // conversation's beginning. Keep probing the top and watching for older
  // batches; never equate a brief unchanged scrollHeight with completeness.
  function edgeMetrics(root, scan, direction) {
    return {
      count: S.records.size,
      height: maxScroll(root),
      key: direction < 0 ? scan.oldestKey : scan.newestKey
    };
  }
  function metricsChanged(a, b) {
    return a.count !== b.count || a.height !== b.height || a.key !== b.key;
  }
  function olderLoading(root) {
    // A loading indicator, when provided, is evidence to keep waiting.
    return Boolean(root.querySelector(
      '[aria-busy="true"], [data-testid*="loading-older"], [data-testid*="load-previous"], [data-state="loading"]'
    ));
  }
  async function probeOlder(root) {
    // Re-entering the top also retriggers scroll/IntersectionObserver loaders
    // that may not fire again while the scroll position remains pinned at 0.
    const travel = Math.min(maxScroll(root), Math.max(100, Math.floor(root.clientHeight * .25)));
    if (travel < 2) return capture('up');
    toPosition(root, travel);
    await sleep(CFG.stepDelay);
    const onWay = capture('up');
    await drainAssets();
    toPosition(root, 0);
    await sleep(CFG.edgeDelay);
    const back = capture('up');
    return {
      added: onWay.added + back.added,
      updated: onWay.updated + back.updated,
      oldestKey: back.oldestKey,
      newestKey: back.newestKey
    };
  }

  function activateAssistedFallback(direction) {
    if (S.assistedFallback) return;
    S.assistedFallback = true;
    S.partial = true;
    S.olderEdge = 'auto-scroll-cycle-assisted-fallback';
    S.assistedDirection = 'up';
    stop.textContent = t('assistedFinish');
    S.errors.push(t('autoFallbackWarning'));
    console.warn('[ThreadToMD]', t('autoFallbackWarning'), {
      direction: direction < 0 ? 'older' : 'newer',
      captured: S.records.size,
      staleSteps: S.autoNoNovelSteps,
      reverseJumps: S.autoReverseJumps
    });
    status(t('autoFallbackInstructions'));
  }

  async function scanDirection(direction) {
    S.phase = direction < 0 ? 'Subindo' : 'Descendo';
    let edge = null, noProgress = 0, staleSteps = 0, reverseJumps = 0, seenEpoch = S.resumeEpoch;
    for (let n = 0; n < CFG.maxStepsPerDirection; n++) {
      await waitForForeground();
      if (seenEpoch !== S.resumeEpoch) {
        seenEpoch = S.resumeEpoch;
        edge = null;
        noProgress = 0;
        staleSteps = 0;
        reverseJumps = 0;
      }
      if (S.stopping) { S.partial = true; return; }
      const root = getRoot();
      if (!root) {
        S.errors.push(t('errorNoScroll'));
        S.partial = true;
        return;
      }
      if (S.root !== root) { S.root = root; attachObserver(root); edge = null; }
      const beforeScan = capture(direction < 0 ? 'up' : 'down');
      // Fetch transient blob: URLs while their containing message remains in DOM.
      await drainAssets();
      if (seenEpoch !== S.resumeEpoch) continue;
      const before = root.scrollTop;
      const max = maxScroll(root);
      const atEdge = direction < 0 ? before <= 3 : before >= max - 3;
      if (!atEdge) {
        edge = null;
        const step = Math.max(110, Math.floor(root.clientHeight * CFG.stepRatio));
        toPosition(root, before + direction * step);
        S.steps++;
        await sleep(CFG.stepDelay);
        if (seenEpoch !== S.resumeEpoch) continue;
        const after = capture(direction < 0 ? 'up' : 'down');
        await drainAssets();
        if (seenEpoch !== S.resumeEpoch) continue;
        // The virtualizer can bounce scrollTop to the end of the currently
        // mounted window without revealing any new messages. Pixel movement
        // alone is NOT progress: repeated reverse jumps must not reset the
        // automatic scan watchdog. This is a safe handoff, not an assertion
        // that we reached the oldest or newest conversation message.
        const fresh = after.added > 0 || after.updated > 0;
        const reverseJump = direction < 0
          ? root.scrollTop > before + Math.max(140, root.clientHeight * 0.30)
          : root.scrollTop < before - Math.max(140, root.clientHeight * 0.30);
        if (fresh) {
          staleSteps = 0;
          reverseJumps = 0;
          noProgress = 0;
        } else {
          staleSteps++;
          if (reverseJump) reverseJumps++;
          noProgress = Math.abs(root.scrollTop - before) < 2 ? noProgress + 1 : 0;
        }
        S.autoNoNovelSteps = staleSteps;
        S.autoReverseJumps = reverseJumps;
        if ((staleSteps >= CFG.autoLoopMinStaleSteps &&
             reverseJumps >= CFG.autoLoopReverseLimit) ||
            staleSteps >= CFG.autoLoopMaxStaleSteps) {
          activateAssistedFallback(direction);
          return;
        }
        if (noProgress >= 15) {
          // Old-fashioned constant-position stalls are also recoverable by
          // manual scrolling: do not save a misleading partial file yet.
          activateAssistedFallback(direction);
          return;
        }
        if (S.steps % 5 === 0) status();
        continue;
      }

      noProgress = 0;
      staleSteps = 0;
      reverseJumps = 0;
      S.autoNoNovelSteps = 0;
      S.autoReverseJumps = 0;
      const now = Date.now();
      if (!edge) edge = {
        startedAt: now, lastChangeAt: now, lastProbeAt: now, probes: 0,
        metrics: edgeMetrics(root, beforeScan, direction)
      };
      toPosition(root, direction < 0 ? 0 : max);
      await sleep(CFG.edgeDelay);
      if (seenEpoch !== S.resumeEpoch) continue;
      const scan = capture(direction < 0 ? 'up' : 'down');
      await drainAssets();
      if (seenEpoch !== S.resumeEpoch) continue;
      const metrics = edgeMetrics(root, scan, direction);
      const stillEdge = direction < 0
        ? root.scrollTop <= 3 : root.scrollTop >= maxScroll(root) - 3;
      if (!stillEdge || scan.added || scan.updated || metricsChanged(edge.metrics, metrics)) {
        edge.lastChangeAt = Date.now();
        edge.startedAt = edge.lastChangeAt;
        edge.metrics = metrics;
        if (!stillEdge) { edge = null; continue; }
      }
      if (direction < 0) {
        const elapsed = Date.now() - edge.lastChangeAt;
        if (Date.now() - edge.lastProbeAt >= CFG.olderProbeIntervalMs) {
          const probe = await probeOlder(root);
          if (seenEpoch !== S.resumeEpoch) continue;
          edge.probes++;
          S.olderProbes++;
          edge.lastProbeAt = Date.now();
          const afterMetrics = edgeMetrics(root, probe, direction);
          if (probe.added || probe.updated || metricsChanged(edge.metrics, afterMetrics)) {
            edge.lastChangeAt = Date.now();
            edge.startedAt = edge.lastChangeAt;
            edge.metrics = afterMetrics;
          }
          if (root.scrollTop > 3) { edge = null; continue; }
        }
        const quiet = Date.now() - edge.lastChangeAt;
        const loading = olderLoading(root);
        status(t('olderProbe', { quiet: Math.floor(quiet / 1000), limit: CFG.olderQuietMs / 1000, probes: edge.probes, loading: loading ? t('loadingSuffix') : '' }));
        if (quiet >= CFG.olderQuietMs && edge.probes >= CFG.olderMinProbes && !loading) {
          // This is a best-effort boundary, not proof that we saw turn #1.
          S.olderEdge = 'stabilized-heuristic';
          return;
        }
        if (Date.now() - edge.startedAt >= CFG.olderMaxWaitMs) {
          S.olderEdge = 'timed-out';
          S.partial = true;
          S.errors.push(t('errorOlderTimeout'));
          return;
        }
      } else {
        const quiet = Date.now() - edge.lastChangeAt;
        status(t('newerProbe', { quiet: Math.floor(quiet / 1000), limit: CFG.newerQuietMs / 1000 }));
        if (quiet >= CFG.newerQuietMs) return;
      }
    }
    S.partial = true;
    S.errors.push(t('errorStepLimit', { limit: CFG.maxStepsPerDirection }));
  }

  // Loop-only mitigation: detach a single *already captured* nested code
  // scroll widget. This is intentionally separate from navigation: nativeWheel,
  // wheelPoint, edge probing, timings and bounded recovery are v0.2.4.10.
  function detachCapturedScrollWidget(root) {
    if (captureMode !== 'native' || S.phase !== 'Subindo' || S.stopping ||
        !root?.isConnected || S.nativeRemovedWidgets.length >= CFG.nativeMaxWidgetRemovals)
      return false;
    const snapshot = layout();
    if (snapshot.root !== root || !snapshot.nodes.length) return false;
    const frame = root.getBoundingClientRect();
    let best = null;
    for (const widget of qs(root, '[data-client-defined-widget="code_block"]')) {
      if (!widget.isConnected || !widget.querySelector('pre')) continue;
      const box = widget.getBoundingClientRect();
      const overlap = Math.min(box.bottom, frame.bottom) - Math.max(box.top, frame.top);
      if (overlap < 30) continue;
      // Require actual vertical scroll; e.g. overflow-x-hidden can compute
      // overflow-y:auto but the box may not be vertically scrollable.
      const hasNestedScroll = [widget, ...qs(widget, '*')].some((el) => {
        const css = getComputedStyle(el);
        return /auto|scroll|overlay/.test(css.overflowY) &&
          el.scrollHeight - el.clientHeight >= CFG.nativeScrollableMinPixels;
      });
      if (!hasNestedScroll) continue;
      const owner = snapshot.nodes.find((node) => node.contains(widget));
      if (!owner) continue;
      const message = snapshot.mode.startsWith('novo') ? readNew(owner) : readOld(owner);
      const stored = message?.stable ? S.records.get(message.key) : null;
      // Never remove a message or code block merely because it looks familiar;
      // the exact canonical Markdown must already be in memory, unchanged.
      if (!stored || stored.content !== message.content ||
          S.nativeRemovedOwners.has(message.key)) {
        S.nativeWidgetSkipRejected++;
        continue;
      }
      const midpoint = (box.top + box.bottom) / 2;
      const viewportMidpoint = (frame.top + frame.bottom) / 2;
      const score = overlap - Math.abs(midpoint - viewportMidpoint) * .1;
      if (!best || score > best.score) best = { widget, key: message.key, score };
    }
    if (!best) return false;
    const marker = document.createComment('ThreadToMD: detached captured scroll widget');
    best.widget.replaceWith(marker);
    S.nativeRemovedWidgets.push({ marker, widget: best.widget });
    S.nativeRemovedOwners.add(best.key);
    S.nativeWidgetSkips++;
    // Numeric-only reporting; never log the code, message text or IDs.
    console.warn('[ThreadToMD] Captured scroll widget detached after confirmed native loop',
      { detachedCount: S.nativeWidgetSkips });
    return true;
  }

  function restoreCapturedScrollWidgets() {
    for (const { marker, widget } of [...S.nativeRemovedWidgets].reverse()) {
      if (marker.isConnected && !widget.isConnected) {
        marker.replaceWith(widget);
        S.nativeWidgetRestores++;
      }
    }
    S.nativeRemovedWidgets.length = 0;
  }

  // Chrome Native Wheel: same trusted browser-input command and wheel geometry
  // validated in the separate In-Tab Lab. No scrollTop writes in this path.
  // The privileged transport lives in the worker and is limited to this tab.
  function wheelPoint(root, variant = 0) {
    const rect = root.getBoundingClientRect();
    // Keep the original lab targets for unobstructed timelines. Long code
    // blocks can cover all seven targets, however, and absorb trusted wheel
    // events in their own scrollbars. Sample narrow *timeline* gutters too.
    const candidates = [
      [rect.right - 26, rect.top + rect.height * .39],
      [rect.left + rect.width * .77, rect.top + rect.height * .39],
      [rect.left + rect.width * .50, rect.top + rect.height * .58],
      [rect.left + rect.width * .29, rect.top + rect.height * .26],
      [rect.left + rect.width * .63, rect.top + rect.height * .21],
      [rect.left + rect.width * .80, rect.top + rect.height * .72],
      [rect.left + rect.width * .36, rect.top + rect.height * .69]
    ];
    // Offsets are CSS pixels *inside* the timeline, not window coordinates.
    // Both sides are checked since an overlay/scrollbar may occupy one side.
    for (const yFraction of [.50, .26, .73, .10, .89]) {
      for (const offset of [12, 20, 7]) {
        candidates.push([rect.left + offset, rect.top + rect.height * yFraction]);
        candidates.push([rect.right - offset, rect.top + rect.height * yFraction]);
      }
    }
    for (let k = 0; k < candidates.length; k++) {
      const [cx, cy] = candidates[(k + variant * 7) % candidates.length];
      const x = Math.round(cx), y = Math.round(cy);
      if (x <= 0 || x >= innerWidth - 1 || y <= 0 || y >= innerHeight - 1 ||
          x <= rect.left + 2 || x >= rect.right - 2 ||
          y <= rect.top + 2 || y >= rect.bottom - 2) continue;
      let target = document.elementFromPoint(x, y);
      if (!target || !root.contains(target) || isFromPanel(target)) continue;
      // Shadow-root descendants can scroll even when the visible host does not.
      while (target.shadowRoot?.elementFromPoint?.(x, y)) {
        const inner = target.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === target) break;
        target = inner;
      }
      let intercepted = false;
      for (let el = target; el && el !== root;
           el = el.parentElement || el.getRootNode?.().host || null) {
        const css = getComputedStyle(el);
        if (el.tagName === 'IFRAME' ||
            (/auto|scroll|overlay/.test(css.overflowY) &&
             el.scrollHeight - el.clientHeight > 3)) {
          intercepted = true;
          break;
        }
      }
      if (!intercepted) return { x, y };
    }
    // Never send privileged wheel input into an unrelated overlay or a
    // nested scrollbox just because no suitable point was found.
    return null;
  }

  function connectNativeWheel() {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime?.connect) {
        reject(new Error(t('nativeUnavailable')));
        return;
      }
      let port;
      try { port = chrome.runtime.connect({ name: 'threadtomd-native-wheel-v1' }); }
      catch (error) { reject(error); return; }
      let opened = false;
      let closed = false;
      let nextId = 0;
      let pending = null;
      const fail = (error) => {
        if (pending) {
          clearTimeout(pending.timer);
          pending.reject(error);
          pending = null;
        }
        if (!opened) reject(error);
      };
      const bridge = {
        get closed() { return closed; },
        wheel(direction, pixels, point) {
          if (closed) return Promise.reject(new Error('Native wheel connection closed'));
          if (pending) return Promise.reject(new Error('Native wheel command already pending'));
          return new Promise((resolveWheel, rejectWheel) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
              fail(new Error('Native wheel command timed out'));
              bridge.close();
            }, 6500);
            pending = { id, resolve: resolveWheel, reject: rejectWheel, timer };
            try {
              port.postMessage({
                type: 'wheel', id, direction, pixels,
                x: point.x, y: point.y
              });
            } catch (error) {
              fail(error);
              bridge.close();
            }
          });
        },
        close() {
          if (closed) return;
          closed = true;
          clearTimeout(openTimeout);
          fail(new Error('Native wheel session closed'));
          try { port.postMessage({ type: 'close' }); } catch { /* ignored */ }
          try { port.disconnect(); } catch { /* ignored */ }
        }
      };
      const openTimeout = setTimeout(() => {
        fail(new Error('Native wheel attach timed out'));
        bridge.close();
      }, 8000);
      port.onMessage.addListener((message) => {
        if (closed) return;
        if (message?.type === 'ready') {
          opened = true;
          clearTimeout(openTimeout);
          resolve(bridge);
        } else if (message?.type === 'wheel-ok' && pending?.id === message.id) {
          const p = pending;
          pending = null;
          clearTimeout(p.timer);
          p.resolve();
        } else if (message?.type === 'error' || message?.type === 'stopped') {
          fail(new Error(message.message || message.reason || 'Native wheel interrupted'));
          bridge.close();
        }
      });
      port.onDisconnect.addListener(() => {
        if (closed) return;
        fail(new Error(chrome.runtime.lastError?.message || 'Native wheel debugger detached'));
        bridge.close();
      });
    });
  }

  async function nativeWheel(direction, root, step, variant = S.nativeWheelTarget, pixels = CFG.nativeWheelPixels) {
    await waitForForeground();
    if (S.stopping) return false;
    if (!S.nativeBridge || S.nativeBridge.closed) {
      S.nativeBridge = await connectNativeWheel();
    }
    const point = wheelPoint(root, variant);
    if (!point) throw new Error('No unobstructed wheel target inside the conversation');
    try {
      await S.nativeBridge.wheel(direction, pixels, point);
    } catch (error) {
      if (S.stopping) return false;
      // A switch away from the tab detaches the debugger by policy; reconnect
      // on the next foreground pass instead of treating that as export failure.
      if (!isForeground()) {
        if (S.nativeBridge) S.nativeBridge.close();
        S.nativeBridge = null;
        return false;
      }
      throw error;
    }
    S.steps++;
    S.nativeWheelEvents++;
    await sleep(CFG.nativeWheelIntervalMs);
    return !S.stopping;
  }

  async function recoverNativeStall(direction, root, attempt) {
    S.nativeStallRecoveries++;
    // Normal traversal remains the lab-proven 160 px / 110 ms. Only a
    // demonstrably stalled region gets larger, bounded trusted-wheel nudges.
    // Every input is followed by a DOM capture to avoid skipping ephemeral
    // virtualized messages. No scrollTop writes or synthetic WheelEvents.
    const reversePixels = [0, 240, 320, 480][attempt - 1];
    const forwardPixels = [320, 480, 600, 600][attempt - 1];
    S.nativeWheelTarget = attempt;
    status(t('nativeRecovery', {
      attempt, limit: CFG.nativeStallRecoveryLimit
    }));
    await sleep(CFG.nativeStallRecoveryWaitMs[attempt - 1]);
    if (S.stopping) return;
    capture(direction < 0 ? 'up' : 'down');
    await drainAssets();
    // The virtualizer can replace the timeline while a recovery waits.
    if ((timeline() || getRoot()) !== root) return;
    if (reversePixels) {
      S.nativeStallNudges++;
      if (!await nativeWheel(-direction, root, -1, attempt, reversePixels)) return;
      capture(direction < 0 ? 'down' : 'up');
      await drainAssets();
      await sleep(350);
    }
    if (!S.stopping && (timeline() || getRoot()) === root &&
        await nativeWheel(direction, root, -1, attempt + 1, forwardPixels)) {
      capture(direction < 0 ? 'up' : 'down');
      await drainAssets();
    }
  }

  function nativeAssistedFallback(reason) {
    if (S.assistedFallback) return;
    S.assistedFallback = true;
    S.nativeFallback = true;
    S.partial = true;
    S.olderEdge = 'native-wheel-interrupted-assisted-fallback';
    S.assistedDirection = 'up';
    if (S.nativeBridge) { S.nativeBridge.close(); S.nativeBridge = null; }
    stop.textContent = t('assistedFinish');
    const summary = String(reason?.message || reason).slice(0, 180);
    S.errors.push(t('nativeFallbackWarning', { reason: summary }));
    console.warn('[ThreadToMD]', t('nativeFallbackWarning', { reason: summary }));
    status(t('nativeFallbackInstructions'));
  }

  async function scanNativeDirection(direction) {
    S.phase = direction < 0 ? 'Subindo' : 'Descendo';
    let edge = null, noMotion = 0, noNovel = 0, stallAttempts = 0;
    let staleEndRebases = 0;
    // Track repeated *visible* regions rather than scrollTop deltas. A long
    // message can be traversed for hundreds of events without discovering a
    // new turn, so a simple no-new-message timeout would be incorrect.
    const viewportVisits = new Map();
    let lastEpoch = S.resumeEpoch;
    const sourcePath = S.nativeSourcePath;
    let missingRootSince = null;
    const onWheel = (event) => {
      if (event.isTrusted && S.root &&
          (event.composedPath?.().includes(S.root) || S.root.contains(event.target))) {
        S.nativeTrustedWheel++;
      }
    };
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    try {
      for (let n = 0; n < CFG.maxStepsPerDirection && !S.stopping; n++) {
        await waitForForeground();
        if (S.stopping) break;
        if (sourcePath !== location.origin + location.pathname)
          throw new Error(t('assistedConversationChanged'));
        if (lastEpoch !== S.resumeEpoch) {
          lastEpoch = S.resumeEpoch;
          edge = null; noMotion = 0; noNovel = 0;
          stallAttempts = 0; staleEndRebases = 0; S.nativeWheelTarget = 0;
          viewportVisits.clear();
        }
        // Avoid misidentifying the page scrollbar as the timeline during
        // temporary Chat/Work virtualizer unmounts.
        const root = S.mode.startsWith('novo') ? timeline() : getRoot();
        if (!root) {
          missingRootSince ??= Date.now();
          if (Date.now() - missingRootSince > 12000) throw new Error(t('errorNoScroll'));
          await sleep(160);
          continue;
        }
        missingRootSince = null;
        if (S.root !== root) {
          S.root = root; attachObserver(root); edge = null;
          noMotion = 0; stallAttempts = 0; staleEndRebases = 0; S.nativeWheelTarget = 0;
          viewportVisits.clear();
        }
        const beforeScan = capture(direction < 0 ? 'up' : 'down');
        if (direction > 0 && S.nativeReturnAnchor &&
            [beforeScan.oldestKey, beforeScan.newestKey].includes(S.nativeReturnAnchor)) {
          S.nativeReturnAnchorFound = true;
        }
        // Timely asset draining is critical for short-lived blob URLs.
        if (n % 4 === 0) await drainAssets();
        if (S.stopping) break;
        const before = root.scrollTop;
        const beforeHeight = maxScroll(root);
        const keyBefore = direction < 0 ? beforeScan.oldestKey : beforeScan.newestKey;
        const moved = await nativeWheel(direction, root, n);
        if (!moved) continue;
        const afterScan = capture(direction < 0 ? 'up' : 'down');
        if (direction > 0 && S.nativeReturnAnchor &&
            [afterScan.oldestKey, afterScan.newestKey].includes(S.nativeReturnAnchor)) {
          S.nativeReturnAnchorFound = true;
        }
        if (n % 4 === 0) await drainAssets();
        if (S.stopping) break;
        const after = root.scrollTop;
        const height = maxScroll(root);
        const rebased = direction < 0
          ? after > before + Math.max(450, root.clientHeight * 0.45)
          : after < before - Math.max(450, root.clientHeight * 0.45);
        if (rebased) S.nativeRebases++;
        const newContent = Boolean(afterScan.added || afterScan.updated);
        const changed = newContent || beforeHeight !== height ||
          keyBefore !== (direction < 0 ? afterScan.oldestKey : afterScan.newestKey);
        noNovel = changed ? 0 : noNovel + 1;
        if (newContent) {
          // This is real discovery, unlike numeric changes to scrollTop/height.
          stallAttempts = 0;
          staleEndRebases = 0;
          S.nativeWheelTarget = 0;
          viewportVisits.clear();
        } else if (direction < 0 && rebased &&
                   before < beforeHeight - root.clientHeight * 2 &&
                   after >= height - root.clientHeight * 2) {
          // Repeated near-bottom jumps without discovering a new turn are a
          // loop, even though the scroll bar moves by thousands of pixels.
          staleEndRebases++;
        }
        const isEdge = direction < 0 ? after <= 3 : after >= height - 3;
        if (!isEdge) {
          edge = null;
          const stationary = Math.abs(after - before) < 2 && !changed;
          noMotion = stationary ? noMotion + 1 : 0;
          let repeatedViewport = false;
          if (direction < 0 && !newContent &&
              n % CFG.nativeCycleSampleEvery === 0 &&
              afterScan.oldestKey && Number.isFinite(afterScan.oldestOffset)) {
            // A viewport signature includes the oldest rendered unit AND its
            // screen-relative position. Genuine scrolling inside a very long
            // message moves this offset; bouncing over the same content
            // revisits the same coarse offset. Height and scrollTop are
            // intentionally omitted because the virtualizer rebases both.
            const bucket = Math.round(afterScan.oldestOffset / 120);
            const signature = `${afterScan.oldestKey}|${afterScan.newestKey}|${bucket}`;
            let visit = viewportVisits.get(signature);
            if (!visit) {
              visit = { first: n, last: n, hits: 1 };
              viewportVisits.set(signature, visit);
              if (viewportVisits.size > 160)
                viewportVisits.delete(viewportVisits.keys().next().value);
            } else if (n - visit.last >= CFG.nativeCycleSampleEvery) {
              visit.hits++;
              visit.last = n;
              repeatedViewport = visit.hits >= CFG.nativeCycleRepeatThreshold &&
                n - visit.first >= CFG.nativeCycleMinSpan;
            }
          }
          if (noMotion >= CFG.nativeNonEdgeStallLimit ||
              (direction < 0 && staleEndRebases >= 3) || repeatedViewport) {
            if (repeatedViewport) S.nativeCycles++;
            // ONE new hook in the unmodified v0.2.4.10 native state machine:
            // only after its existing loop/stall detector fires, retain the
            // full message and accessible ZIP assets before DOM detachment.
            if (direction < 0 && S.nativeRemovedWidgets.length < CFG.nativeMaxWidgetRemovals) {
              capture('up');
              await drainAssets();
              if (detachCapturedScrollWidget(root)) {
                // Count this as a bounded recovery attempt, not new progress.
                // Otherwise the original manual fallback might never fire.
                stallAttempts++;
                edge = null;
                noMotion = 0;
                staleEndRebases = 0;
                viewportVisits.clear();
                continue;
              }
            }
            if (stallAttempts >= CFG.nativeStallRecoveryLimit) {
              throw new Error('Native wheel remained stalled, rebased, or revisited the same viewport after bounded recovery');
            }
            stallAttempts++;
            const recoveredFromCount = S.records.size;
            await recoverNativeStall(direction, root, stallAttempts);
            // Recovery itself captures transient messages. That is genuine
            // progress even if the next normal scan sees no new DOM nodes.
            if (S.records.size > recoveredFromCount) stallAttempts = 0;
            noMotion = 0;
            staleEndRebases = 0;
            edge = null;
            viewportVisits.clear();
            // The observer may have remounted the timeline while we waited.
            // Re-evaluate the current root before issuing the next wheel.
            continue;
          }
          if (noNovel > 2400 && S.nativeRebases >= 4) {
            throw new Error('Native wheel repeated without discovering older content');
          }
        } else {
          noMotion = 0;
          viewportVisits.clear();
          if (newContent) stallAttempts = 0;
          S.nativeWheelTarget = 0;
          const now = Date.now();
          const signature = { count: S.records.size, height, key: direction < 0 ? afterScan.oldestKey : afterScan.newestKey };
          if (!edge) {
            edge = { since: now, changedAt: now, lastProbe: now, probes: 0, signature };
          } else if (changed || metricsChanged(edge.signature, signature)) {
            edge.changedAt = now;
            edge.signature = signature;
          }
          if (direction < 0) {
            if (now - edge.lastProbe >= CFG.olderProbeIntervalMs) {
              edge.lastProbe = now;
              edge.probes++;
              S.olderProbes++;
            }
            const quiet = now - edge.changedAt;
            if (quiet >= CFG.olderQuietMs && edge.probes >= CFG.olderMinProbes && !olderLoading(root)) {
              S.olderEdge = 'native-wheel-stabilized-heuristic';
              return;
            }
            if (now - edge.since >= CFG.olderMaxWaitMs) {
              throw new Error(t('errorOlderTimeout'));
            }
            if (S.steps % 25 === 0) status(t('olderProbe', {
              quiet: Math.floor(quiet / 1000), limit: CFG.olderQuietMs / 1000,
              probes: edge.probes, loading: olderLoading(root) ? t('loadingSuffix') : ''
            }));
          } else {
            const quiet = now - edge.changedAt;
            // At a virtualized edge, a single maxScroll observation does not
            // prove the original newest turn has been revisited.
            if (quiet >= CFG.newerQuietMs &&
                (!S.nativeReturnAnchor || S.nativeReturnAnchorFound)) return;
            if (quiet >= 25000 && S.nativeReturnAnchor && !S.nativeReturnAnchorFound) {
              throw new Error('Newest message from the starting window was not found');
            }
          }
        }
        if (S.steps % 10 === 0) status(t('nativeStatus', {
          trusted: S.nativeTrustedWheel, rebase: S.nativeRebases
        }));
      }
      if (S.stopping) { S.partial = true; return; }
      throw new Error(t('errorStepLimit', { limit: CFG.maxStepsPerDirection }));
    } finally {
      document.removeEventListener('wheel', onWheel, true);
    }
  }

  async function scanNative() {
    try {
      // The popup must close before Chrome directs user input to the page.
      await waitForForeground();
      await sleep(800);
      S.nativeSourcePath = location.origin + location.pathname;
      S.nativeReturnAnchor = capture('up').newestKey;
      await scanNativeDirection(-1);
      if (!S.stopping) await scanNativeDirection(1);
    } catch (error) {
      if (!S.stopping) nativeAssistedFallback(error);
    } finally {
      if (S.nativeBridge) { S.nativeBridge.close(); S.nativeBridge = null; }
    }
  }

  function filename(str) {
    return clean(str).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').slice(0, 64) || t('fileSlugFallback');
  }
  function makeFile() {
    const title = (document.title || t('fileUntitled')).replace(/\s*[-|]\s*ChatGPT(?: Work)?\s*$/i, '').trim();
    const data = S.order.map((k) => S.records.get(k)).filter(Boolean);
    const headers = [
      `# ${title || t('fileUntitled')}`, '',
      `- ${t('fileSource')}: ${location.href}`,
      `- ${t('fileExported')}: ${new Date().toISOString()}`,
      `- ${t('fileExporter')}: ThreadToMD 0.2.4.16 (engine V${VERSION})`,
      `- ${t('fileLayout')}: ${layoutLabel(S.mode)}`,
      `- ${t('fileCount')}: ${data.length}`,
      `- ${t('fileStatus')}: ${S.partial ? t('filePartialStatus') : t('fileDoneStatus')}`,
      `- ${t('fileUpperBoundary')}: ${S.olderEdge}; ${t('fileReloadProbes')}: ${S.olderProbes}`, '',
      `> ${t(archive ? 'fileArchiveNote' : 'fileNote')}`, ''
    ];
    if (archive) {
      const a = archive.summary();
      headers.push(`- ${t('fileArchiveAssets')}: ${a.saved}/${a.total} (${a.missing} ${t('fileArchiveUnavailable')}; ${t('fileArchiveOverLimit', { count: a.overflow })})`, '');
    }
    if (isAssisted()) {
      const fallbackMethod = S.nativeFallback ? 'fileNativeFallbackMethod' : 'fileFallbackMethod';
      const fallbackWarning = S.nativeFallback ? 'fileNativeFallbackWarning' : 'fileFallbackWarning';
      headers.push(`- ${t('fileCaptureMethod')}: ${t(S.assistedFallback ? fallbackMethod : 'fileAssistedMethod')}`, '');
      headers.push(`> ${t(S.assistedFallback ? fallbackWarning : 'fileAssistedWarning')}`, '');
      if (S.unanchoredWindows) headers.push(`> ${t('fileUnanchoredWindows', { count: S.unanchoredWindows })}`, '');
    }
    if (captureMode === 'native' && !isAssisted()) {
      headers.push(`- ${t('fileCaptureMethod')}: ${t('fileNativeMethod')}`, '');
      headers.push(`> ${t('fileNativeWarning')}`, '');
      if (S.unanchoredWindows) headers.push(`> ${t('fileUnanchoredWindows', { count: S.unanchoredWindows })}`, '');
    }
    if (!S.partial) headers.push(`> ${t('fileIntegrity')}`, '');
    if (S.withoutStableKey) headers.push(`> ${t('fileUnstableIds', { count: S.withoutStableKey })}`, '');
    if (S.errors.length) headers.push(`> ${t('fileWarnings', { errors: S.errors.join(' | ').replace(/\n/g, ' ') })}`, '');
    data.forEach((m, i) => {
      const label = ({ user: t('roleUser'), assistant: t('roleAssistant'), system: t('roleSystem'), tool: t('roleTool') }[m.role] || t('roleMessage'));
      headers.push(`## ${i + 1}. ${label}`, '', archive ? archive.rewrite(m.content) : m.content, '');
    });
    // The conversation title may be in a different language from the UI.
    // Use the selected locale for download names and retain the original
    // title only inside the Markdown document itself.
    const time = new Date().toISOString().replace(/[-:]/g, '').replace(/T(\d{6})\.\d+Z$/, '-$1');
    const name = filename(t('fileSlugFallback')) + '-' + time + '.md';
    return { name, body: headers.join('\n') + '\n', count: data.length };
  }

  async function save() {
    await waitForForeground();
    await drainAssets();
    await waitForForeground();
    const { name, body, count } = makeFile();
    if (!count) return 0;
    const finalName = archive ? name.replace(/\.md$/i, '.zip') : name;
    const blob = archive
      ? archive.package(body, {
        source: location.href, messages: count,
        scanStatus: S.partial ? 'partial' : 'stabilized-not-independently-verified',
        upperBoundary: S.olderEdge
      })
      : new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    console.info(t('consoleSaved', { count, name: finalName }));
    return count;
  }

  // Experimental assisted capture: observe natural DOM churn while the user
  // navigates. Never write scrollTop or synthesize mouse events in this mode.
  // A detached/replaced timeline is rediscovered by the heartbeat. The
  // MutationObserver captures newly mounted turns before virtualization evicts
  // them; periodic and scroll sampling are additional best-effort safeguards.
  async function captureAssisted() {
    S.phase = 'Captura assistida';
    S.partial = true;
    if (!S.assistedFallback) S.olderEdge = 'assisted-user-scrolled-unverified';
    const sourcePath = location.origin + location.pathname;
    let lastStatusAt = -Infinity;
    let scheduled = false;
    let lastSampleAt = 0;

    function assistedRoot() {
      // A transiently missing Chat/Work timeline must not be replaced by an
      // unrelated document scrollbar (getRoot's legacy fallback).
      return S.mode.startsWith('novo') ? timeline() : getRoot();
    }
    function sample() {
      if (S.stopping) return;
      if (location.origin + location.pathname !== sourcePath) {
        S.errors.push(t('assistedConversationChanged'));
        requestStop();
        return;
      }
      const root = assistedRoot();
      if (!root) return; // The virtualized root can disappear briefly.
      if (S.root !== root) {
        S.root = root;
        attachObserver(root);
      }
      const result = capture(S.assistedDirection);
      const now = performance.now();
      if (result.added || result.updated || now - lastStatusAt > 1200) {
        const instructions = t('assistedInstructions', { up: S.assistedWheelUp, down: S.assistedWheelDown });
        status(S.assistedFallback ? `${t('autoFallbackInstructions')} | ${instructions}` : instructions);
        lastStatusAt = now;
      }
    }
    function scheduleSample() {
      if (S.stopping || scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (S.stopping) return;
        const now = performance.now();
        if (now - lastSampleAt < 65) return;
        lastSampleAt = now;
        sample();
      });
    }
    function onWheel(event) {
      if (!event.isTrusted || !event.deltaY || !S.root ||
          !(event.composedPath?.().includes(S.root) || S.root.contains(event.target))) return;
      S.assistedDirection = event.deltaY < 0 ? 'up' : 'down';
      if (event.deltaY < 0) S.assistedWheelUp++;
      else S.assistedWheelDown++;
      S.steps++;
      scheduleSample();
    }
    function onScroll(event) {
      if (event.target === S.root) scheduleSample();
    }
    function onKeyDown(event) {
      if (!event.isTrusted || !S.root) return;
      if (!S.root.contains(event.target) && event.target !== document.body) return;
      if (['PageUp', 'ArrowUp', 'Home'].includes(event.key)) S.assistedDirection = 'up';
      else if (['PageDown', 'ArrowDown', 'End', ' '].includes(event.key)) S.assistedDirection = 'down';
    }
    const root = assistedRoot();
    if (!root) throw new Error(t('errorNoScroll'));
    S.root = root;
    attachObserver(root);
    sample();
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown, true);
    const rootWatcher = new MutationObserver(() => {
      if (!S.root?.isConnected) scheduleSample();
    });
    rootWatcher.observe(document.body, { childList: true, subtree: true });
    const heartbeat = setInterval(sample, 400);
    try {
      if (!S.stopping) await new Promise((resolve) => { S.assistedResolve = resolve; });
    } finally {
      // Flush the last rendered window before detaching; no more callbacks
      // are allowed to modify order after Save starts.
      if (S.root) capture(S.assistedDirection);
      clearInterval(heartbeat);
      rootWatcher.disconnect();
      document.removeEventListener('wheel', onWheel, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown, true);
      S.assistedResolve = null;
    }
  }

  try {
    // O novo app-shell pode montar a timeline antes de montar as mensagens.
    let waitedForegroundMs = 0;
    while (waitedForegroundMs < CFG.initialWaitMs && !S.stopping) {
      await waitForForeground();
      const found = capture('up');
      if (found.visible) break;
      S.phase = 'Aguardando mensagens';
      status();
      await sleep(500);
      if (!S.paused) waitedForegroundMs += 500;
    }
    if (!S.records.size) {
      const d = detectFailure();
      throw new Error(t('errorNoMessages', { diagnostic: JSON.stringify(d) }));
    }
    status();
    if (captureMode === 'assisted') {
      if (!S.stopping) await captureAssisted();
      else S.partial = true;
    } else if (captureMode === 'native') {
      if (!S.stopping) await scanNative();
      if (S.assistedFallback && !S.stopping) await captureAssisted();
      else if (S.stopping) S.partial = true;
    } else {
      await scanDirection(-1);
      if (S.assistedFallback && !S.stopping) await captureAssisted();
      else if (!S.stopping) {
        await scanDirection(1);
        if (S.assistedFallback && !S.stopping) await captureAssisted();
      }
    }
    capture(isAssisted() ? S.assistedDirection : 'down');
    S.phase = archive ? 'Empacotando' : 'Exportando arquivo';
    status();
    const saved = await save();
    console.info(t('consoleDone', { status: S.partial ? t('consolePartial') : t('consoleComplete'), count: saved }), { partial: S.partial, errors: S.errors });
  } catch (err) {
    S.errors.push(String(err));
    console.error(t('consoleFailure'), err);
    if (S.records.size) {
      S.partial = true;
      const saved = await save();
      console.warn(t('consoleInterrupted', { count: saved }));
    } else {
      console.error(t('consoleNone'));
    }
  } finally {
    if (S.nativeBridge) { S.nativeBridge.close(); S.nativeBridge = null; }
    restoreCapturedScrollWidgets();
    S.observer?.disconnect();
    activityEvents.forEach(([target, name]) => target.removeEventListener(name, updateActivity));
    wakeWaiters();
    S.running = false;
    window.__chatgptMdExporter.running = false;
    if (!S.errors.length && S.records.size && (!archive || !(archive.summary().missing + archive.summary().overflow))) {
      panel.remove();
    } else {
      stop.textContent = t('buttonClose');
      stop.onclick = () => panel.remove();
      const missing = archive ? archive.summary().missing + archive.summary().overflow : 0;
      description.textContent = missing && !S.errors.length
        ? t('panelArchiveMissing', { count: missing })
        : isAssisted() && (!S.errors.length || S.assistedFallback)
          ? t(S.nativeFallback ? 'nativeFallbackSaved' : S.assistedFallback ? 'autoFallbackSaved' : 'assistedSavedPartial', { count: S.records.size })
          : t('panelFailed', { errors: S.errors.join(' | ') });
    }
  }
})();
