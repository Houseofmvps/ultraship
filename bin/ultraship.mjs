#!/usr/bin/env node
// Ultraship standalone CLI — run audits without Claude Code
// Usage: npx ultraship <command> [path]

import { execFileSync, execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, '..', 'tools');

// ANSI colors
const C = {
  red: '\x1b[1;31m', green: '\x1b[1;32m', yellow: '\x1b[1;33m',
  blue: '\x1b[1;34m', magenta: '\x1b[1;35m', cyan: '\x1b[1;36m',
  white: '\x1b[1;37m', dim: '\x1b[2m', bold: '\x1b[1m', nc: '\x1b[0m',
};

const COMMANDS = {
  ship: { desc: 'Full pre-deploy audit + scorecard' },
  init: { desc: 'Scaffold CLAUDE.md for your project' },
  seo: { tool: 'seo-scanner.mjs', desc: 'Run SEO audit + AI visibility checks' },
  security: { tool: 'secret-scanner.mjs', desc: 'Scan for leaked secrets' },
  perf: { tool: 'bundle-tracker.mjs', desc: 'Analyze bundle size' },
  health: { tool: 'health-check.mjs', desc: 'Check production URL health' },
  content: { tool: 'content-scorer.mjs', desc: 'Score content quality' },
  env: { tool: 'env-validator.mjs', desc: 'Validate environment variables' },
  deps: { tool: 'dep-doctor.mjs', desc: 'Find unused/outdated dependencies' },
  og: { tool: 'og-validator.mjs', desc: 'Validate Open Graph tags' },
  redirects: { tool: 'redirect-checker.mjs', desc: 'Check redirect chains' },
  profile: { tool: 'code-profiler.mjs', desc: 'Find performance anti-patterns' },
  migrations: { tool: 'migration-checker.mjs', desc: 'Check pending migrations' },
  compete: { tool: 'compete-analyzer.mjs', desc: 'Competitive X-Ray (2 URLs)' },
  launch: { tool: 'launch-prep.mjs', desc: 'Launch day preparation' },
  rescue: { tool: 'incident-commander.mjs', desc: 'Production incident diagnostics' },
  grow: { tool: 'growth-tracker.mjs', desc: 'Post-ship growth metrics' },
  cost: { tool: 'cost-tracker.mjs', desc: 'AI build cost tracking' },
  onboard: { tool: 'onboard-generator.mjs', desc: 'Generate onboarding guide' },
  architecture: { tool: 'architecture-mapper.mjs', desc: 'Generate architecture diagrams' },
  patterns: { tool: 'pattern-analyzer.mjs', desc: 'Analyze codebase patterns' },
  demo: { tool: 'demo-prep.mjs', desc: 'Demo readiness check' },
  codex: { tool: 'codex-generator.mjs', desc: 'Generate compact codebase index (saves tokens)' },
};

const args = process.argv.slice(2);
const command = args[0];
const target = args[1] || process.cwd();

function getVersion() {
  return JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;
}

function printHelp() {
  console.log(`
  ${C.cyan}${C.bold}ultraship${C.nc} v${getVersion()} — Ship production-ready SaaS

  Usage: ultraship <command> [path|url]

  ${C.bold}Commands:${C.nc}`);
  for (const [name, { desc }] of Object.entries(COMMANDS)) {
    console.log(`    ${C.green}${name.padEnd(14)}${C.nc} ${desc}`);
  }
  console.log(`    ${C.dim}version${C.nc}        Show version
    ${C.dim}help${C.nc}           Show this help

  ${C.bold}Examples:${C.nc}
    ultraship ship .                   Full audit with scorecard
    ultraship init                     Scaffold CLAUDE.md
    ultraship seo .                    SEO + AI Visibility audit
    ultraship security ./my-project    Scan for leaked secrets
    ultraship health https://myapp.com Check production health

  ${C.bold}Full plugin:${C.nc} claude plugin marketplace add Houseofmvps/ultraship && claude plugin install ultraship
  ${C.dim}https://github.com/Houseofmvps/ultraship${C.nc}
`);
}

