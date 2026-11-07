/*
 * AI use Page 2 (Project Intelligence) fit proof.
 *
 * For every project in the AI use list, plus synthetic data shapes (no QA, no use
 * cases, one release, long names, ...) layered onto a real project through request
 * interception, at 1440x900, 1366x768, 1536x864 and Genie ~1100x768
 * (and the same screens minus browser chrome: 1366x628, 1440x760, 1536x730, Genie 1100x628) in dark mode,
 * it asserts:
 *   1. contain  - no element inside a card sits outside the card box; text keeps a few px of air
 *   2. overlap  - no two text runs from different elements overlap; no text touches the edge of its
 *                 card or inner panel (>= 4px / 3px of air); sibling panels keep a gap (>= 3px);
 *                 chart labels stay inside their svg
 *   3. noscroll - page, app shell, .ai-p2 root and every card body have no scroll or clipped overflow
 *   4. ellipsis - no text-overflow ellipsis / line-clamp / overflow-hidden clipped text
 *   5. even     - sibling rows of the same table (use cases, capabilities, funnel, benchmark) share one height
 *      rows     - use-case rows <= 40px, battle rows <= 36px (the CSS cap tokens, never above these), no gap between consecutive rows above one row, and (viewport >= 860px tall) <= 40px padding above/below a 6+ row mid table
 *   6. slack    - no card leaves a large empty band under its content
 *   7. type     - one type scale: sizes 10 / 10.5 / 11.5 / 13px (plus the hero tier: 19px header
 *                 Value / Recoverable and the 17px benchmark rank), and equal size + weight for the
 *                 same role (row labels, row figures) in every card
 *   8. content  - the new elements: a one-line headline strip under the header, hero numbers, a
 *                 legend on the QA card and the release chart, linear release lines with one dot per
 *                 release and a data-driven release sentence, a single red blocker in the QA card,
 *                 Battle rows with aligned columns and a lead marker that matches the numbers,
 *                 collapsed n/a rows, a Gain column only when rows differ, labelled benchmark
 *                 markers, definition tooltips, and no React console warnings (duplicate keys)
 *
 * Needs the app on :42005 (vite) and the API on :42006. Uses the already installed
 * @playwright/test package and a system Chrome.
 *
 *   node scripts/ai-p2-fit-check.mjs [--out DIR] [--shots DIR] [--only AK,NH] [--sizes 1366x768] [--theme dark|light]
 *
 * Exit code is 1 when any check fails.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://127.0.0.1:42005');
const OUT = arg('out', '');
const SHOTS = arg('shots', '');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const SIZE_LABELS = {
  '1440x900': [1440, 900],
  '1366x768': [1366, 768],
  '1536x864': [1536, 864],
  'genie-1100x768': [1100, 768],
  /* Same laptops with the browser chrome and taskbar taken off the screen height. */
  '1366x628': [1366, 628],
  '1440x760': [1440, 760],
  '1536x730': [1536, 730],
  'genie-1100x628': [1100, 628],
};
const sizeFilter = arg('sizes', '') ? arg('sizes', '').split(',') : null;
const SIZES = Object.entries(SIZE_LABELS).filter(([k]) => !sizeFilter || sizeFilter.includes(k));
const THEME = arg('theme', 'dark');
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const clone = (o) => JSON.parse(JSON.stringify(o));
const rename = (kpis, from, to) => {
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (node[k] === from && (k === 'project' || k === 'Project')) node[k] = to;
        else walk(node[k]);
      }
    }
  };
  walk(kpis);
};
const forProject = (rows, p) => (rows || []).filter((r) => r.project === p);

