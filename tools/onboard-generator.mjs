#!/usr/bin/env node
// tools/onboard-generator.mjs
// Instant Project Onboarding — generates a complete developer onboarding guide
// Usage: node tools/onboard-generator.mjs <project-directory>
// Safe: reads files and git history only, no writes, no network

import { readFileSync, existsSync, readdirSync, statSync as fStatSync } from 'fs';
import { join, extname, relative, basename } from 'path';
import { execFileSync } from 'child_process';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage', '.output', '__pycache__']);

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function gitCmd(args, dir) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 }).trim(); } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Directory tree (max 3 levels)
// ---------------------------------------------------------------------------
function buildTree(dir, maxDepth = 3, prefix = '') {
  const lines = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return lines; }
  const dirs = entries.filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'));
  const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'));

  const all = [...dirs, ...files.slice(0, 10)];
  all.forEach((e, i) => {
    const isLast = i === all.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    lines.push(prefix + connector + e.name + (e.isDirectory() ? '/' : ''));
    if (e.isDirectory() && maxDepth > 1) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      lines.push(...buildTree(join(dir, e.name), maxDepth - 1, newPrefix));
    }
  });
  if (files.length > 10) lines.push(prefix + `    ... and ${files.length - 10} more files`);
  return lines;
}

// ---------------------------------------------------------------------------
// Tech stack detection
// ---------------------------------------------------------------------------
function detectStack(pkg) {
  const all = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const stack = {
    runtime: 'Node.js', language: all.typescript ? 'TypeScript' : 'JavaScript',
    framework: null, database: null, orm: null, css: null, testing: null,
    bundler: null, package_manager: 'npm', deployment: [],
  };
  if (all.react) stack.framework = all.next ? 'Next.js' : 'React';
  else if (all.vue) stack.framework = all.nuxt ? 'Nuxt' : 'Vue';
  else if (all.svelte) stack.framework = 'Svelte';
  else if (all.hono) stack.framework = 'Hono';
  else if (all.express) stack.framework = 'Express';
  else if (all.fastify) stack.framework = 'Fastify';
  if (all.pg || all.postgres) stack.database = 'PostgreSQL';
  else if (all.mysql2) stack.database = 'MySQL';
  else if (all.mongodb || all.mongoose) stack.database = 'MongoDB';
  else if (all['better-sqlite3']) stack.database = 'SQLite';
  if (all['drizzle-orm']) stack.orm = 'Drizzle';
  else if (all.prisma || all['@prisma/client']) stack.orm = 'Prisma';
  else if (all.typeorm) stack.orm = 'TypeORM';
  else if (all.knex) stack.orm = 'Knex';
  if (all.tailwindcss) stack.css = 'Tailwind CSS';
  else if (all['styled-components']) stack.css = 'styled-components';
  if (all.vitest) stack.testing = 'Vitest';
  else if (all.jest) stack.testing = 'Jest';
  else if (all.mocha) stack.testing = 'Mocha';
  if (all.vite) stack.bundler = 'Vite';
  else if (all.webpack) stack.bundler = 'webpack';
  else if (all.esbuild) stack.bundler = 'esbuild';
  return stack;
}

// ---------------------------------------------------------------------------
// Route detection
// ---------------------------------------------------------------------------
function findRoutes(dir) {
  const routes = [];
  const files = [];
  function walk(d, depth) {
    if (depth > 6 || files.length > 500) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (CODE_EXTS.has(extname(e.name))) files.push(full);
    }
  }
  walk(dir, 0);

  const routeRegex = /\b(?:app|router|server|fastify)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  for (const file of files) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      routes.push({ method: match[1].toUpperCase(), path: match[2], file: relative(dir, file), line });
    }
  }
  return routes.slice(0, 50);
}

