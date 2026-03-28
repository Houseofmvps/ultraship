#!/usr/bin/env node
// tools/demo-prep.mjs
// Demo-Ready Mode — checks and prepares a project for demos and screenshots
// Usage: node tools/demo-prep.mjs <project-directory> [--check-only]
// Safe: reads files only, no network, no writes

import { readFileSync, existsSync, readdirSync, statSync as fStatSync } from 'fs';
import { join, extname, relative } from 'path';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const HTML_EXTS = new Set(['.html', '.htm']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage', '.output']);

function walkFiles(dir, exts = CODE_EXTS, maxFiles = 1000) {
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

// ---------------------------------------------------------------------------
// Seed data detection
// ---------------------------------------------------------------------------
function detectSeedData(dir) {
  const seedPaths = ['seed.ts', 'seed.js', 'prisma/seed.ts', 'prisma/seed.js', 'db/seed.ts', 'scripts/seed.ts', 'scripts/seed.js', 'src/seed.ts'];
  const found = seedPaths.filter(p => existsSync(join(dir, p)));
  const pkg = readJSON(join(dir, 'package.json'));
  const seedScript = pkg?.scripts?.['db:seed'] || pkg?.scripts?.seed || pkg?.prisma?.seed || null;
  const seedFiles = walkFiles(dir, CODE_EXTS, 200);
  const usesFaker = seedFiles.some(f => { try { return /faker|@faker-js/i.test(readFileSync(f, 'utf8')); } catch { return false; } });

  return { has_seed_file: found.length > 0, seed_command: seedScript || (found.length > 0 ? `npx tsx ${found[0]}` : null), seed_files: found, uses_faker: usesFaker };
}

// ---------------------------------------------------------------------------
// Dev artifacts detection
// ---------------------------------------------------------------------------
function detectDevArtifacts(dir) {
  const consoleLogs = [];
  const todoComments = [];
  const debugUI = [];
  const files = walkFiles(dir);

  for (const file of files) {
    const rel = relative(dir, file);
    if (/\.(test|spec)\./i.test(rel) || /__tests__/i.test(rel) || /seed/i.test(rel)) continue;

    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      // Console logs (skip console.error — often intentional)
      if (/console\.(log|debug|info|warn)\s*\(/.test(line)) {
        consoleLogs.push({ file: rel, line: ln, content: line.trim().slice(0, 100) });
      }

      // TODO/FIXME
      if (/\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(line)) {
        todoComments.push({ file: rel, line: ln, content: line.trim().slice(0, 100) });
      }

      // Debug UI patterns
      if (/isDev\s*&&|NODE_ENV.*development.*&&|__DEV__\s*&&/.test(line)) {
        debugUI.push({ file: rel, line: ln, pattern: line.trim().slice(0, 100) });
      }
    }
  }

  return { console_logs: consoleLogs.slice(0, 30), todo_comments: todoComments.slice(0, 30), debug_ui: debugUI.slice(0, 10), total_count: consoleLogs.length + todoComments.length + debugUI.length };
}

// ---------------------------------------------------------------------------
// Visual issues detection
// ---------------------------------------------------------------------------
function detectVisualIssues(dir) {
  const placeholderText = [];
  const placeholderPatterns = [/lorem ipsum/i, /placeholder\s+text/i, /example\.com/i, /foo@bar/i, /john@doe/i, /test@test/i, /jane\s+doe/i, /john\s+doe/i];

  const codeFiles = walkFiles(dir, new Set([...CODE_EXTS, ...HTML_EXTS]), 500);
  for (const file of codeFiles) {
    const rel = relative(dir, file);
    if (/\.(test|spec)\./i.test(rel) || /__tests__/i.test(rel) || /seed|mock|fixture/i.test(rel)) continue;
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of placeholderPatterns) {
        if (pattern.test(lines[i])) {
          placeholderText.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 100) });
          break;
        }
      }
    }
  }

  // Missing favicon
  const hasFavicon = existsSync(join(dir, 'public', 'favicon.ico')) || existsSync(join(dir, 'app', 'favicon.ico')) || existsSync(join(dir, 'src', 'favicon.ico')) || existsSync(join(dir, 'favicon.ico'));

  // Default branding
  const hasDefaultBranding = codeFiles.some(f => {
    try {
      const c = readFileSync(f, 'utf8');
      return /vite\.svg|react\.svg|Create React App|next\.js by vercel/i.test(c);
    } catch { return false; }
  });

  // Missing error pages
  const missing404 = !codeFiles.some(f => /404|not-found|notfound/i.test(f));
  const missing500 = !codeFiles.some(f => /500|error-page|server-error/i.test(f));
  const missingErrorPages = [];
  if (missing404) missingErrorPages.push('404');
  if (missing500) missingErrorPages.push('500');

  // Loading states
  const hasLoadingStates = codeFiles.some(f => {
    try { return /Suspense|loading\.(tsx|jsx)|skeleton|spinner|isLoading/i.test(readFileSync(f, 'utf8')); } catch { return false; }
  });

  return {
    placeholder_text: placeholderText.slice(0, 20),
    missing_favicon: !hasFavicon,
    default_branding: hasDefaultBranding,
    missing_error_pages: missingErrorPages,
    missing_loading_states: !hasLoadingStates,
    total_count: placeholderText.length + (!hasFavicon ? 1 : 0) + (hasDefaultBranding ? 1 : 0) + missingErrorPages.length + (!hasLoadingStates ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// Screenshot readiness
// ---------------------------------------------------------------------------
function checkScreenshotReadiness(dir) {
  const files = walkFiles(dir, new Set([...CODE_EXTS, ...HTML_EXTS]), 300);
  const hasLanding = files.some(f => /page\.(tsx|jsx)|index\.html|home/i.test(f));
  const emptyStates = [];

  for (const file of files.slice(0, 200)) {
    const rel = relative(dir, file);
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/no\s+data|nothing\s+here|get\s+started|no\s+results|empty/i.test(lines[i]) && /return|>/.test(lines[i])) {
        emptyStates.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 80) });
      }
    }
  }

  // Responsive viewport
  const htmlFiles = walkFiles(dir, HTML_EXTS, 10);
  const hasViewport = htmlFiles.some(f => { try { return /viewport/.test(readFileSync(f, 'utf8')); } catch { return false; } });

  return { has_landing_page: hasLanding, empty_states: emptyStates.slice(0, 10), has_responsive_viewport: hasViewport || files.some(f => /layout/i.test(f)) };
}