/* Synthetic shapes. Test fixtures only: they are applied to a response in flight, never stored. */
const SHAPES = {
  'no-qa': (k, p) => {
    k.dev_vs_qa = k.dev_vs_qa.filter((r) => !(r.project === p && r.domain === 'QA'));
    k.use_case_matrix = k.use_case_matrix.filter((r) => !(r.project === p && ['Unit testing', 'Test design', 'Test automation', 'Defect analysis'].includes(r.use_case_canonical)));
    const h = k.health.find((r) => r.project === p);
    if (h) h.qa_adoption_pct = null;
  },
  'few-use-cases': (k, p) => {
    const mine = forProject(k.use_case_matrix, p).slice(0, 2);
    k.use_case_matrix = k.use_case_matrix.filter((r) => r.project !== p).concat(mine);
  },
  'no-use-cases': (k, p) => {
    k.use_case_matrix = k.use_case_matrix.filter((r) => r.project !== p);
  },
  'one-release': (k, p) => {
    const mine = forProject(k.release_trend, p).slice(0, 1);
    k.release_trend = k.release_trend.filter((r) => r.project !== p).concat(mine);
    const h = k.health.find((r) => r.project === p);
    if (h && h.release_series) h.release_series = h.release_series.slice(0, 1);
  },
  'no-releases': (k, p) => {
    k.release_trend = k.release_trend.filter((r) => r.project !== p);
    const h = k.health.find((r) => r.project === p);
    if (h) h.release_series = [];
  },
  'many-releases': (k, p) => {
    const mine = forProject(k.release_trend, p);
    const base = mine[mine.length - 1];
    const extra = [];
    for (let i = 1; i <= 8; i += 1) {
      extra.push({ ...base, release: `R${15 + i}.${i}.${i + 2}`, sequence: base.sequence + i, adoption_pct: 20 + ((i * 37) % 70), hours_saved: 10 + i * 9 });
    }
    k.release_trend = k.release_trend.concat(extra);
  },
  'long-name': (k, p) => {
    const long = `${p} Enterprise Data Platform Modernization Programme`;
    rename(k, p, long);
    const h = k.health.find((r) => r.project === long);
    if (h) h.manager = 'Peermayakgari Irfan Basha Mohammed Abdul Rahman, Second Manager';
    return long;
  },
  'few-axes': (k, p) => {
    const r = k.maturity_radar.find((x) => x.project === p);
    if (r) r.axes = r.axes.slice(0, 3);
  },
  'many-axes': (k, p) => {
    const r = k.maturity_radar.find((x) => x.project === p);
    if (r) {
      r.axes = r.axes.concat([
        { axis: 'Governance', score: 41 },
        { axis: 'Knowledge Management', score: 55 },
      ]);
    }
  },
  'top-level': (k, p) => {
    const h = k.health.find((r) => r.project === p);
    if (h) h.maturity_level = 5;
    const rec = (k.project_recommendations || []).find((r) => r.project === p);
    if (rec) rec.next_maturity_level = 5;
  },
  'all-at-target': (k, p) => {
    const r = k.maturity_radar.find((x) => x.project === p);
    if (r) r.axes = r.axes.map((a) => ({ ...a, score: 92 }));
  },
  'long-axis-name': (k, p) => {
    const r = k.maturity_radar.find((x) => x.project === p);
    if (r) r.axes = r.axes.map((a, i) => (i === 0 ? { ...a, axis: 'Cross Functional Quality Governance Automation' } : a));
  },
  'no-axes': (k, p) => {
    k.maturity_radar = k.maturity_radar.filter((r) => r.project !== p);
  },
  'no-contributors': (k, p) => {
    k.risks = k.risks.filter((r) => r.project !== p);
  },
  'sparse-health': (k, p) => {
    const h = k.health.find((r) => r.project === p);
    if (h) {
      Object.assign(h, { active_users: 0, headcount_scope: 0, people_tagged: 0, rows: 0, value_usd: null, ai_value_usd: null, unrealized_value_usd: null, trend_pts: null });
    }
    k.dev_vs_qa = k.dev_vs_qa.map((r) => (r.project === p ? { ...r, users_enabled: null, users_active: 0, hours_saved: 0 } : r));
  },
};

