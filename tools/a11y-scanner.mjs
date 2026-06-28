#!/usr/bin/env node
// a11y-scanner — zero-dependency static accessibility scanner (WCAG 2.2 A/AA, the
// statically-detectable subset). Mirrors seo-scanner.mjs: walks HTML files, parses with
// the inline SAX parser, emits findings as { file, line, severity, category, rule, message }.
//
// Philosophy (Ultraship "zero false positives"): only flag deterministic, source-visible
// failures. Contrast, focus-visibility, and reading-order need a rendered page — for those the
// /a11y skill escalates to `npx pa11y` / `npx @axe-core/cli` against the running app.
import { Parser } from './lib/html-parser.mjs';
import fs from 'fs';
import path from 'path';
import { checkFileSize } from './lib/security.mjs';

const ALWAYS_SKIP = new Set(['node_modules', '.git', '.next']);
const MAYBE_SKIP = new Set(['dist', 'build']);

// Input types that are not user-editable text fields and don't require a <label>.
const NO_LABEL_INPUT_TYPES = new Set(['hidden', 'submit', 'reset', 'button', 'image']);
// Link/button text that conveys no purpose out of context (WCAG 2.4.4).
const GENERIC_LINK_TEXT = new Set(['click here', 'click', 'here', 'read more', 'more', 'link', 'this', 'learn more', 'details', 'go']);

function dirHasHtml(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && /\.html?$/i.test(e.name)) return true;
      if (e.isDirectory() && !ALWAYS_SKIP.has(e.name)) {
        if (dirHasHtml(path.join(dirPath, e.name))) return true;
      }
    }
  } catch { /* skip */ }
  return false;
}

function findHtmlFiles(dir, skipOverrides) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      if (MAYBE_SKIP.has(entry.name) && !(skipOverrides && skipOverrides.has(entry.name))) continue;
      results.push(...findHtmlFiles(path.join(dir, entry.name), skipOverrides));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function hasAccessibleNameAttr(attrs) {
  return (
    (attrs['aria-label'] && attrs['aria-label'].trim()) ||
    (attrs['aria-labelledby'] && attrs['aria-labelledby'].trim()) ||
    (attrs['title'] && attrs['title'].trim())
  );
}

function shortAttr(attrs, keys) {
  for (const k of keys) {
    if (attrs[k]) return `${k}="${attrs[k].slice(0, 40)}"`;
  }
  return '';
}