// ── Run tool async (returns promise) ──
function runToolAsync(toolFile, dir) {
  return new Promise((res) => {
    execFile('node', [join(TOOLS_DIR, toolFile), dir], {
      encoding: 'utf8', timeout: 60000,
    }, (err, stdout) => {
      if (err && err.killed) {
        // Tool timed out
        res({ _error: `${toolFile} timed out (>60s)`, _failed: true, findings: [] });
        return;
      }
      const raw = stdout || (err && err.stdout) || '';
      if (!raw.trim()) {
        // Tool produced no output (crashed)
        res({ _error: `${toolFile} produced no output`, _failed: true, findings: [] });
        return;
      }
      try {
        res(JSON.parse(raw));
      } catch {
        res({ _error: `${toolFile} returned invalid JSON`, _failed: true, findings: [] });
      }
    });
  });
}

// ── /ship: the scorecard ──
async function runShip(dir) {
  const resolvedDir = resolve(dir);
  if (!existsSync(resolvedDir)) {
    console.error(`\n  ${C.red}${C.bold}Error:${C.nc} Directory not found: ${resolvedDir}\n`);
    process.exit(1);
  }
  console.log(`\n  ${C.cyan}${C.bold}⚡ ULTRASHIP${C.nc} ${C.dim}v${getVersion()}${C.nc}`);
  console.log(`  ${C.dim}Scanning: ${resolvedDir}${C.nc}`);
  console.log(`  ${C.dim}${'─'.repeat(45)}${C.nc}\n`);

  // Run all audits in parallel
  const [seo, secrets, profile, deps, bundle] = await Promise.all([
    runToolAsync('seo-scanner.mjs', resolvedDir),
    runToolAsync('secret-scanner.mjs', resolvedDir),
    runToolAsync('code-profiler.mjs', resolvedDir),
    runToolAsync('dep-doctor.mjs', resolvedDir),
    runToolAsync('bundle-tracker.mjs', resolvedDir),
  ]);

  // Count total findings for status lines
  const totalFindings = (seo?.findings?.length || 0) + (secrets?.findings?.length || 0) +
    (profile?.findings?.length || 0) + (deps?.unused?.length || 0) + (deps?.outdated?.length || 0);

  // Detect if SEO was skipped (backend project or no HTML files)
  const seoWasSkipped = seo?.skipped || seo?.scores?.seo === null;

  // Completed audit names
  const auditNames = [];
  if (!seo?._failed && !seoWasSkipped) auditNames.push('SEO');
  if (!bundle?._failed) auditNames.push('Perf');
  if (!secrets?._failed) auditNames.push('Security');
  if (!profile?._failed || !deps?._failed) auditNames.push('Quality');

  // Status lines (gif-style)
  console.log(`  ${C.yellow}▸ Scanning...${C.nc}        ${totalFindings > 0 ? `${C.red}${C.bold}${totalFindings} issues found${C.nc}` : `${C.green}${C.bold}0 issues found${C.nc}`}`);
  console.log(`  ${C.green}▸ Analyzing...${C.nc}       ${C.green}${auditNames.length} categories scored ${C.bold}✓${C.nc}`);
  console.log(`  ${C.magenta}▸ ${auditNames.length} audits complete${C.nc}   ${auditNames.join(` ${C.dim}·${C.nc} `)}\n`);

  // Track which audits failed
  const failures = [];
  if (seo?._failed) failures.push(`SEO: ${seo._error}`);
  if (secrets?._failed) failures.push(`Security: ${secrets._error}`);
  if (profile?._failed) failures.push(`Code Quality: ${profile._error}`);
  if (deps?._failed) failures.push(`Dependencies: ${deps._error}`);
  if (bundle?._failed) failures.push(`Bundle: ${bundle._error}`);

  // Calculate scores — failed tools return null (excluded from overall)
  function calcFindingsScore(data, deductionMap, dedupeByRule = false) {
    if (!data || data._failed) return null;
    if (!data.findings) return 100;
    let deductions = 0;
    if (dedupeByRule) {
      // SEO: same rule on N pages = one deduction (it's one fix, not N fixes)
      const seenRules = new Set();
      for (const f of data.findings) {
        const ruleKey = f.rule || f.category || f.message;
        if (!seenRules.has(ruleKey)) {
          seenRules.add(ruleKey);
          deductions += deductionMap[f.severity] || 0;
        }
      }
    } else {
      for (const f of data.findings) {
        deductions += deductionMap[f.severity] || 0;
      }
    }
    return Math.max(0, 100 - deductions);
  }

  // SEO: if scanner returned skipped (backend project) or null scores, propagate null
  const seoScore = seoWasSkipped ? null : calcFindingsScore(seo, { critical: 5, high: 3, medium: 1, low: 0 }, true);
  // Security: leaked secrets are severe
  const securityScore = calcFindingsScore(secrets, { critical: 15, high: 10, medium: 5 });

  // Code Quality: profiler findings + dep-doctor findings combined
  // Deduplicate: same category in same file = one deduction
  function calcQualityScore(profileData, depsData) {
    let deductions = 0;
    // Profiler findings (N+1, sync I/O, memory leaks, etc.)
    if (profileData && !profileData._failed && profileData.findings) {
      const seenCatFile = new Set();
      for (const f of profileData.findings) {
        const key = `${f.category}:${f.file}`;
        const first = !seenCatFile.has(key);
        seenCatFile.add(key);
        const mult = first ? 1 : 0.5;
        if (f.severity === 'high') deductions += 5 * mult;
        else if (f.severity === 'medium') deductions += 2 * mult;
        else deductions += 0.5 * mult;
      }
    } else if (!profileData || profileData._failed) {
      return null;
    }
    // Dep-doctor: unused deps and outdated deps
    if (depsData && !depsData._failed) {
      const unusedList = depsData.unused || [];
      const outdated = depsData.outdated?.length || 0;
      for (const u of unusedList) {
        if (u.severity === 'high') deductions += 3;
        else deductions += 1;
      }
      deductions += outdated * 1;
    }
    return Math.max(0, Math.round(100 - deductions));
  }
  const qualityScore = calcQualityScore(profile, deps);

  // Bundle: size + heavy dependency detection
  function calcBundleScore(data) {
    if (!data || data._failed) return null;
    if (!data.success) return 100; // no build output = nothing to check
    const heavyDeps = data.dependencies?.heavy_deps?.length || data.heavy_dependencies?.length || 0;
    const totalBytes = data.bundle?.total_bytes || data.total_size || 0;
    const totalMB = totalBytes / (1024 * 1024);
    let deductions = heavyDeps * 8;
    if (totalMB > 5) deductions += 15;
    else if (totalMB > 2) deductions += 8;
    return Math.max(0, 100 - deductions);
  }
  const bundleScore = calcBundleScore(bundle);

  // Calculate overall — only from audits that actually ran
  const scores = [seoScore, securityScore, qualityScore, bundleScore].filter(s => s !== null);
  const overall = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const hasFailures = failures.length > 0;

  function bar(score) {
    const filled = Math.round(score / 100 * 12);
    return '█'.repeat(filled) + '░'.repeat(12 - filled);
  }

  function scoreColor(score) {
    if (score >= 80) return C.green;
    if (score >= 60) return C.yellow;
    return C.red;
  }

  function printRow(label, score, skipped = false) {
    if (score === null && skipped) {
      console.log(`  ${C.white}${C.bold}║${C.nc}  ${label.padEnd(16)} ${C.dim}N/A${C.nc}        ${C.dim}${'·'.repeat(12)}${C.nc}  ${C.white}${C.bold}║${C.nc}`);
      return;
    }
    if (score === null) {
      console.log(`  ${C.white}${C.bold}║${C.nc}  ${label.padEnd(16)} ${C.red}${C.bold}FAIL${C.nc}       ${C.red}${'░'.repeat(12)}${C.nc}  ${C.white}${C.bold}║${C.nc}`);
      return;
    }
    const c = scoreColor(score);
    console.log(`  ${C.white}${C.bold}║${C.nc}  ${label.padEnd(16)} ${c}${C.bold}${String(score).padStart(3)}${C.nc}/100  ${c}${bar(score)}${C.nc}  ${C.white}${C.bold}║${C.nc}`);
  }

  // If any audit failed, never show READY TO SHIP
  const status = !hasFailures && overall >= 80;
  const statusText = hasFailures
    ? `${C.red}${C.bold}⚠  INCOMPLETE${C.nc}`
    : status
      ? `${C.green}${C.bold}✅ READY TO SHIP${C.nc}`
      : `${C.red}${C.bold}❌ NOT READY${C.nc}`;

  console.log(`  ${C.white}${C.bold}╔══════════════════════════════════════════╗${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}      ${C.cyan}${C.bold}U L T R A S H I P   S C O R E${C.nc}       ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}╠══════════════════════════════════════════╣${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}                                          ${C.white}${C.bold}║${C.nc}`);
  printRow('SEO + AI Visibility', seoScore, seoWasSkipped);
  printRow('Performance', bundleScore);
  printRow('Security', securityScore);
  printRow('Code Quality', qualityScore);
  console.log(`  ${C.white}${C.bold}║${C.nc}                                          ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}╠══════════════════════════════════════════╣${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}                                          ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}   OVERALL        ${scoreColor(overall)}${C.bold}${String(overall).padStart(3)}${C.nc}/100                 ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}   STATUS         ${statusText}       ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}                                          ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}╠══════════════════════════════════════════╣${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}  ${C.green}✓ Scanned:${C.nc} ${scores.length}/4 audits completed        ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}║${C.nc}  ${C.yellow}● Todo:${C.nc}    ${String(totalFindings).padEnd(3)} manual items remaining   ${C.white}${C.bold}║${C.nc}`);
  console.log(`  ${C.white}${C.bold}╚══════════════════════════════════════════╝${C.nc}`);

  if (hasFailures) {
    console.log(`\n  ${C.red}${C.bold}Audits that failed to run:${C.nc}`);
    for (const f of failures) {
      console.log(`  ${C.red}  ✗ ${f}${C.nc}`);
    }
    console.log(`  ${C.dim}Re-run to retry. Score is based on ${scores.length} of 4 audits.${C.nc}`);
  }

  // Show top findings so the scorecard is actionable
  const allFindings = [
    ...(seo?.findings || []).map(f => ({ ...f, audit: 'SEO' })),
    ...(secrets?.findings || []).map(f => ({ ...f, audit: 'Security' })),
    ...(profile?.findings || []).map(f => ({ ...f, audit: 'Quality' })),
    ...(deps?.unused || []).map(u => ({ file: u.package || u.name, severity: u.severity || 'medium', message: `Unused dependency: ${u.package || u.name}`, audit: 'Quality' })),
  ];
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));
  const topFindings = allFindings.slice(0, 8);

  if (topFindings.length > 0) {
    console.log(`\n  ${C.bold}Top issues:${C.nc}`);
    for (const f of topFindings) {
      const sevColor = f.severity === 'critical' || f.severity === 'high' ? C.red : C.yellow;
      const loc = f.file ? `${C.dim}${f.file}${f.line ? `:${f.line}` : ''}${C.nc} ` : '';
      console.log(`  ${sevColor}${f.severity.padEnd(8)}${C.nc} ${loc}${f.message}`);
    }
    if (allFindings.length > 8) {
      console.log(`  ${C.dim}...and ${allFindings.length - 8} more. Run individual commands for full details.${C.nc}`);
    }
  }

  // Contextual tagline — only say "Ship it" when it's actually ready
  if (status) {
    console.log(`\n  ${C.green}${C.bold}Ship it.${C.nc} One command. Production-ready.\n`);
  } else if (hasFailures) {
    console.log(`\n  ${C.yellow}${C.bold}Fix failing audits and re-run.${C.nc}\n`);
  } else {
    console.log(`\n  ${C.yellow}${C.bold}Fix the issues above and re-run /ship.${C.nc}\n`);
  }

  // Always exit 0 — the scorecard ran successfully.
  // Low scores are not errors. Exit 1 is reserved for actual failures (bad paths, crashes).
  process.exit(0);
}