const MEASURE = (theme) => {
  const px = (n) => Math.round(n * 10) / 10;
  const root = document.querySelector('[data-ai-p2-root]');
  if (!root) return { error: 'Page 2 root missing' };
  if (document.documentElement.classList.contains('dark') !== (theme === 'dark')) return { error: `html.dark does not match the requested ${theme} theme` };
  const fails = { contain: [], overlap: [], noscroll: [], ellipsis: [], even: [], rows: [], slack: [], type: [], content: [] };
  const cards = [...root.querySelectorAll(':scope > section, :scope > .ai-p2-mid > section, :scope > .ai-p2-low > section')];
  const nameOf = (el) => {
    const t = el.querySelector('.ai-p2-card-title');
    if (t) return t.textContent.trim();
    if (el.hasAttribute('data-ai-p2-head')) return 'Header';
    if (el.hasAttribute('data-ai-p2-headline')) return 'Headline';
    if (el.hasAttribute('data-ai-p2-insight')) return 'Insight strip';
    return el.className.toString().slice(0, 24);
  };
  const describe = (el) => {
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '');
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : ''}${txt ? ` "${txt}"` : ''}`;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isRechartsHelper = (el) => el.closest('.recharts-tooltip-wrapper, .recharts-legend-wrapper') !== null;
  const TEXT_AIR = 2;

  const cardRects = {};
  for (const card of cards) {
    const cname = nameOf(card);
    const cr = card.getBoundingClientRect();
    cardRects[cname] = cr;
    const all = [...card.querySelectorAll('*')].filter((el) => visible(el) && !isRechartsHelper(el));

    /* 1. contain */
    for (const el of all) {
      const inSvg = el.closest('svg') && el.tagName.toLowerCase() !== 'svg' && el.tagName.toLowerCase() !== 'text';
      if (inSvg) continue;
      const r = el.getBoundingClientRect();
      const air = el.tagName.toLowerCase() === 'text' || (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) ? TEXT_AIR : 0;
      const over = {
        l: cr.left + air - r.left,
        r: r.right - (cr.right - air),
        t: cr.top + air - r.top,
        b: r.bottom - (cr.bottom - air),
      };
      if (over.l > 0.5 || over.r > 0.5 || over.t > 0.5 || over.b > 0.5) {
        fails.contain.push(`${cname}: ${describe(el)} out by L${px(over.l)} R${px(over.r)} T${px(over.t)} B${px(over.b)}`);
      }
    }

    /* 2. text overlap (text-node range rects, shrunk to the glyph box) */
    const runs = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent.trim();
      const parent = node.parentElement;
      if (text && parent && visible(parent) && !isRechartsHelper(parent)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          const shrink = rect.height * 0.14;
          runs.push({ el: parent, text, l: rect.left, r: rect.right, t: rect.top + shrink, b: rect.bottom - shrink });
        }
      }
      node = walker.nextNode();
    }
    for (let i = 0; i < runs.length; i += 1) {
      for (let j = i + 1; j < runs.length; j += 1) {
        const a = runs[i];
        const b = runs[j];
        if (a.el === b.el) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (w > 1 && h > 1) fails.overlap.push(`${cname}: "${a.text.slice(0, 22)}" x "${b.text.slice(0, 22)}" (${px(w)}x${px(h)})`);
      }
    }

    /* 2b. air: text vs its nearest panel edge, sibling panels, svg labels */
    const isPanel = (el) => {
      if (el === card) return true;
      if (el.tagName.toLowerCase() === 'svg' || el.classList.contains('ai-chip')) return false;
      const cs = getComputedStyle(el);
      const sides = [cs.borderTopWidth, cs.borderBottomWidth, cs.borderLeftWidth, cs.borderRightWidth].filter((w) => parseFloat(w) > 0).length;
      if (sides < 3) return false;
      const r = el.getBoundingClientRect();
      return r.height >= 24 && r.width >= 60;
    };
    const panels = [card, ...all.filter(isPanel)];
    const cardAir = card.hasAttribute('data-ai-p2-head') || card.hasAttribute('data-ai-p2-insight') || card.hasAttribute('data-ai-p2-headline') ? 2.5 : 4;
    for (const run of runs) {
      let owner = run.el;
      while (owner && owner !== card && !panels.includes(owner)) owner = owner.parentElement;
      if (!owner) continue;
      const pr = owner.getBoundingClientRect();
      const need = owner === card ? cardAir : 3;
      const gaps = { L: run.l - pr.left, R: pr.right - run.r, T: run.t - pr.top, B: pr.bottom - run.b };
      const bad = Object.entries(gaps).filter(([, v]) => v < need - 0.01);
      if (bad.length) fails.overlap.push(`${cname}: "${run.text.slice(0, 22)}" only ${bad.map(([k, v]) => `${k}${px(v)}`).join(' ')}px from ${owner === card ? 'card' : describe(owner)} edge (need ${need})`);
    }
    for (let i = 0; i < panels.length; i += 1) {
      for (let j = i + 1; j < panels.length; j += 1) {
        const a = panels[i];
        const b = panels[j];
        if (a === card || a.contains(b) || b.contains(a)) continue;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const xOverlap = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const yOverlap = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        const vGap = Math.max(ar.top - br.bottom, br.top - ar.bottom);
        const hGap = Math.max(ar.left - br.right, br.left - ar.right);
        if ((xOverlap > 4 && vGap < 3) || (yOverlap > 4 && hGap < 3)) fails.overlap.push(`${cname}: ${describe(a)} and ${describe(b)} are ${px(Math.max(vGap, hGap))}px apart (need 3)`);
      }
    }
    for (const t of card.querySelectorAll('svg text')) {
      const svg = t.ownerSVGElement;
      if (!svg || !visible(svg)) continue;
      const tr = t.getBoundingClientRect();
      const sr = svg.getBoundingClientRect();
      if (tr.width > 0 && (tr.left < sr.left - 0.5 || tr.right > sr.right + 0.5 || tr.top < sr.top - 0.5 || tr.bottom > sr.bottom + 0.5)) fails.overlap.push(`${cname}: chart label "${t.textContent.trim()}" leaves its svg`);
    }

    /* 7. one type scale */
    if (!card.hasAttribute('data-ai-p2-head')) {
      for (const el of all) {
        if (el.closest('svg')) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const isRank = el.matches('.ai-p2-mgr-rank b') && fs === 17;
        if (![10, 10.5, 11.5, 13].includes(fs) && !isRank) fails.type.push(`${cname}: ${describe(el)} is ${fs}px (scale is 10/10.5/11.5/13, rank 17)`);
      }
    }

    /* 3. clipped overflow and scroll inside the card */
    for (const el of [card, ...all]) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const cs = getComputedStyle(el);
      const vScroll = el.scrollHeight - el.clientHeight;
      const hScroll = el.scrollWidth - el.clientWidth;
      if (el.clientHeight > 0 && vScroll > 1 && cs.overflowY !== 'visible') fails.noscroll.push(`${cname}: ${describe(el)} clips ${vScroll}px vertically (${cs.overflowY})`);
      if (el.clientWidth > 0 && hScroll > 1 && cs.overflowX !== 'visible') fails.noscroll.push(`${cname}: ${describe(el)} clips ${hScroll}px horizontally (${cs.overflowX})`);
    }

    /* 4. ellipsis / clamp */
    for (const el of all) {
      if (el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 0.5) fails.ellipsis.push(`${cname}: ${describe(el)} ellipsis (${el.scrollWidth}>${el.clientWidth})`);
      const clamp = cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp');
      if (clamp && clamp !== 'none' && el.scrollHeight > el.clientHeight + 1) fails.ellipsis.push(`${cname}: ${describe(el)} line-clamp (${el.scrollHeight}>${el.clientHeight})`);
    }

    /* 6. slack under content */
    const kids = all.filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg');
    const contentBottom = Math.max(...kids.map((el) => el.getBoundingClientRect().bottom), cr.top);
    card.dataset.slack = String(px(cr.bottom - contentBottom));
  }

  /* 3b. page level */
  const se = document.scrollingElement;
  if (se.scrollHeight - se.clientHeight > 1) fails.noscroll.push(`document scrolls ${se.scrollHeight - se.clientHeight}px`);
  if (se.scrollWidth - se.clientWidth > 1) fails.noscroll.push(`document scrolls horizontally ${se.scrollWidth - se.clientWidth}px`);
  for (let el = root; el && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight - el.clientHeight > 1 && getComputedStyle(el).overflowY !== 'visible') fails.noscroll.push(`ancestor ${describe(el)} clips ${el.scrollHeight - el.clientHeight}px`);
    if (el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflowX !== 'visible') fails.noscroll.push(`ancestor ${describe(el)} clips ${el.scrollWidth - el.clientWidth}px horizontally`);
  }
  const rootBox = root.getBoundingClientRect();
  if (rootBox.bottom > window.innerHeight + 1) fails.noscroll.push(`Page 2 root ends at ${px(rootBox.bottom)} > viewport ${window.innerHeight}`);

  /* every card must sit inside the .ai-p2 root */
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    if (r.bottom > rootBox.bottom + 1 || r.right > rootBox.right + 1) fails.noscroll.push(`${nameOf(card)} leaves the Page 2 root`);
  }

  /* 5. even rows */
  const heights = (sel) => [...root.querySelectorAll(sel)].filter(visible).map((el) => el.getBoundingClientRect().height);
  const spread = (label, list) => {
    if (list.length > 1 && Math.max(...list) - Math.min(...list) > 1.5) fails.even.push(`${label} rows differ: ${list.map(px).join(', ')}`);
  };
  spread('Use case', heights('.ai-uc-row'));
  spread('QA capability', heights('.ai-p2-qa-cap'));
  spread('Funnel', heights('.ai-p2-adopt-row'));
  spread('Battle', heights('.ai-battle-row'));

  /* 5b. dense tables: no row above its cap, no gap between consecutive rows above one row height */
  const capOf = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name));
  const denseTable = (label, sel, cap) => {
    const list = [...root.querySelectorAll(sel)].filter(visible).map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].height > cap + 0.5) fails.rows.push(`${label} row ${i + 1} is ${px(list[i].height)}px, cap ${cap}px`);
      if (i > 0) {
        const gap = list[i].top - list[i - 1].bottom;
        if (gap > list[i].height + 0.5) fails.rows.push(`${label} gap before row ${i + 1} is ${px(gap)}px, taller than a row (${px(list[i].height)}px)`);
      }
    }
  };
  denseTable('Use case', '.ai-uc-row', Math.min(capOf('--p2-uc-row-max'), 40));
  denseTable('Battle', '.ai-battle-row', Math.min(capOf('--p2-battle-row-max'), 36));

  /* 5c. on tall laptop viewports (860px and over) the padding above and below a mid table stays
     within 40px. Only tables with 6+ rows are held to it: two rows cannot fill a tall card
     without being spread apart, and rows are never spread. */
  if (window.innerHeight >= 860) {
    const padOf = (label, panelSel, lastSel) => {
      const panel = root.querySelector(panelSel);
      if (!panel || !visible(panel)) return;
      if (root.querySelectorAll(panelSel === '.ai-uc-strip' ? '.ai-uc-row' : '.ai-battle-row').length < 6) return;
      const card = panel.closest('.ai-p2-card');
      const head = card.querySelector('.ai-p2-card-head').getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      const last = root.querySelector(lastSel).getBoundingClientRect();
      const above = panel.getBoundingClientRect().top - head.bottom;
      const below = cr.bottom - parseFloat(getComputedStyle(card).paddingBottom) - last.bottom;
      if (above > 40.5) fails.rows.push(`${label} table has ${px(above)}px of padding above it (max 40)`);
      if (below > 40.5) fails.rows.push(`${label} table has ${px(below)}px of padding below it (max 40)`);
    };
    padOf('Use case', '.ai-uc-strip', '.ai-uc-strip');
    padOf('Battle', '.ai-battle-compare', '.ai-battle-foot');
  }

  /* 7b. same role = same type */
  const roles = {
    'row label (10.5/600)': ['.ai-uc-label', '.ai-battle-key', '.ai-p2-qa-cap-name', '.ai-p2-qa-step-name', '.ai-p2-qa-none', '.ai-p2-mgr-metrics', '.ai-p2-adopt-label', '.ai-p2-qa-rec-text', '.ai-p2-adopt-insight', '.ai-battle-rec', '.ai-p2-rel-insight', '.ai-p2-insight li', '.ai-p2-mgr-tag'],
    'row figure (10.5/700)': ['.ai-uc-num', '.ai-uc-trend', '.ai-battle-val', '.ai-p2-qa-cap-score', '.ai-p2-adopt-drop', '.ai-p2-mgr-vpu', '.ai-p2-donut-share', '.ai-p2-mgr-tag:not(.is-top) b'],
    'primary number (13/800)': ['.ai-p2-qa-score', '.ai-p2-adopt-count', '.ai-p2-mgr-tag.is-top b'],
    'hero number (19/800)': ['.ai-p2-head-kpi.is-hero b'],
    'meta (10/600)': ['.ai-p2-card-sub', '.ai-p2-eyebrow', '.ai-p2-qa-meta', '.ai-p2-qa-step-tag', '.ai-p2-qa-cap-status', '.ai-p2-adopt-people', '.ai-p2-donut-basis', '.ai-uc-axis', '.ai-battle-axis', '.ai-p2-rel-callout-meta', '.ai-battle-nodata', '.ai-p2-rel-legend', '.ai-p2-headline-asof', '.ai-p2-head-scope'],
    'title (11.5/750)': ['.ai-p2-card-title'],
  };
  for (const [role, sels] of Object.entries(roles)) {
    const seen = new Map();
    for (const sel of sels) {
      for (const el of root.querySelectorAll(sel)) {
        if (!visible(el)) continue;
        const cs = getComputedStyle(el);
        const sig = `${parseFloat(cs.fontSize)}px/${cs.fontWeight}`;
        if (!seen.has(sig)) seen.set(sig, sel);
      }
    }
    if (seen.size > 1) fails.type.push(`${role} differs: ${[...seen].map(([sig, sel]) => `${sel}=${sig}`).join(', ')}`);
  }

  /* 8. content: the elements added by the critique */
  const txt = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ') : '');
  const num = (t) => {
    const m = String(t).replace(/[$,%\sh]/g, '');
    return m === '' || m === 'n/a' ? null : Number(m);
  };
  const headEl = root.querySelector('[data-ai-p2-head]');
  const headline = root.querySelector('[data-ai-p2-headline]');
  const projectName = txt(root.querySelector('.ai-p2-head-project'));
  if (headEl) {
    const hh = headEl.getBoundingClientRect().height;
    const nameH = root.querySelector('.ai-p2-head-project').getBoundingClientRect().height;
    const nameWraps = nameH > 20;
    if (hh > (nameWraps ? 70.5 : 56.5)) fails.content.push(`Header is ${px(hh)}px tall (baseline 46px + 10px max${nameWraps ? ', + a wrapped project name' : ''})`);
    if (headEl.nextElementSibling !== headline) fails.content.push('Headline strip is not directly under the header');
    const hero = [...headEl.querySelectorAll('.ai-p2-head-kpi.is-hero b')];
    if (hero.length !== 2) fails.content.push(`Header has ${hero.length} hero KPI numbers (need Value and Recoverable)`);
    for (const b of hero) {
      const cs = getComputedStyle(b);
      if (parseFloat(cs.fontSize) < 18 || parseFloat(cs.fontSize) > 20 || Number(cs.fontWeight) < 800) fails.content.push(`Hero number "${txt(b)}" is ${cs.fontSize}/${cs.fontWeight} (need 18-20px / 800)`);
    }
    const ring = headEl.querySelector('.ai-p2-health-ring svg text');
    if (ring) {
      const rr = ring.getBoundingClientRect();
      if (rr.height < 12) fails.content.push(`Health score in the ring is only ${px(rr.height)}px tall`);
      if (getComputedStyle(ring).fill === 'rgb(0, 0, 0)') fails.content.push('Health score in the ring is black on the dark card');
    }
    if (projectName.length <= 18 && !headEl.querySelector('.ai-p2-head-scope')) fails.content.push('Header has no "AI adoption health" scope label');
  }
  if (!headline) fails.content.push('Headline strip is missing');
  else {
    const t = headline.querySelector('.ai-p2-headline-text');
    const line = txt(t);
    const range = document.createRange();
    range.selectNodeContents(t);
    const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top / 4)));
    if (lines.size > 1) fails.content.push(`Headline wraps onto ${lines.size} lines`);
    if (t.scrollWidth > t.clientWidth + 0.5) fails.content.push(`Headline overflows (${t.scrollWidth}>${t.clientWidth})`);
    if (!line.startsWith(projectName)) fails.content.push(`Headline does not start with the project name: "${line.slice(0, 40)}"`);
    if (/undefined|NaN|null|\[object/.test(line)) fails.content.push(`Headline has a bad value: "${line}"`);
    if (line.length < 20) fails.content.push(`Headline is too short: "${line}"`);
    if (t.querySelector('.ai-band-red')) fails.content.push('Headline uses red');
  }
  const qaCard = [...root.querySelectorAll('.ai-p2-qa')][0];
  if (qaCard) {
    const legend = qaCard.querySelector('[data-qa-legend]');
    if (!legend || !/bar = score/i.test(txt(legend)) || !/line = target/i.test(txt(legend))) fails.content.push('QA card legend "bar = score, line = target" is missing');
    const caps = [...qaCard.querySelectorAll('.ai-p2-qa-cap')];
    const redCaps = caps.filter((c) => c.dataset.band === 'red');
    if (redCaps.length > 1) fails.content.push(`QA card has ${redCaps.length} red capabilities (only the blocker may be red)`);
    for (const c of caps) {
      const word = txt(c.querySelector('.ai-p2-qa-cap-status'));
      if (!['', 'Blocker', 'Near target', 'At target'].includes(word)) fails.content.push(`QA capability status word "${word}" is not allowed`);
      if (c.dataset.band === 'neutral' && word) fails.content.push(`Neutral QA capability "${txt(c.querySelector('.ai-p2-qa-cap-name'))}" has a status word`);
      if (c.dataset.band === 'red' && word !== 'Blocker') fails.content.push('Red QA capability is not labelled Blocker');
    }
    const redChips = [...qaCard.querySelectorAll('.ai-p2-qa-constraints .ai-chip')].filter((c) => c.classList.contains('ai-band-red'));
    if (redChips.length > 1) fails.content.push(`${redChips.length} red blocker chips (only the top one may be red)`);
  }
  const battle = root.querySelector('[data-battle-compare]');
  if (battle) {
    const brs = [...battle.querySelectorAll('.ai-battle-row')];
    const edge = (sel, side) => brs.map((r) => r.querySelector(sel).getBoundingClientRect()[side]);
    const spreadOf = (list) => (list.length ? Math.max(...list) - Math.min(...list) : 0);
    if (spreadOf(edge('.ai-battle-key', 'left')) > 0.6) fails.content.push('Battle metric names are not left-aligned');
    if (spreadOf(edge('.ai-battle-val.is-dev', 'right')) > 0.6) fails.content.push('Battle Dev values are not right-aligned in one column');
    if (spreadOf(edge('.ai-battle-val.is-qa', 'right')) > 0.6) fails.content.push('Battle QA values are not right-aligned in one column');
    for (const r of brs) {
      const key = txt(r.querySelector('.ai-battle-key'));
      const d = txt(r.querySelector('.ai-battle-val.is-dev'));
      const q = txt(r.querySelector('.ai-battle-val.is-qa'));
      if (!r.querySelector('.ai-battle-lead')) fails.content.push(`Battle row ${key} has no lead marker`);
      if (d === 'n/a' && q === 'n/a') fails.content.push(`Battle row ${key} is n/a on both sides and should be collapsed`);
      const dn = num(d);
      const qn = num(q);
      const want = dn != null && qn != null && dn !== qn ? (dn > qn ? 'dev' : 'qa') : 'none';
      if (r.dataset.lead !== want) fails.content.push(`Battle row ${key}: lead marker is ${r.dataset.lead}, numbers say ${want} (${d} vs ${q})`);
      if (!r.getAttribute('title')) fails.content.push(`Battle row ${key} has no definition tooltip`);
    }
    const nd = battle.querySelector('[data-battle-nodata]');
    if (nd && !/^No data: /.test(txt(nd))) fails.content.push('Battle no-data line is malformed');
    const rec = root.querySelector('.ai-battle-rec');
    if (rec && /%/.test(txt(rec))) fails.content.push(`Battle sentence repeats the donut share: "${txt(rec)}"`);
  }
  const ucStrip = root.querySelector('[data-uc-strip]');
  if (ucStrip) {
    const hasTrendCol = !!ucStrip.querySelector('.ai-uc-axis-trend');
    const trends = [...ucStrip.querySelectorAll('.ai-uc-trend')].map(txt).filter((t) => t && t !== '—');
    if (hasTrendCol && new Set(trends).size < 2) fails.content.push(`Gain column repeats one value (${[...new Set(trends)].join(', ') || 'none'})`);
    const active = [...ucStrip.querySelectorAll('.ai-uc-row')].filter((r) => txt(r.querySelector('.ai-uc-num')) !== '—');
    if (!hasTrendCol && active.length && !root.querySelector('[data-uc-common-gain]')) fails.content.push('Gain column is hidden but no common gain is stated in the card subtitle');
    if (hasTrendCol && root.querySelector('[data-uc-common-gain]')) fails.content.push('Common gain is stated although the Gain column is shown');
    for (const chip of ucStrip.querySelectorAll('.ai-uc-rec .ai-chip')) {
      if (!chip.getAttribute('title') || chip.getAttribute('title').length < 20) fails.content.push(`Rec chip "${txt(chip)}" has no definition tooltip`);
    }
    for (const h of ucStrip.querySelectorAll('.ai-uc-axis-num, .ai-uc-axis-rec, .ai-uc-axis-trend')) {
      if (!h.getAttribute('title')) fails.content.push(`Use case column "${txt(h)}" has no tooltip`);
    }
  }
  const rel = root.querySelector('[data-rel-panel]');
  if (rel) {
    const legendEl = rel.querySelector('[data-rel-legend]');
    if (!legendEl || !/Adoption %/.test(txt(legendEl)) || !/Hours saved/.test(txt(legendEl))) fails.content.push('Release chart legend is missing Adoption % / Hours saved');
    const releases = rel.querySelectorAll('.ai-p2-rel-chips .ai-chip').length;
    const curves = [...rel.querySelectorAll('.recharts-line-curve, .recharts-area-curve')];
    for (const c of curves) {
      const d = c.getAttribute('d') || '';
      if (/[CcSsQq]/.test(d)) fails.content.push('Release chart line is smoothed (curve commands in the path)');
    }
    const dotXs = new Set([...rel.querySelectorAll('.recharts-line-dots .recharts-dot')].map((d) => Math.round(Number(d.getAttribute('cx')))));
    if (releases > 0 && dotXs.size !== releases) fails.content.push(`Release chart has ${dotXs.size} adoption dot positions for ${releases} releases`);
    const insight = txt(rel.querySelector('.ai-p2-rel-insight'));
    if (/At the peak|lock in what worked|Replicate the peak/.test(insight)) fails.content.push(`Release sentence is boilerplate: "${insight}"`);
    if (releases > 1 && !/weakest release/.test(insight) && !/level/.test(insight)) fails.content.push(`Release sentence is not data-driven: "${insight}"`);
    if (releases > 1 && /weakest release/.test(insight) && !/best/.test(insight)) fails.content.push(`Release sentence misses the best release: "${insight}"`);
  }
  const bench = root.querySelector('[data-ai-p2-benchmark]');
  if (bench) {
    const chip = bench.querySelector('[data-benchmark-status]');
    if (chip && !['Top quartile', 'Bottom quartile', 'Above average', 'Below average', 'At average'].includes(txt(chip))) fails.content.push(`Benchmark chip "${txt(chip)}" repeats the header band instead of a position`);
    const rank = bench.querySelector('.ai-p2-mgr-rank');
    if (rank && !/of \d+ projects/.test(txt(rank))) fails.content.push(`Benchmark rank text "${txt(rank)}" does not say projects`);
    if (rank) {
      const rs = parseFloat(getComputedStyle(rank.querySelector('b')).fontSize);
      if (rs <= 13) fails.content.push(`Benchmark rank is ${rs}px, not larger than the row figures`);
    }
    if (bench.querySelector('.ai-p2-mgr-range')) {
      const me = bench.querySelector('.ai-p2-mgr-tag.is-me');
      const avg = bench.querySelector('.ai-p2-mgr-tag.is-avg');
      if (!me || !/\d/.test(txt(me))) fails.content.push('Benchmark project marker has no score label');
      if (!avg || !/^Avg \d/.test(txt(avg))) fails.content.push('Benchmark average tick is not labelled "Avg n"');
      if (!bench.querySelector('.ai-p2-mgr-tag.is-q1, .ai-p2-mgr-tag.is-q13')) fails.content.push('Benchmark quartile labels are missing');
      const dot = bench.querySelector('.ai-p2-mgr-range-me').getBoundingClientRect();
      if (me) {
        const mr = me.getBoundingClientRect();
        const limitX = bench.querySelector('.ai-p2-mgr-range').getBoundingClientRect();
        if (mr.left < limitX.left - 1 || mr.right > limitX.right + 1) fails.content.push('Benchmark score label leaves the strip');
        if (Math.abs((mr.left + mr.right) / 2 - (dot.left + dot.right) / 2) > 40) fails.content.push('Benchmark score label is far from its dot');
      }
    }
  }
  for (const label of root.querySelectorAll('.ai-p2-adopt-label')) {
    if (!label.getAttribute('title') || label.getAttribute('title').length < 12) fails.content.push(`Funnel label "${txt(label)}" has no definition tooltip`);
  }
  const people = root.querySelector('[data-funnel-stage="contributors"]');
  if (people && !people.getAttribute('title')) fails.content.push('Contributors stage has no tooltip');
  const insightEl = root.querySelector('[data-ai-p2-insight]');
  if (insightEl && /Recover|Blocker:|unrealized|is (Elite|Strong|Average|Attention)/i.test(txt(insightEl))) fails.content.push(`Bottom strip repeats a header or headline fact: "${txt(insightEl).slice(0, 60)}"`);

  /* 6. slack */
  const limit = 0.22;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const slack = Number(card.dataset.slack);
    if (r.height > 0 && slack / r.height > limit && slack > 22) fails.slack.push(`${nameOf(card)} leaves ${slack}px empty of ${px(r.height)}px`);
  }

  const metrics = {};
  for (const card of cards) metrics[nameOf(card)] = { h: px(card.getBoundingClientRect().height), slack: Number(card.dataset.slack) };
  return { fails, metrics, viewport: [window.innerWidth, window.innerHeight] };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript((t) => localStorage.setItem('ets_dashboard_theme', t), THEME);
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
let consoleWarnings = [];
page.on('console', (msg) => {
  const t = msg.text();
  if (msg.type() === 'error' || /Warning:|same key|unique "key"/i.test(t)) {
    if (/Failed to load resource|favicon|ResizeObserver loop/i.test(t)) return;
    consoleWarnings.push(t.slice(0, 160));
  }
});

let realKpis = null;
let mutate = null;
await page.route('**/ai-utilization/kpis**', async (route) => {
  const resp = await route.fetch();
  const body = await resp.json();
  if (!realKpis) realKpis = clone(body);
  const out = mutate ? mutate(clone(realKpis)) : body;
  await route.fulfill({ response: resp, json: out });
});

await page.goto(`${BASE}/login`);
await page.fill('input[type="password"]', 'Admin@2026!');
await page.locator('input[type="text"], input[name="username"]').first().fill('admin');
await Promise.all([page.waitForURL(/dashboard/), page.click('button[type="submit"]')]);

const openPage2 = async (projectName) => {
  await page.goto(`${BASE}/dashboard?tab=ai_utilization`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ai-health-tile, .ai-health-row', { timeout: 120000 });
  await page.waitForTimeout(600);
  const tile = page.locator('.ai-health-tile, .ai-health-row').filter({ has: page.locator('b', { hasText: new RegExp(`^${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  await tile.click();
  await page.waitForSelector('[data-ai-p2-root] [data-ai-p2-insight]', { state: 'attached' });
  await page.waitForTimeout(900);
};