function scanFile(filePath, relFile, findings) {
  const sizeCheck = checkFileSize(filePath, fs.statSync);
  if (!sizeCheck.ok) return;
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const state = {
    sawHtmlTag: false,
    htmlLang: undefined,
    hasTitle: false,
    hasMain: false,
    headings: [],            // { level, empty }
    idCounts: new Map(),     // id -> count (duplicate detection)
    allIds: new Set(),       // for reference resolution
    references: [],          // { kind, ids:[], attr }
    positiveTabindex: 0,
  };

  // Context stacks for elements whose accessible name depends on their children.
  const linkStack = [];      // <a href> contexts
  const buttonStack = [];    // <button> contexts
  let headingCtx = null;     // { level, text }
  let titleCtx = false;

  const parser = new Parser({
    onopentag(tag, attrs) {
      // ---- ids (duplicate + reference target collection) ----
      if (attrs.id) {
        const id = attrs.id.trim();
        if (id) {
          state.idCounts.set(id, (state.idCounts.get(id) || 0) + 1);
          state.allIds.add(id);
        }
      }
      if (attrs['aria-labelledby']) state.references.push({ kind: 'aria-labelledby', ids: attrs['aria-labelledby'].trim().split(/\s+/), tag });
      if (attrs['aria-describedby']) state.references.push({ kind: 'aria-describedby', ids: attrs['aria-describedby'].trim().split(/\s+/), tag });
      if (tag === 'label' && attrs.for) state.references.push({ kind: 'label-for', ids: [attrs.for.trim()], tag });

      // ---- positive tabindex (WCAG 2.4.3) ----
      if (attrs.tabindex !== undefined) {
        const ti = parseInt(attrs.tabindex, 10);
        if (!Number.isNaN(ti) && ti > 0) {
          state.positiveTabindex++;
          findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'positive-tabindex', message: `tabindex="${attrs.tabindex}" (positive) forces an unnatural keyboard tab order — use tabindex="0" or restructure the DOM (WCAG 2.4.3)` });
        }
      }

      switch (tag) {
        case 'html':
          state.sawHtmlTag = true;
          state.htmlLang = attrs.lang;
          break;
        case 'title':
          state.hasTitle = true;
          titleCtx = true;
          break;
        case 'main':
          state.hasMain = true;
          break;
        case 'img': {
          // WCAG 1.1.1 — every <img> needs an alt attribute. alt="" is valid (decorative).
          const role = (attrs.role || '').toLowerCase();
          const decorativeByRole = role === 'presentation' || role === 'none' || attrs['aria-hidden'] === 'true';
          if (attrs.alt === undefined && !decorativeByRole && !hasAccessibleNameAttr(attrs)) {
            const id = shortAttr(attrs, ['src']);
            findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'img-missing-alt', message: `<img${id ? ' ' + id : ''}> has no alt attribute — screen readers cannot describe it. Use alt="" for decorative images or descriptive alt text otherwise (WCAG 1.1.1)` });
          }
          // An <img> inside a link/button contributes its alt as the accessible name.
          const accessibleImg = (attrs.alt && attrs.alt.trim()) || hasAccessibleNameAttr(attrs);
          if (accessibleImg) {
            if (linkStack.length) linkStack[linkStack.length - 1].hasName = true;
            if (buttonStack.length) buttonStack[buttonStack.length - 1].hasName = true;
          }
          break;
        }
        case 'svg':
          if ((attrs['aria-label'] && attrs['aria-label'].trim()) || attrs.role === 'img') {
            if (linkStack.length) linkStack[linkStack.length - 1].hasName = true;
            if (buttonStack.length) buttonStack[buttonStack.length - 1].hasName = true;
          }
          break;
        case 'a':
          if (attrs.href !== undefined) {
            linkStack.push({ text: '', hasName: !!hasAccessibleNameAttr(attrs) });
          }
          break;
        case 'button':
          buttonStack.push({ text: '', hasName: !!hasAccessibleNameAttr(attrs) });
          break;
        case 'input':
        case 'select':
        case 'textarea': {
          const type = (attrs.type || (tag === 'input' ? 'text' : '')).toLowerCase();
          if (tag === 'input' && type === 'image') {
            if (attrs.alt === undefined && !hasAccessibleNameAttr(attrs)) {
              findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'input-image-missing-alt', message: `<input type="image"> has no alt — it acts as a button and needs an accessible name (WCAG 1.1.1)` });
            }
            break;
          }
          if (NO_LABEL_INPUT_TYPES.has(type)) break;
          const labelled =
            !!hasAccessibleNameAttr(attrs) ||
            (attrs.id && attrs.id.trim()); // resolved against <label for> after parse
          // Record control; final label check happens after parse when all <label for> are known.
          state.references.push({ kind: 'control', ids: attrs.id ? [attrs.id.trim()] : [], tag, type, hasName: !!hasAccessibleNameAttr(attrs), nameHint: shortAttr(attrs, ['name', 'id', 'placeholder']) });
          void labelled;
          break;
        }
        case 'meta':
          if ((attrs.name || '').toLowerCase() === 'viewport' && attrs.content) {
            const c = attrs.content.toLowerCase().replace(/\s+/g, '');
            if (/user-scalable=(no|0)/.test(c) || /maximum-scale=(1|0?\.\d+|0)(?:[,;]|$)/.test(c)) {
              findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'viewport-zoom-disabled', message: `<meta name="viewport"> disables zoom (user-scalable=no / maximum-scale=1) — blocks users who need to magnify the page (WCAG 1.4.4)` });
            }
          }
          break;
        default:
          if (/^h[1-6]$/.test(tag)) {
            headingCtx = { level: parseInt(tag[1], 10), text: '' };
          }
      }
    },

    ontext(text) {
      if (headingCtx) headingCtx.text += text;
      if (titleCtx) { /* title presence already recorded */ }
      if (linkStack.length) linkStack[linkStack.length - 1].text += text;
      if (buttonStack.length) buttonStack[buttonStack.length - 1].text += text;
    },

    onclosetag(tag) {
      if (tag === 'title') titleCtx = false;
      if (tag === 'a') {
        const ctx = linkStack.pop();
        if (ctx && !ctx.hasName) {
          const t = ctx.text.replace(/\s+/g, ' ').trim();
          if (!t) {
            findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'link-no-text', message: `Empty link: <a href> with no text or accessible name — screen readers announce nothing actionable (WCAG 2.4.4 / 4.1.2)` });
          } else if (GENERIC_LINK_TEXT.has(t.toLowerCase())) {
            findings.push({ file: relFile, line: 0, severity: 'low', category: 'a11y', rule: 'link-generic-text', message: `Link text "${t}" is not descriptive out of context — use text that states the destination (WCAG 2.4.4)` });
          }
        }
      }
      if (tag === 'button') {
        const ctx = buttonStack.pop();
        if (ctx && !ctx.hasName && !ctx.text.replace(/\s+/g, ' ').trim()) {
          findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'button-no-text', message: `Empty <button> with no text or aria-label — icon-only buttons need an accessible name (WCAG 4.1.2)` });
        }
      }
      if (/^h[1-6]$/.test(tag) && headingCtx && headingCtx.level === parseInt(tag[1], 10)) {
        state.headings.push({ level: headingCtx.level, empty: !headingCtx.text.replace(/\s+/g, ' ').trim() });
        headingCtx = null;
      }
    },
  });

  parser.write(content);
  parser.end();

  // ---- document-level rules ----
  if (state.sawHtmlTag) {
    if (state.htmlLang === undefined) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'html-missing-lang', message: `<html> has no lang attribute — assistive tech cannot determine the page language. Add lang="en" (or the correct code) (WCAG 3.1.1)` });
    } else if (!state.htmlLang.trim()) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'html-empty-lang', message: `<html lang=""> is empty — set a valid language code such as lang="en" (WCAG 3.1.1)` });
    }
    if (!state.hasTitle) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'missing-title', message: `No <title> — every page needs a title for orientation and screen-reader announcement (WCAG 2.4.2)` });
    }
    if (!state.hasMain) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'a11y', rule: 'missing-main-landmark', message: `No <main> landmark — keyboard and screen-reader users rely on it to skip to primary content (WCAG 1.3.1)` });
    }
  }

  // headings: empty + skipped level
  let prevLevel = 0;
  for (const h of state.headings) {
    if (h.empty) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'empty-heading', message: `Empty <h${h.level}> — empty headings break the document outline for screen readers (WCAG 1.3.1)` });
    }
    if (prevLevel && h.level > prevLevel + 1) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'heading-skip', message: `Heading jumps from H${prevLevel} to H${h.level} — don't skip levels; it breaks the outline (WCAG 1.3.1)` });
    }
    prevLevel = h.level;
  }

  // duplicate ids (label/aria associations depend on unique ids)
  for (const [id, count] of state.idCounts) {
    if (count > 1) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'duplicate-id', message: `id="${id}" used ${count} times — duplicate ids break label/aria associations (WCAG 1.3.1 / 4.1.2)` });
    }
  }

  // unresolved references + unlabeled form controls
  const labelForIds = new Set(state.references.filter(r => r.kind === 'label-for').flatMap(r => r.ids));
  for (const ref of state.references) {
    if (ref.kind === 'control') {
      const hasLabel = ref.hasName || ref.ids.some(id => labelForIds.has(id));
      if (!hasLabel) {
        const hint = ref.nameHint ? ` (${ref.nameHint})` : '';
        findings.push({ file: relFile, line: 0, severity: 'high', category: 'a11y', rule: 'control-missing-label', message: `Form control <${ref.tag}>${hint} has no associated <label>, aria-label, or aria-labelledby — placeholders don't count (WCAG 1.3.1 / 4.1.2)` });
      }
      continue;
    }
    // aria-labelledby / aria-describedby / label-for pointing at a non-existent id
    for (const id of ref.ids) {
      if (id && !state.allIds.has(id)) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'a11y', rule: 'broken-aria-reference', message: `${ref.kind}="${id}" references an element id that does not exist on the page — the association is silently dropped (WCAG 1.3.1 / 4.1.2)` });
      }
    }
  }
}

