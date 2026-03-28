#!/usr/bin/env node
// tools/architecture-mapper.mjs
// Living Architecture Map — auto-generates Mermaid diagrams from codebase analysis
// Usage: node tools/architecture-mapper.mjs <project-directory> [--format=mermaid|json]
// Safe: reads files only, no network, no writes

import { readFileSync, existsSync, readdirSync, statSync as fStatSync } from 'fs';
import { join, extname, relative, dirname, resolve } from 'path';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage', '.output', '__pycache__']);

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function walkFiles(dir, maxFiles = 2000) {
  const files = [];
  function walk(d, depth) {
    if (depth > 10 || files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= maxFiles) return;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (CODE_EXTS.has(extname(e.name))) files.push(full);
    }
  }
  walk(dir, 0);
  return files;
}

// ---------------------------------------------------------------------------
// Route detection
// ---------------------------------------------------------------------------
function findRoutes(files, dir) {
  const routes = [];
  const routeRegex = /\b(?:app|router|server|fastify)\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (const file of files) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }

    let match;
    routeRegex.lastIndex = 0;
    while ((match = routeRegex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      // Detect middleware on same line
      const lineContent = content.split('\n')[line - 1] || '';
      const mwMatch = lineContent.match(/,\s*(\w+)/g);
      const middleware = mwMatch ? mwMatch.map(m => m.replace(',', '').trim()).filter(m => m !== 'async' && m !== 'ctx' && m !== 'c' && m !== 'req' && m !== 'res' && m !== 'next') : [];

      routes.push({ method: match[1].toUpperCase(), path: match[2], file: relative(dir, file), line, middleware });
    }

    // Next.js App Router detection
    if (/app\/api/.test(file) && /route\.(ts|js)/.test(file)) {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter(m => new RegExp(`export\\s+(async\\s+)?function\\s+${m}`).test(content));
      const apiPath = relative(dir, dirname(file)).replace(/^app/, '').replace(/\\/g, '/');
      for (const m of methods) {
        routes.push({ method: m, path: apiPath, file: relative(dir, file), line: 1, middleware: [] });
      }
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Database schema detection
// ---------------------------------------------------------------------------
function detectSchema(dir) {
  const tables = [];

  // Prisma
  const prismaPath = join(dir, 'prisma', 'schema.prisma');
  if (existsSync(prismaPath)) {
    try {
      const schema = readFileSync(prismaPath, 'utf8');
      const modelBlocks = schema.match(/model\s+\w+\s*\{[^}]+\}/g) || [];
      for (const block of modelBlocks) {
        const nameMatch = block.match(/model\s+(\w+)/);
        if (!nameMatch) continue;
        const name = nameMatch[1];
        const columns = block.split('\n').slice(1, -1).map(l => l.trim().split(/\s+/)[0]).filter(c => c && !c.startsWith('@') && !c.startsWith('//'));
        const relations = [];
        const relMatches = block.match(/@relation\([^)]*references:\s*\[(\w+)\]/g);
        if (relMatches) {
          for (const rm of relMatches) {
            const refMatch = rm.match(/references:\s*\[(\w+)\]/);
            if (refMatch) relations.push({ to: 'related_table', type: 'reference', field: refMatch[1] });
          }
        }
        tables.push({ name, columns, relations });
      }
      const dbType = /postgresql/i.test(schema) ? 'postgresql' : /mysql/i.test(schema) ? 'mysql' : /sqlite/i.test(schema) ? 'sqlite' : 'unknown';
      return { type: dbType, orm: 'prisma', tables };
    } catch {}
  }

  // Drizzle
  const drizzleFiles = ['src/db/schema.ts', 'src/schema.ts', 'db/schema.ts'];
  for (const p of drizzleFiles) {
    const full = join(dir, p);
    if (!existsSync(full)) continue;
    try {
      const content = readFileSync(full, 'utf8');
      const tableMatches = content.match(/(?:export\s+const\s+(\w+)\s*=\s*)?(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"`](\w+)['"`]/g) || [];
      for (const tm of tableMatches) {
        const nameMatch = tm.match(/['"`](\w+)['"`]/);
        if (nameMatch) tables.push({ name: nameMatch[1], columns: [], relations: [] });
      }
      const dbType = /pgTable/.test(content) ? 'postgresql' : /mysqlTable/.test(content) ? 'mysql' : 'sqlite';
      return { type: dbType, orm: 'drizzle', tables };
    } catch {}
  }

  return { type: 'none', orm: 'none', tables: [] };
}

// ---------------------------------------------------------------------------
// Service detection
// ---------------------------------------------------------------------------
function detectServices(files, dir) {
  const services = [];
  const detected = new Set();

  const servicePatterns = [
    { pattern: /from\s+['"](?:ioredis|redis)['"]|require\(['"](?:ioredis|redis)['"]\)/i, name: 'Redis' },
    { pattern: /from\s+['"]resend['"]|require\(['"]resend['"]\)/i, name: 'Resend' },
    { pattern: /from\s+['"]stripe['"]|require\(['"]stripe['"]\)/i, name: 'Stripe' },
    { pattern: /from\s+['"]@aws-sdk/i, name: 'AWS' },
    { pattern: /from\s+['"]bullmq['"]|require\(['"]bullmq['"]\)/i, name: 'BullMQ' },
    { pattern: /from\s+['"]nodemailer['"]|require\(['"]nodemailer['"]\)/i, name: 'Nodemailer' },
    { pattern: /from\s+['"]@supabase\/supabase-js['"]|require\(['"]@supabase/i, name: 'Supabase' },
    { pattern: /from\s+['"]firebase/i, name: 'Firebase' },
    { pattern: /from\s+['"]@anthropic-ai/i, name: 'Anthropic Claude' },
    { pattern: /from\s+['"]openai['"]|require\(['"]openai['"]\)/i, name: 'OpenAI' },
  ];

  for (const file of files) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }

    for (const { pattern, name } of servicePatterns) {
      if (pattern.test(content) && !detected.has(name)) {
        detected.add(name);
        services.push({ name, detected_via: `import in ${relative(dir, file)}`, usage: [relative(dir, file)] });
      }
    }
  }

  // Env-based detection
  const envPath = join(dir, '.env.example');
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf8');
      if (/REDIS_URL|REDIS_HOST/i.test(envContent) && !detected.has('Redis')) services.push({ name: 'Redis', detected_via: 'env var', usage: [] });
      if (/STRIPE_/i.test(envContent) && !detected.has('Stripe')) services.push({ name: 'Stripe', detected_via: 'env var', usage: [] });
      if (/S3_BUCKET|AWS_/i.test(envContent) && !detected.has('AWS')) services.push({ name: 'AWS S3', detected_via: 'env var', usage: [] });
      if (/SMTP_|SENDGRID/i.test(envContent) && !detected.has('Nodemailer')) services.push({ name: 'Email Service', detected_via: 'env var', usage: [] });
    } catch {}
  }

  return services;
}

// ---------------------------------------------------------------------------
// Middleware detection
// ---------------------------------------------------------------------------
function detectMiddleware(files, dir) {
  const middleware = [];
  for (const file of files) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/\b(?:app|server)\s*\.\s*use\s*\(\s*(\w+)/);
      if (match) {
        middleware.push({ name: match[1], file: relative(dir, file), line: i + 1 });
      }
    }
  }
  return middleware;
}

// ---------------------------------------------------------------------------
// Import graph + circular detection
// ---------------------------------------------------------------------------
function buildImportGraph(files, dir) {
  const graph = {};
  const importRegex = /(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;

  for (const file of files) {
    const rel = relative(dir, file);
    graph[rel] = [];
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolved = relative(dir, resolve(dirname(file), importPath));
      // Try common extensions
      const candidates = [resolved, resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '/index.ts', resolved + '/index.js'];
      const found = candidates.find(c => files.some(f => relative(dir, f) === c));
      if (found) graph[rel].push(found);
    }
  }

  // Circular detection (DFS)
  const circular = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) circular.push({ cycle: [...path.slice(cycleStart), node] });
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const dep of (graph[node] || [])) dfs(dep, [...path, node]);
    inStack.delete(node);
  }

  for (const node of Object.keys(graph)) dfs(node, []);

  // Orphan detection
  const imported = new Set(Object.values(graph).flat());
  const entryPatterns = /index\.|main\.|app\.|server\.|page\.|layout\.|route\./;
  const orphans = Object.keys(graph).filter(f => !imported.has(f) && !entryPatterns.test(f));

  return { graph, circular: circular.slice(0, 10), orphans: orphans.slice(0, 20) };
}

// ---------------------------------------------------------------------------
// Mermaid diagram generation
// ---------------------------------------------------------------------------
function generateDiagrams(routes, schema, services, middleware) {
  // System diagram
  let system = 'graph TD\n';
  system += '  Client[Browser/Mobile] --> API[API Server]\n';
  if (schema.tables.length > 0) system += `  API --> DB[(${schema.type === 'none' ? 'Database' : schema.type.toUpperCase()})]\n`;
  for (const s of services) {
    const id = s.name.replace(/\s+/g, '');
    system += `  API --> ${id}[${s.name}]\n`;
  }

  // Routes diagram
  let routesDiagram = 'graph LR\n';
  const grouped = {};
  for (const r of routes) {
    const base = '/' + (r.path.split('/').filter(Boolean)[0] || '');
    if (!grouped[base]) grouped[base] = [];
    grouped[base].push(r);
  }
  for (const [base, rts] of Object.entries(grouped)) {
    const baseId = base.replace(/[^a-zA-Z]/g, '') || 'root';
    routesDiagram += `  API[API] --> ${baseId}[${base}]\n`;
    for (const r of rts.slice(0, 5)) {
      const id = `${baseId}_${r.method}`.replace(/[^a-zA-Z_]/g, '');
      routesDiagram += `  ${baseId} --> ${id}[${r.method} ${r.path}]\n`;
    }
  }

  // Database ER diagram
  let dbDiagram = 'erDiagram\n';
  for (const t of schema.tables) {
    dbDiagram += `  ${t.name} {\n`;
    for (const c of t.columns.slice(0, 8)) {
      dbDiagram += `    string ${c}\n`;
    }
    dbDiagram += '  }\n';
  }

  // Data flow sequence diagram
  let dataFlow = 'sequenceDiagram\n';
  dataFlow += '  participant C as Client\n  participant A as API\n';
  if (schema.tables.length > 0) dataFlow += '  participant D as Database\n';
  if (services.find(s => s.name === 'Redis')) dataFlow += '  participant R as Redis\n';
  dataFlow += '  C->>A: HTTP Request\n';
  if (middleware.length > 0) dataFlow += `  Note over A: ${middleware.map(m => m.name).slice(0, 3).join(', ')}\n`;
  if (schema.tables.length > 0) { dataFlow += '  A->>D: Query\n  D-->>A: Result\n'; }
  dataFlow += '  A-->>C: Response\n';

  return { system, routes: routesDiagram, database: dbDiagram, data_flow: dataFlow };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));

  if (!dir) {
    output({ error: 'Usage: node architecture-mapper.mjs <project-directory>', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  try {
    const files = walkFiles(dir);
    const pkg = readJSON(join(dir, 'package.json'));
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

    // Detect architecture type
    let archType = 'api';
    if (deps.react || deps.vue || deps.svelte) archType = deps.next || deps.nuxt ? 'fullstack' : deps.express || deps.hono || deps.fastify ? 'fullstack' : 'frontend';
    if (pkg?.workspaces || existsSync(join(dir, 'pnpm-workspace.yaml'))) archType = 'monorepo';

    const routes = findRoutes(files, dir);
    const schema = detectSchema(dir);
    const services = detectServices(files, dir);
    const middleware = detectMiddleware(files, dir);
    const { circular, orphans } = buildImportGraph(files, dir);

    // Entry point
    const entryPoints = ['src/index.ts', 'src/server.ts', 'src/main.ts', 'src/app.ts', 'app/layout.tsx', 'pages/_app.tsx']
      .filter(p => existsSync(join(dir, p)));
    const entryPoint = entryPoints[0] || pkg?.main || null;

    // Layers
    const layers = [];
    if (routes.length > 0) layers.push('routes');
    if (middleware.length > 0) layers.push('middleware');
    if (services.length > 0) layers.push('services');
    if (schema.tables.length > 0) layers.push('models');
    if (existsSync(join(dir, 'src', 'utils')) || existsSync(join(dir, 'src', 'lib'))) layers.push('utils');

    const diagrams = generateDiagrams(routes, schema, services, middleware);

    output({
      success: true,
      architecture: { type: archType, entry_point: entryPoint, layers },
      api_routes: routes.slice(0, 50),
      database: schema,
      services,
      middleware,
      circular_dependencies: circular,
      orphan_modules: orphans,
      diagrams,
    });
  } catch (err) {
    output({ error: err.message, success: false });
  }

  process.exit(0);
}

main();
