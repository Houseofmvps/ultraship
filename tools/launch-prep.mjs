#!/usr/bin/env node
// tools/launch-prep.mjs
// Launch Day Autopilot — generates launch copy, checklist, and press kit
// Usage: node tools/launch-prep.mjs <project-directory> [--url=<production-url>]
// Safe: reads files only, optional HTTP GET for URL validation

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execFileSync } from 'child_process';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage', '.output']);

function walkFiles(dir, exts = CODE_EXTS, maxFiles = 500) {
  const files = [];
  function walk(d, depth) {
    if (depth > 8 || files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= maxFiles) return;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (exts.has(extname(e.name))) files.push(full);
    }
  }
  walk(dir, 0);
  return files;
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function gitCmd(args, dir) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 }).trim(); } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Tech stack detection from package.json
// ---------------------------------------------------------------------------
function detectStack(pkg) {
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const stack = [];
  if (all.react || all['react-dom']) stack.push('React');
  if (all.next) stack.push('Next.js');
  if (all.vue) stack.push('Vue');
  if (all.nuxt) stack.push('Nuxt');
  if (all.svelte) stack.push('Svelte');
  if (all.hono) stack.push('Hono');
  if (all.express) stack.push('Express');
  if (all.fastify) stack.push('Fastify');
  if (all.tailwindcss) stack.push('Tailwind CSS');
  if (all['drizzle-orm']) stack.push('Drizzle ORM');
  if (all.prisma || all['@prisma/client']) stack.push('Prisma');
  if (all.pg || all.postgres) stack.push('PostgreSQL');
  if (all.mysql2) stack.push('MySQL');
  if (all.redis || all.ioredis) stack.push('Redis');
  if (all.bullmq) stack.push('BullMQ');
  if (all.resend) stack.push('Resend');
  if (all.stripe) stack.push('Stripe');
  if (all.typescript) stack.push('TypeScript');
  if (all.vite) stack.push('Vite');
  if (all.webpack) stack.push('webpack');
  return stack;
}