function scanDirectory(rootDir) {
  const skipOverrides = new Set();
  for (const d of MAYBE_SKIP) {
    if (dirHasHtml(path.join(rootDir, d))) skipOverrides.add(d);
  }
  const htmlFiles = findHtmlFiles(rootDir, skipOverrides);
  const findings = [];

  for (const f of htmlFiles) {
    const relFile = path.relative(rootDir, f) || path.basename(f);
    scanFile(f, relFile, findings);
  }

  let scores;
  if (htmlFiles.length === 0) {
    scores = { a11y: null };
  } else {
    const severityDeductions = { critical: 20, high: 10, medium: 5, low: 2, info: 0 };
    let a11y = 100;
    for (const finding of findings) {
      a11y = Math.max(0, a11y - (severityDeductions[finding.severity] ?? 0));
    }
    scores = { a11y };
  }

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

  return {
    files_scanned: htmlFiles.length,
    findings,
    summary: bySeverity,
    scores,
    note: htmlFiles.length === 0
      ? 'No HTML files found. a11y-scanner reads built/static HTML. For React/JSX or a running app, the /a11y skill escalates to `npx pa11y <url>` for rendered checks (contrast, focus order).'
      : 'Static WCAG 2.2 subset. Contrast, focus visibility, and reading order require a rendered page — run `npx pa11y <url>` via the /a11y skill for those.',
  };
}

const rootDir = process.argv[2] || '.';
const result = scanDirectory(rootDir);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