// ── /init: scaffold CLAUDE.md ──
function runInit(dir) {
  const resolvedDir = resolve(dir);
  const claudeMd = join(resolvedDir, 'CLAUDE.md');

  if (existsSync(claudeMd)) {
    console.log(`\n  ${C.yellow}CLAUDE.md already exists${C.nc} at ${claudeMd}`);
    console.log(`  ${C.dim}Edit it manually, or use /revise-claude-md if you have the Ultraship plugin installed.${C.nc}\n`);
    process.exit(0);
  }

  // Detect project
  let projectName = 'My Project';
  let stack = [];
  let packageManager = 'npm';

  const pkgPath = join(resolvedDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      projectName = pkg.name || projectName;
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (allDeps.next) stack.push('Next.js');
      else if (allDeps.react) stack.push('React');
      else if (allDeps.vue) stack.push('Vue');
      else if (allDeps.svelte || allDeps['@sveltejs/kit']) stack.push('Svelte');
      if (allDeps.express) stack.push('Express');
      if (allDeps.hono) stack.push('Hono');
      if (allDeps.fastify) stack.push('Fastify');
      if (allDeps.typescript) stack.push('TypeScript');
      if (allDeps.tailwindcss) stack.push('Tailwind CSS');
      if (allDeps.drizzle || allDeps['drizzle-orm']) stack.push('Drizzle ORM');
      if (allDeps.prisma || allDeps['@prisma/client']) stack.push('Prisma');
      if (allDeps.vite) stack.push('Vite');
    } catch {}
  }

  if (existsSync(join(resolvedDir, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (existsSync(join(resolvedDir, 'yarn.lock'))) packageManager = 'yarn';
  else if (existsSync(join(resolvedDir, 'bun.lockb'))) packageManager = 'bun';

  // Detect monorepo
  const isMonorepo = existsSync(join(resolvedDir, 'pnpm-workspace.yaml')) ||
    existsSync(join(resolvedDir, 'lerna.json'));

  // Detect test runner
  let testRunner = '';
  const pkgCheck = existsSync(pkgPath) ? readFileSync(pkgPath, 'utf8') : '';
  if (pkgCheck.includes('vitest')) testRunner = 'vitest';
  else if (pkgCheck.includes('jest')) testRunner = 'jest';
  else if (pkgCheck.includes('"test"')) testRunner = `${packageManager} test`;

  // Generate CLAUDE.md
  const lines = [
    `# ${projectName}`,
    '',
    '## Project Structure',
    '',
    `- Package manager: ${packageManager}`,
  ];

  if (stack.length) lines.push(`- Stack: ${stack.join(', ')}`);
  if (isMonorepo) lines.push('- Monorepo: yes');
  if (testRunner) lines.push(`- Tests: \`${testRunner}\``);

  lines.push('', '## Conventions', '', '- [Add your coding conventions here]');
  lines.push('', '## Commands', '');

  if (testRunner) lines.push(`- Run tests: \`${testRunner}\``);
  lines.push(`- Install deps: \`${packageManager} install\``);

  const devScript = pkgCheck.includes('"dev"');
  const buildScript = pkgCheck.includes('"build"');
  if (devScript) lines.push(`- Dev server: \`${packageManager}${packageManager === 'npm' ? ' run' : ''} dev\``);
  if (buildScript) lines.push(`- Build: \`${packageManager}${packageManager === 'npm' ? ' run' : ''} build\``);

  lines.push('', '## Key Files', '', '- [Add important files and their purpose]');
  lines.push('');

  writeFileSync(claudeMd, lines.join('\n'));

  console.log(`\n  ${C.green}${C.bold}✓ Created CLAUDE.md${C.nc} for ${C.cyan}${projectName}${C.nc}`);
  console.log(`  ${C.dim}Detected: ${stack.join(', ') || 'no frameworks'} · ${packageManager}${isMonorepo ? ' · monorepo' : ''}${C.nc}`);
  console.log(`\n  ${C.dim}Edit CLAUDE.md to add your conventions, then Claude Code will follow them.${C.nc}\n`);
}

// ── Routing ──

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === 'version' || command === '--version' || command === '-v') {
  console.log(`ultraship v${getVersion()}`);
  process.exit(0);
}

if (command === 'ship') {
  runShip(target);
} else if (command === 'init') {
  runInit(target);
} else {
  const cmd = COMMANDS[command];
  if (!cmd || !cmd.tool) {
    console.error(`Unknown command: ${command}\nRun "ultraship help" for available commands.`);
    process.exit(1);
  }

  // Commands that require a URL, not a directory path
  const URL_COMMANDS = new Set(['health', 'redirects', 'compete']);
  if (URL_COMMANDS.has(command) && !target.startsWith('http')) {
    // health with no explicit arg defaults to CWD — that's wrong
    if (!args[1]) {
      console.error(`Error: ${command} requires a URL.\nUsage: ultraship ${command} https://yourapp.com`);
    } else {
      console.error(`Error: ${command} requires a URL, not a directory path.\nUsage: ultraship ${command} https://yourapp.com`);
    }
    process.exit(1);
  }

  const toolPath = join(TOOLS_DIR, cmd.tool);
  const resolvedTarget = target.startsWith('http') ? target : resolve(target);

  // Validate directory exists for non-URL targets
  if (!target.startsWith('http') && !existsSync(resolvedTarget)) {
    console.error(`Error: Path not found: ${resolvedTarget}`);
    process.exit(1);
  }

  try {
    const output = execFileSync('node', [toolPath, resolvedTarget], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000,
    });
    try {
      console.log(JSON.stringify(JSON.parse(output), null, 2));
    } catch {
      process.stdout.write(output);
    }
  } catch (err) {
    if (err.stdout) {
      try { console.log(JSON.stringify(JSON.parse(err.stdout), null, 2)); }
      catch { process.stdout.write(err.stdout); }
    }
    if (err.stderr) process.stderr.write(err.stderr);
    process.exit(err.status || 1);
  }
}