// ---------------------------------------------------------------------------
// HTML analysis
// ---------------------------------------------------------------------------
function findHTML(dir) {
  const candidates = ['index.html', 'public/index.html', 'dist/index.html', 'src/index.html', 'app/layout.tsx', 'app/page.tsx'];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function analyzeHTML(filePath) {
  if (!filePath) return { title: null, meta_description: false, og_complete: false, favicon: false, analytics: false };
  const sc = checkFileSize(filePath, statSync);
  if (!sc.ok) return { title: null, meta_description: false, og_complete: false, favicon: false, analytics: false };
  const body = readFileSync(filePath, 'utf8');
  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    meta_description: /<meta[^>]*name=["']description["']/i.test(body),
    og_complete: /<meta[^>]*property=["']og:title["']/i.test(body) && /<meta[^>]*property=["']og:image["']/i.test(body),
    favicon: /favicon/i.test(body) || existsSync(join(filePath, '..', 'favicon.ico')),
    analytics: /gtag|plausible|posthog|mixpanel|amplitude/i.test(body),
  };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------
function buildChecklist(dir, pkg, html) {
  const items = [];
  const check = (category, item, pass, detail) => items.push({ category, item, status: pass ? 'pass' : 'fail', detail });
  // warn helper available for future use

  // SEO
  check('seo', 'Meta description set', html.meta_description, html.meta_description ? 'Found' : 'Missing — add <meta name="description">');
  check('seo', 'OG tags complete', html.og_complete, html.og_complete ? 'og:title and og:image found' : 'Missing og:title or og:image');
  check('seo', 'Favicon present', existsSync(join(dir, 'public', 'favicon.ico')) || existsSync(join(dir, 'app', 'favicon.ico')) || html.favicon, 'Check public/ or app/ directory');
  check('seo', 'Sitemap.xml exists', existsSync(join(dir, 'public', 'sitemap.xml')) || existsSync(join(dir, 'dist', 'sitemap.xml')), 'Run /seo to generate');
  check('seo', 'robots.txt exists', existsSync(join(dir, 'public', 'robots.txt')) || existsSync(join(dir, 'dist', 'robots.txt')), 'Run /seo to generate');

  // Analytics
  check('analytics', 'Analytics installed', html.analytics, html.analytics ? 'Detected in HTML' : 'No analytics found — add GA, Plausible, or PostHog');

  // Legal
  const allFiles = walkFiles(dir, new Set(['.tsx', '.ts', '.jsx', '.js', '.html', '.md']), 200).map(f => f.toLowerCase());
  const hasPrivacy = allFiles.some(f => /privacy/i.test(f));
  const hasTerms = allFiles.some(f => /terms/i.test(f));
  check('legal', 'Privacy policy page', hasPrivacy, hasPrivacy ? 'Found' : 'Consider adding /privacy');
  check('legal', 'Terms of service page', hasTerms, hasTerms ? 'Found' : 'Consider adding /terms');

  // Brand
  const readme = existsSync(join(dir, 'README.md'));
  const license = existsSync(join(dir, 'LICENSE')) || existsSync(join(dir, 'LICENSE.md'));
  check('brand', 'README has description', readme && pkg?.description, pkg?.description ? `"${pkg.description}"` : 'Missing description in package.json');
  check('brand', 'Repository has license', license, license ? 'Found' : 'Add a LICENSE file');

  // Technical
  const codeFiles = walkFiles(dir, CODE_EXTS, 300);
  let consoleCount = 0;
  let todoCount = 0;
  for (const f of codeFiles) {
    if (/\.(test|spec)\./i.test(f) || /__tests__/i.test(f)) continue;
    const sc = checkFileSize(f, statSync);
    if (!sc.ok) continue;
    try {
      const c = readFileSync(f, 'utf8');
      const cls = (c.match(/console\.(log|debug)\(/g) || []).length;
      const tds = (c.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
      consoleCount += cls;
      todoCount += tds;
    } catch {}
  }
  check('technical', 'No console.log in prod code', consoleCount === 0, consoleCount > 0 ? `Found ${consoleCount} console.log/debug statements` : 'Clean');
  check('technical', 'No TODO comments', todoCount === 0, todoCount > 0 ? `Found ${todoCount} TODO/FIXME comments` : 'Clean');
  check('technical', '.env.example exists', existsSync(join(dir, '.env.example')), 'Documents required environment variables');
  const hasErrorHandling = codeFiles.some(f => { try { return /catch\s*\(/.test(readFileSync(f, 'utf8')); } catch { return false; } });
  check('technical', 'Error handling present', hasErrorHandling, hasErrorHandling ? 'Found try/catch blocks' : 'No error handling detected');

  const passCount = items.filter(i => i.status === 'pass').length;
  const failCount = items.filter(i => i.status === 'fail').length;
  const warnCount = items.filter(i => i.status === 'warn').length;

  return { items, pass_count: passCount, fail_count: failCount, warn_count: warnCount, ready: failCount <= 2 };
}

// ---------------------------------------------------------------------------
// Launch copy generation
// ---------------------------------------------------------------------------
function generateCopy(name, description, stack, homepage) {
  const stackStr = stack.slice(0, 4).join(', ');
  const tagline = description ? description.slice(0, 60) : `${name} — ship faster`;

  return {
    product_hunt: {
      tagline,
      description: `${name} ${description || 'helps you ship faster'}. Built with ${stackStr}. Try it now.`,
      first_comment: `Hey everyone! I built ${name} because I was frustrated with [pain point]. After [X] weeks of building, it's finally ready. ${description || ''} Would love your feedback — especially on [specific area]. Built with ${stackStr}.`,
    },
    twitter_thread: [
      `Launching ${name} today. ${description || 'Built for builders.'}`,
      `The problem: [What pain point does ${name} solve?]`,
      `What it does:\n- [Feature 1]\n- [Feature 2]\n- [Feature 3]\n- [Feature 4]`,
      `Built with ${stackStr}. The entire stack is optimized for [speed/reliability/simplicity].`,
      `Try it now: ${homepage || '[your-url]'}\n\nWould love your feedback. RT if this is useful.`,
    ],
    linkedin_post: `Excited to announce ${name} is now live!\n\n${description || '[What it does]'}\n\nAfter [X] weeks of building, I'm shipping this to solve [problem]. Built with ${stackStr}.\n\nKey highlights:\n- [Highlight 1]\n- [Highlight 2]\n- [Highlight 3]\n\nCheck it out: ${homepage || '[your-url]'}\n\n#buildinpublic #saas #launch`,
    hacker_news: {
      title: `Show HN: ${name} – ${tagline}`,
      text: `Hi HN,\n\nI built ${name} — ${description || '[description]'}.\n\nTech stack: ${stackStr}\n\nWhy I built this: [personal motivation]\n\nWhat makes it different: [unique value prop]\n\nWould appreciate any feedback. Happy to answer questions.\n\n${homepage || '[url]'}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const urlFlag = args.find(a => a.startsWith('--url='));
  const homepage = urlFlag ? urlFlag.replace('--url=', '') : null;

  if (!dir) {
    output({ error: 'Usage: node launch-prep.mjs <project-directory> [--url=<production-url>]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  try {
    // Read project info
    const pkg = readJSON(join(dir, 'package.json')) || {};
    const name = pkg.name || dir.split('/').pop();
    const description = pkg.description || null;
    const version = pkg.version || null;
    const repoUrl = pkg.repository?.url || pkg.repository || null;
    const pkgHomepage = homepage || pkg.homepage || null;

    // Tech stack
    const stack = detectStack(pkg);

    // Git info
    const commits = gitCmd(['rev-list', '--count', 'HEAD'], dir);
    const firstCommit = gitCmd(['log', '--reverse', '--format=%aI', '-1'], dir);
    const ageDays = firstCommit ? Math.floor((Date.now() - new Date(firstCommit).getTime()) / 86400000) : 0;

    // HTML analysis
    const htmlPath = findHTML(dir);
    const html = analyzeHTML(htmlPath);

    // Checklist
    const checklist = buildChecklist(dir, pkg, html);

    // Launch copy
    const launchCopy = generateCopy(name, description, stack, pkgHomepage);

    // Press kit
    const pressKit = {
      one_liner: description || `${name} — [one-line description]`,
      elevator_pitch: `${name} ${description || 'solves [problem]'}. Built with ${stack.slice(0, 3).join(', ')}. Designed for [target audience].`,
      tech_highlights: stack.map(s => `Built with ${s}`).slice(0, 5),
      key_features: ['[Feature 1]', '[Feature 2]', '[Feature 3]'],
    };

    output({
      success: true,
      project: { name, description, version, tech_stack: stack, repo_url: repoUrl, homepage: pkgHomepage, commits: parseInt(commits) || 0, age_days: ageDays },
      launch_copy: launchCopy,
      launch_checklist: checklist,
      press_kit: pressKit,
    });
  } catch (err) {
    output({ error: err.message, success: false });
  }

  process.exit(0);
}

main();
