#!/usr/bin/env node
// ship-gate — turn the /ship scorecard into a blocking, config-as-code quality gate.
// Same scoring as /ship (shared tools/lib/ship-scoring.mjs), but compares to thresholds in
// .ultraship/ship-gate.json and EXITS 1 on failure so it can block a pre-push hook or CI.
//
// Subcommands:
//   ship-gate.mjs [run] <dir> [--json]  Run the gate. Exit 0 = pass, 1 = fail.
//   ship-gate.mjs init <dir> [--force]   Write a default .ultraship/ship-gate.json.
//   ship-gate.mjs ci <dir>               Write .github/workflows/ship-gate.yml.
//   ship-gate.mjs hook <dir>             Write .git/hooks/pre-push.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { computeShipScores } from './lib/ship-scoring.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUBCOMMANDS = new Set(['run', 'init', 'ci', 'hook']);
const CATEGORY_LABELS = {
  overall: 'Overall', seo: 'SEO + AI Visibility', a11y: 'Accessibility',
  security: 'Security', quality: 'Code Quality', bundle: 'Bundle',
};

const DEFAULT_CONFIG = {
  thresholds: { overall: 80, seo: 70, a11y: 80, security: 90, quality: 70, bundle: 70 },
  hardFail: { onLeakedSecrets: true, onCriticalFindings: true },
  skipMissing: true,
};

function fail(msg) {
  process.stdout.write(JSON.stringify({ error: msg }, null, 2) + '\n');
  process.exit(0); // never crash the host; gate-run uses exit 1 explicitly
}