// ---------------------------------------------------------------------------
// Walkthrough generation
// ---------------------------------------------------------------------------
function generateWalkthrough(dir) {
  const files = walkFiles(dir, CODE_EXTS, 500);
  const routeRegex = /\b(?:app|router|server)\.(get|post)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  const detectedRoutes = new Set();

  // Detect routes
  for (const file of files) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    let match;
    routeRegex.lastIndex = 0;
    while ((match = routeRegex.exec(content)) !== null) {
      if (match[1].toUpperCase() === 'GET') detectedRoutes.add(match[2]);
    }
  }

  // Next.js/page-based routes
  const pagePatterns = ['app/page.tsx', 'app/dashboard/page.tsx', 'pages/index.tsx', 'pages/dashboard.tsx'];
  for (const p of pagePatterns) {
    if (existsSync(join(dir, p))) {
      const route = '/' + p.replace(/^(app|pages)\//, '').replace(/\/page\.tsx$/, '').replace(/\.tsx$/, '').replace(/\/index$/, '') || '/';
      detectedRoutes.add(route === '' ? '/' : route);
    }
  }

  detectedRoutes.add('/');

  const routes = [...detectedRoutes].slice(0, 10);
  const flow = routes.map((route, i) => ({
    step: i + 1,
    action: `${i === 0 ? 'Visit' : 'Navigate to'} ${route}`,
    screenshot: i < 4,
    notes: i === 0 ? 'Show landing page / hero section' : `Show ${route.replace('/', '').replace(/\//g, ' → ')} functionality`,
  }));

  return { detected_routes: routes, suggested_flow: flow, estimated_demo_time: `${Math.max(2, routes.length)}–${Math.max(3, routes.length + 2)} minutes` };
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------
function calculateScore(devArtifacts, visualIssues, seedData) {
  let score = 100;
  score -= Math.min(15, devArtifacts.console_logs.length * 3);
  score -= Math.min(10, devArtifacts.todo_comments.length * 2);
  score -= Math.min(15, visualIssues.placeholder_text.length * 5);
  if (visualIssues.missing_favicon) score -= 10;
  score -= visualIssues.missing_error_pages.length * 5;
  if (!seedData.has_seed_file) score -= 5;
  if (visualIssues.default_branding) score -= 5;
  if (visualIssues.missing_loading_states) score -= 5;
  return Math.max(0, score);
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------
function generateActionItems(devArtifacts, visualIssues, seedData) {
  const items = [];

  if (devArtifacts.console_logs.length > 0) {
    const files = [...new Set(devArtifacts.console_logs.map(c => c.file))];
    items.push({ priority: 'high', action: `Remove ${devArtifacts.console_logs.length} console.log statements from production code`, files: files.slice(0, 5) });
  }

  if (visualIssues.placeholder_text.length > 0) {
    const files = [...new Set(visualIssues.placeholder_text.map(p => p.file))];
    items.push({ priority: 'high', action: `Replace ${visualIssues.placeholder_text.length} placeholder text instances with real copy`, files: files.slice(0, 5) });
  }

  if (visualIssues.missing_favicon) {
    items.push({ priority: 'medium', action: 'Add favicon.ico to public/', files: [] });
  }

  for (const page of visualIssues.missing_error_pages) {
    items.push({ priority: 'medium', action: `Create custom ${page} error page`, files: [] });
  }

  if (devArtifacts.todo_comments.length > 0) {
    items.push({ priority: 'medium', action: `Resolve or remove ${devArtifacts.todo_comments.length} TODO/FIXME comments`, files: [...new Set(devArtifacts.todo_comments.map(t => t.file))].slice(0, 5) });
  }

  if (visualIssues.missing_loading_states) {
    items.push({ priority: 'low', action: 'Add loading states to async components', files: [] });
  }

  if (visualIssues.default_branding) {
    items.push({ priority: 'low', action: 'Remove default framework branding (Vite/React logos)', files: [] });
  }

  if (!seedData.has_seed_file) {
    items.push({ priority: 'low', action: 'Create seed data script for demo environment', files: [] });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const checkOnly = args.includes('--check-only');

  if (!dir) {
    output({ error: 'Usage: node demo-prep.mjs <project-directory> [--check-only]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  try {
    const seedData = detectSeedData(dir);
    const devArtifacts = detectDevArtifacts(dir);
    const visualIssues = detectVisualIssues(dir);
    const screenshotReadiness = checkScreenshotReadiness(dir);

    const score = calculateScore(devArtifacts, visualIssues, seedData);
    const status = score >= 90 ? 'demo_ready' : score >= 70 ? 'almost_ready' : 'needs_work';

    const result = {
      success: true,
      demo_readiness: { score, status },
      seed_data: seedData,
      dev_artifacts: devArtifacts,
      visual_issues: visualIssues,
      screenshot_readiness: screenshotReadiness,
    };

    if (!checkOnly) {
      result.walkthrough = generateWalkthrough(dir);
      result.action_items = generateActionItems(devArtifacts, visualIssues, seedData);
    }

    output(result);
  } catch (err) {
    output({ error: err.message, success: false });
  }

  process.exit(0);
}

main();