const runs = [];
const first = await (async () => {
  await page.goto(`${BASE}/dashboard?tab=ai_utilization`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ai-health-tile, .ai-health-row', { timeout: 120000 });
  return realKpis;
})();
const projects = first.health.map((h) => h.project);

const plan = [];
for (const p of projects) plan.push({ id: p, project: p, shape: null });
const shapeBase = projects.includes('AK') ? 'AK' : projects[0];
for (const s of Object.keys(SHAPES)) plan.push({ id: `${shapeBase}:${s}`, project: shapeBase, shape: s });
const planned = plan.filter((x) => !ONLY || ONLY.includes(x.id) || ONLY.includes(x.project) && !x.shape);

const rows = [];
for (const item of planned) {
  let displayProject = item.project;
  mutate = item.shape
    ? (k) => {
        const res = SHAPES[item.shape](k, item.project);
        if (typeof res === 'string') displayProject = res;
        return k;
      }
    : null;
  if (item.shape === 'long-name') displayProject = `${item.project} Enterprise Data Platform Modernization Programme`;
  consoleWarnings = [];
  await openPage2(displayProject);
  for (const [label, [w, h]] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(700);
    const res = await page.evaluate(MEASURE, THEME);
    if (!res.error) {
      res.fails.console = [...new Set(consoleWarnings)];
      consoleWarnings = [];
    }
    if (res.error) {
      rows.push({ id: item.id, size: label, pass: false, detail: { error: [res.error] }, metrics: {} });
      continue;
    }
    const failedChecks = Object.entries(res.fails).filter(([, v]) => v.length);
    rows.push({ id: item.id, size: label, pass: failedChecks.length === 0, detail: res.fails, metrics: res.metrics });
    if (SHOTS && (!item.shape || item.shape === 'no-qa')) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${item.id.replace(/[:\s]/g, '_')}_${label}.png`) });
    }
  }
}
await browser.close();

const checks = ['contain', 'overlap', 'noscroll', 'ellipsis', 'even', 'rows', 'slack', 'type', 'content', 'console'];
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('project / shape', 24)}${SIZES.map(([k]) => pad(k, 16)).join('')}`);
for (const id of [...new Set(rows.map((r) => r.id))]) {
  const line = SIZES.map(([k]) => {
    const r = rows.find((x) => x.id === id && x.size === k);
    return pad(r ? (r.pass ? 'PASS' : 'FAIL') : '-', 16);
  }).join('');
  console.log(`${pad(id, 24)}${line}`);
}
const failing = rows.filter((r) => !r.pass);
if (failing.length) {
  console.log('\nFailures');
  for (const r of failing) {
    console.log(`\n[${r.id} @ ${r.size}]`);
    for (const [name, list] of Object.entries(r.detail)) {
      const uniq = [...new Set(list)];
      if (uniq.length) console.log(`  ${name} (${uniq.length})`, uniq.slice(0, 6).map((s) => `\n    - ${s}`).join(''));
    }
  }
}
console.log(`\n${rows.length - failing.length}/${rows.length} passed`);
if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ checks, rows }, null, 2));
}
process.exit(failing.length ? 1 : 0);