function runTool(name, dir) {
  try {
    // stdio: ignore sub-tool stderr so a noisy tool (e.g. a git warning on a non-repo dir)
    // never pollutes the gate's own stdout/stderr or breaks --json parsing.
    const out = execFileSync('node', [join(__dirname, name), dir], {
      encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch (e) {
    try { return JSON.parse(e.stdout || ''); } catch { return { _failed: true, _error: String(e.message || 'tool failed').slice(0, 200) }; }
  }
}

function loadConfig(dir) {
  const p = join(dir, '.ultraship', 'ship-gate.json');
  if (!existsSync(p)) return { config: DEFAULT_CONFIG, fromFile: false };
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    return {
      config: {
        thresholds: { ...DEFAULT_CONFIG.thresholds, ...(parsed.thresholds || {}) },
        hardFail: { ...DEFAULT_CONFIG.hardFail, ...(parsed.hardFail || {}) },
        skipMissing: parsed.skipMissing !== undefined ? parsed.skipMissing : DEFAULT_CONFIG.skipMissing,
      },
      fromFile: true,
    };
  } catch {
    return { config: DEFAULT_CONFIG, fromFile: false, parseError: true };
  }
}

function collectAllFindings(results) {
  const out = [];
  for (const key of ['seo', 'a11y', 'secrets', 'profile']) {
    const r = results[key];
    if (r && Array.isArray(r.findings)) out.push(...r.findings.map(f => ({ ...f, audit: key })));
  }
  return out;
}

// ── run: evaluate the gate ──
function runGate(dir, asJson) {
  const resolvedDir = resolve(dir);
  if (!existsSync(resolvedDir)) {
    if (asJson) process.stdout.write(JSON.stringify({ passed: false, error: `Directory not found: ${resolvedDir}` }) + '\n');
    else process.stderr.write(`ship-gate: directory not found: ${resolvedDir}\n`);
    process.exit(1);
  }

  const { config, fromFile, parseError } = loadConfig(resolvedDir);

  const results = {
    seo: runTool('seo-scanner.mjs', resolvedDir),
    a11y: runTool('a11y-scanner.mjs', resolvedDir),
    secrets: runTool('secret-scanner.mjs', resolvedDir),
    profile: runTool('code-profiler.mjs', resolvedDir),
    deps: runTool('dep-doctor.mjs', resolvedDir),
    bundle: runTool('bundle-tracker.mjs', resolvedDir),
  };

  const s = computeShipScores(results);
  const categoryScores = {
    seo: s.seoScore, a11y: s.a11yScore, security: s.securityScore,
    quality: s.qualityScore, bundle: s.bundleScore,
  };

  const violations = [];
  const rows = [];

  // Overall threshold
  rows.push({ key: 'overall', score: s.overall, threshold: config.thresholds.overall, skipped: false });
  if (s.overall < config.thresholds.overall) {
    violations.push({ type: 'threshold', category: 'overall', score: s.overall, threshold: config.thresholds.overall });
  }

  // Per-category thresholds
  for (const cat of ['seo', 'a11y', 'security', 'quality', 'bundle']) {
    const score = categoryScores[cat];
    const threshold = config.thresholds[cat];
    if (score === null) {
      rows.push({ key: cat, score: null, threshold, skipped: true });
      if (!config.skipMissing) {
        violations.push({ type: 'skipped', category: cat, reason: 'category did not run and skipMissing=false' });
      }
      continue;
    }
    rows.push({ key: cat, score, threshold, skipped: false });
    if (score < threshold) {
      violations.push({ type: 'threshold', category: cat, score, threshold });
    }
  }

  // Hard-fail: any leaked secret
  if (config.hardFail.onLeakedSecrets) {
    const secretCount = results.secrets?.findings?.length || 0;
    if (secretCount > 0) {
      violations.push({ type: 'hard-fail', rule: 'leaked-secrets', count: secretCount });
    }
  }

  // Hard-fail: any critical finding in any audit
  if (config.hardFail.onCriticalFindings) {
    const criticals = collectAllFindings(results).filter(f => f.severity === 'critical');
    if (criticals.length > 0) {
      violations.push({ type: 'hard-fail', rule: 'critical-findings', count: criticals.length, examples: criticals.slice(0, 3).map(f => `${f.audit}:${f.rule || f.message}`) });
    }
  }

  const passed = violations.length === 0;
  const report = {
    passed,
    merge_confidence: s.overall,
    categories: rows,
    violations,
    config_source: fromFile ? '.ultraship/ship-gate.json' : 'defaults',
    audits_ran: s.ran,
    parse_error: parseError || undefined,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(passed ? 0 : 1);
  }

  // Pretty output
  const C = process.stdout.isTTY
    ? { g: '\x1b[1;32m', r: '\x1b[1;31m', y: '\x1b[1;33m', d: '\x1b[2m', b: '\x1b[1m', n: '\x1b[0m' }
    : { g: '', r: '', y: '', d: '', b: '', n: '' };
  const line = (k, score, threshold, skipped) => {
    const label = (CATEGORY_LABELS[k] || k).padEnd(20);
    if (skipped) return `  ${label} ${C.d}N/A (skipped)${C.n}`;
    const ok = score >= threshold;
    const mark = ok ? `${C.g}PASS${C.n}` : `${C.r}FAIL${C.n}`;
    const col = ok ? C.g : C.r;
    return `  ${label} ${col}${String(score).padStart(3)}${C.n}/100  ${C.d}(min ${threshold})${C.n}  ${mark}`;
  };

  process.stdout.write(`\n  ${C.b}ULTRASHIP SHIP-GATE${C.n}  ${C.d}(${fromFile ? '.ultraship/ship-gate.json' : 'default thresholds'})${C.n}\n`);
  process.stdout.write(`  ${C.d}${'─'.repeat(46)}${C.n}\n`);
  for (const row of rows.filter(r => r.key !== 'overall')) process.stdout.write(line(row.key, row.score, row.threshold, row.skipped) + '\n');
  process.stdout.write(`  ${C.d}${'─'.repeat(46)}${C.n}\n`);
  process.stdout.write(line('overall', s.overall, config.thresholds.overall, false) + '\n\n');

  if (passed) {
    process.stdout.write(`  ${C.g}${C.b}✅ GATE PASSED${C.n} — merge confidence ${C.b}${s.overall}${C.n}/100. Clear to ship.\n\n`);
    process.exit(0);
  }

  process.stdout.write(`  ${C.r}${C.b}❌ GATE FAILED${C.n} — ${violations.length} check(s) below the bar:\n`);
  for (const v of violations) {
    if (v.type === 'threshold') process.stdout.write(`  ${C.r}  ✗${C.n} ${CATEGORY_LABELS[v.category] || v.category} ${v.score}/100 < min ${v.threshold}\n`);
    else if (v.type === 'hard-fail' && v.rule === 'leaked-secrets') process.stdout.write(`  ${C.r}  ✗${C.n} ${v.count} leaked secret(s) detected (hard fail)\n`);
    else if (v.type === 'hard-fail' && v.rule === 'critical-findings') process.stdout.write(`  ${C.r}  ✗${C.n} ${v.count} critical finding(s): ${(v.examples || []).join(', ')} (hard fail)\n`);
    else if (v.type === 'skipped') process.stdout.write(`  ${C.r}  ✗${C.n} ${CATEGORY_LABELS[v.category] || v.category} did not run (skipMissing=false)\n`);
  }
  process.stdout.write(`\n  ${C.d}Fix the issues (try /ship for details, or /a11y /secure /seo to auto-fix) and re-run.${C.n}\n\n`);
  process.exit(1);
}

// ── init: write default config ──
function initConfig(dir, force) {
  const resolvedDir = resolve(dir);
  const outDir = join(resolvedDir, '.ultraship');
  const p = join(outDir, 'ship-gate.json');
  if (existsSync(p) && !force) {
    fail(`Config already exists at ${p}. Use --force to overwrite.`);
    return;
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { mode: 0o700, recursive: true });
  writeFileSync(p, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify({ written: p, config: DEFAULT_CONFIG }, null, 2) + '\n');
}

// ── ci: write GitHub Actions workflow ──
const CI_WORKFLOW = `name: Ship Gate

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  ship-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      # Fails the build if the project is below the thresholds in .ultraship/ship-gate.json
      - run: npx --yes ultraship ship-gate .
`;

function writeCi(dir) {
  const resolvedDir = resolve(dir);
  const outDir = join(resolvedDir, '.github', 'workflows');
  const p = join(outDir, 'ship-gate.yml');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(p, CI_WORKFLOW, { mode: 0o644 });
  process.stdout.write(JSON.stringify({ written: p }, null, 2) + '\n');
}

// ── hook: write git pre-push hook ──
const PRE_PUSH = `#!/bin/sh
# Ultraship ship-gate — blocks the push if the quality gate fails.
# Remove this file or edit .ultraship/ship-gate.json to adjust.
exec npx --yes ultraship ship-gate .
`;

function writeHook(dir) {
  const resolvedDir = resolve(dir);
  const hooksDir = join(resolvedDir, '.git', 'hooks');
  if (!existsSync(join(resolvedDir, '.git'))) {
    fail('Not a git repository (no .git directory) — run `git init` first, or use the CI workflow instead.');
    return;
  }
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  const p = join(hooksDir, 'pre-push');
  writeFileSync(p, PRE_PUSH, { mode: 0o755 });
  process.stdout.write(JSON.stringify({ written: p, note: 'Push is now gated. Bypass once with: git push --no-verify' }, null, 2) + '\n');
}

// ── dispatch ──
const argv = process.argv.slice(2);
let sub = 'run';
let rest = argv;
if (argv[0] && SUBCOMMANDS.has(argv[0])) {
  sub = argv[0];
  rest = argv.slice(1);
}
const flags = new Set(rest.filter(a => a.startsWith('--')));
const positional = rest.filter(a => !a.startsWith('--'));
const dir = positional[0] || '.';

switch (sub) {
  case 'init': initConfig(dir, flags.has('--force')); break;
  case 'ci': writeCi(dir); break;
  case 'hook': writeHook(dir); break;
  case 'run':
  default: runGate(dir, flags.has('--json')); break;
}