// ---------------------------------------------------------------------------
// Database detection
// ---------------------------------------------------------------------------
function detectDatabase(dir) {
  const db = { type: null, orm: null, schema_file: null, tables: [], migration_tool: null };

  // Prisma
  const prismaPath = join(dir, 'prisma', 'schema.prisma');
  if (existsSync(prismaPath)) {
    db.orm = 'Prisma';
    db.schema_file = 'prisma/schema.prisma';
    db.migration_tool = 'prisma migrate';
    try {
      const schema = readFileSync(prismaPath, 'utf8');
      const models = schema.match(/^model\s+(\w+)/gm);
      if (models) db.tables = models.map(m => m.replace('model ', ''));
      if (/postgresql/i.test(schema)) db.type = 'PostgreSQL';
      else if (/mysql/i.test(schema)) db.type = 'MySQL';
      else if (/sqlite/i.test(schema)) db.type = 'SQLite';
    } catch {}
  }

  // Drizzle
  const drizzlePatterns = ['src/db/schema.ts', 'src/schema.ts', 'db/schema.ts', 'src/db/schema/index.ts'];
  for (const p of drizzlePatterns) {
    const full = join(dir, p);
    if (existsSync(full)) {
      db.orm = 'Drizzle';
      db.schema_file = p;
      db.migration_tool = 'drizzle-kit';
      try {
        const content = readFileSync(full, 'utf8');
        const tables = content.match(/(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"`](\w+)['"`]/g);
        if (tables) db.tables = tables.map(t => t.match(/['"`](\w+)['"`]/)[1]);
        if (/pgTable/.test(content)) db.type = 'PostgreSQL';
        else if (/mysqlTable/.test(content)) db.type = 'MySQL';
        else if (/sqliteTable/.test(content)) db.type = 'SQLite';
      } catch {}
      break;
    }
  }

  return db.orm ? db : null;
}

// ---------------------------------------------------------------------------
// Env vars from .env.example
// ---------------------------------------------------------------------------
function parseEnvExample(dir) {
  const p = join(dir, '.env.example');
  if (!existsSync(p)) return [];
  try {
    return readFileSync(p, 'utf8').split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => {
        const [name, ...rest] = l.split('=');
        return { name: name.trim(), required: true, example: rest.join('=').trim() || '' };
      });
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Gotchas detection
// ---------------------------------------------------------------------------
function detectGotchas(dir) {
  const gotchas = [];
  if (existsSync(join(dir, '.env.example')) && !existsSync(join(dir, '.env')))
    gotchas.push({ severity: 'high', issue: 'No .env file found — copy .env.example and fill in values' });

  const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].filter(f => existsSync(join(dir, f)));
  if (lockFiles.length > 1)
    gotchas.push({ severity: 'medium', issue: `Multiple lock files found (${lockFiles.join(', ')}) — pick one package manager` });

  const pkg = readJSON(join(dir, 'package.json'));
  if (pkg && !pkg.scripts?.test)
    gotchas.push({ severity: 'low', issue: 'No test script defined in package.json' });

  let hasTsFiles = false;
  try { hasTsFiles = readdirSync(existsSync(join(dir, 'src')) ? join(dir, 'src') : dir).some(f => f.toString().endsWith('.ts')); } catch {}
  if (hasTsFiles && !existsSync(join(dir, 'tsconfig.json')))
    gotchas.push({ severity: 'medium', issue: 'TypeScript files detected but no tsconfig.json' });

  return gotchas;
}

// ---------------------------------------------------------------------------
// Mermaid diagram
// ---------------------------------------------------------------------------
function generateMermaid(stack, routes, db, dir) {
  let diagram = 'graph TD\n';

  if (stack.framework) {
    const isFullstack = ['Next.js', 'Nuxt', 'Remix'].includes(stack.framework);
    if (isFullstack) {
      diagram += `  Client[Browser] --> App[${stack.framework}]\n`;
      if (db) diagram += `  App --> DB[(${db.type || 'Database'})]\n`;
    } else if (['React', 'Vue', 'Svelte'].includes(stack.framework)) {
      diagram += `  Client[Browser] --> Frontend[${stack.framework}${stack.bundler ? ' + ' + stack.bundler : ''}]\n`;
      if (routes.length > 0) {
        const apiFramework = stack.framework === 'React' ? 'API' : 'Backend';
        diagram += `  Frontend --> API[${apiFramework}]\n`;
        if (db) diagram += `  API --> DB[(${db.type || 'Database'})]\n`;
      }
    } else {
      // Backend framework
      diagram += `  Client[Browser] --> API[${stack.framework} API]\n`;
      if (db) diagram += `  API --> DB[(${db.type || 'Database'})]\n`;
    }
  }

  // External services
  const pkg = readJSON(join(dir, 'package.json'));
  const deps = { ...(pkg?.dependencies || {}) };
  if (deps.redis || deps.ioredis) diagram += `  API --> Redis[(Redis)]\n`;
  if (deps.resend) diagram += `  API --> Email[Resend]\n`;
  if (deps.stripe) diagram += `  API --> Pay[Stripe]\n`;
  if (deps.bullmq) diagram += `  API --> Queue[BullMQ]\n`;

  return diagram;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const dir = process.argv[2];

  if (!dir) {
    output({ error: 'Usage: node onboard-generator.mjs <project-directory>', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  try {
    const pkg = readJSON(join(dir, 'package.json'));
    const stack = detectStack(pkg);

    // Detect package manager
    if (existsSync(join(dir, 'pnpm-lock.yaml'))) stack.package_manager = 'pnpm';
    else if (existsSync(join(dir, 'yarn.lock'))) stack.package_manager = 'yarn';

    // Architecture type
    let archType = 'single-app';
    if (pkg?.workspaces || existsSync(join(dir, 'pnpm-workspace.yaml'))) archType = 'monorepo';
    else if (existsSync(join(dir, 'apps'))) archType = 'monorepo';

    const tree = buildTree(dir).join('\n');
    const routes = findRoutes(dir);
    const db = detectDatabase(dir);
    const envVars = parseEnvExample(dir);
    const gotchas = detectGotchas(dir);

    // Key files
    const keyFiles = [];
    const candidates = [
      ['src/index.ts', 'Server entry point'], ['src/app.tsx', 'App component'], ['src/main.tsx', 'Frontend entry'],
      ['src/server.ts', 'Server entry'], ['app/layout.tsx', 'Root layout'], ['app/page.tsx', 'Homepage'],
      [db?.schema_file, 'Database schema'], ['src/middleware', 'Middleware directory'],
      ['src/routes', 'Route definitions'], ['src/lib', 'Shared utilities'],
    ];
    for (const [path, role] of candidates) {
      if (path && existsSync(join(dir, path))) keyFiles.push({ path, role });
    }

    // Recent decisions (git log)
    const recentLog = gitCmd(['log', '--format=%H|||%s|||%aI', '-10'], dir);
    const recentDecisions = recentLog ? recentLog.split('\n').filter(Boolean).map(l => {
      const [hash, message, date] = l.split('|||');
      return { date: date?.split('T')[0], message, hash: hash?.slice(0, 7) };
    }) : [];

    // Setup steps
    const pm = stack.package_manager;
    const setupSteps = [`${pm} install`];
    if (envVars.length > 0) setupSteps.push('cp .env.example .env', 'Fill in required environment variables');
    if (db?.migration_tool) setupSteps.push(`${pm === 'npm' ? 'npx' : pm} ${db.migration_tool} push`);
    if (pkg?.scripts?.dev) setupSteps.push(`${pm} ${pm === 'npm' ? 'run ' : ''}dev`);

    const mermaid = generateMermaid(stack, routes, db, dir);

    // Prerequisites
    const prereqs = ['Node.js 18+', stack.package_manager];
    if (db?.type) prereqs.push(db.type);
    if (existsSync(join(dir, 'Dockerfile'))) prereqs.push('Docker');

    output({
      success: true,
      project: { name: pkg?.name || basename(dir), description: pkg?.description || null, version: pkg?.version || null, license: pkg?.license || null },
      tech_stack: stack,
      architecture: { type: archType, directory_tree: tree, entry_points: keyFiles.filter(f => /index|main|app|server|page/.test(f.path)).map(f => f.path), config_files: ['tsconfig.json', 'vite.config.ts', 'drizzle.config.ts', 'next.config.ts'].filter(f => existsSync(join(dir, f))), key_files: keyFiles },
      how_to_run: { prerequisites: prereqs, setup_steps: setupSteps, scripts: pkg?.scripts || {}, env_vars: envVars, docker: existsSync(join(dir, 'Dockerfile')) },
      api_routes: routes,
      database: db,
      recent_decisions: recentDecisions,
      gotchas,
      mermaid_architecture: mermaid,
    });
  } catch (err) {
    output({ error: err.message, success: false });
  }

  process.exit(0);
}

main();
