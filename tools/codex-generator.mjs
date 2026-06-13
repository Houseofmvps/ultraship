#!/usr/bin/env node
// codex-generator.mjs — Generate compact codebase index to save AI tokens
// Stack-agnostic: JS/TS, Python, Go, Ruby, PHP, Rust, Java
// Outputs JSON with routes, schema, components, lib exports, project structure

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, extname, basename } from 'path';

const projectDir = process.argv[2] || process.cwd();

// ── Config ──

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', 'dist', 'build',
  '.output', 'coverage', '.turbo', '.cache', '.ultraship', '.ai-codex',
  '__pycache__', '.venv', 'venv', 'env', 'vendor', 'target', '.gradle',
  '.idea', '.vscode', 'tmp', 'log', 'logs', '.bundle', 'deps', '_build',
  '.elixir_ls', 'bin', 'obj', '.dart_tool', '.pub-cache',
]);

const SKIP_EXTENSIONS = new Set([
  '.map', '.min.js', '.min.css', '.d.ts', '.lock', '.ico', '.png', '.jpg',
  '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.pdf',
  '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.pyc', '.pyo',
  '.class', '.jar', '.wasm', '.o', '.a',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rb', '.php', '.rs', '.java', '.kt',
  '.svelte', '.vue', '.astro',
]);

const UI_PRIMITIVES = new Set([
  'Button', 'Input', 'Label', 'Card', 'CardContent', 'CardHeader', 'CardTitle',
  'CardDescription', 'CardFooter', 'Dialog', 'DialogContent', 'DialogHeader',
  'DialogTitle', 'DialogDescription', 'DialogFooter', 'DialogTrigger',
  'Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue',
  'Tabs', 'TabsContent', 'TabsList', 'TabsTrigger', 'Badge', 'Avatar',
  'Separator', 'Skeleton', 'Switch', 'Checkbox', 'RadioGroup', 'Textarea',
  'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger',
  'Popover', 'PopoverContent', 'PopoverTrigger', 'Sheet', 'SheetContent',
  'SheetHeader', 'SheetTitle', 'SheetTrigger', 'Table', 'TableBody',
  'TableCell', 'TableHead', 'TableHeader', 'TableRow', 'ScrollArea',
  'DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger',
  'Command', 'CommandInput', 'CommandList', 'CommandItem', 'CommandGroup',
  'Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent',
  'Alert', 'AlertDescription', 'AlertTitle', 'Progress', 'Slider',
]);

// ── Helpers ──

function walk(dir, files = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, files);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (SKIP_EXTENSIONS.has(ext)) continue;
        try {
          const stat = statSync(fullPath);
          if (stat.size > 100_000) continue;
        } catch { continue; }
        files.push(fullPath);
      }
    }
  } catch { /* permission denied */ }
  return files;
}

function readSafe(filePath) {
  try { return readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function relPath(filePath) {
  return relative(projectDir, filePath);
}

function isCodeFile(file) {
  return CODE_EXTENSIONS.has(extname(file));
}

function isTestFile(rel) {
  return /\.(test|spec|_test|_spec)\./i.test(rel) ||
    /\/__tests__\//i.test(rel) ||
    (/\/tests?\//i.test(rel) && !/\/test-utils/i.test(rel)) ||
    /\/spec\//i.test(rel);
}

// ── Detect Stack ──

function detectStack() {
  const result = { frameworks: [], orms: [], ui: [], language: 'unknown' };

  // JS/TS ecosystem
  const allDeps = collectNodeDeps();
  if (Object.keys(allDeps).length > 0) {
    result.language = allDeps.typescript ? 'typescript' : 'javascript';

    // Frameworks
    if (allDeps.hono) result.frameworks.push('hono');
    if (allDeps.next) result.frameworks.push('nextjs');
    if (allDeps.express) result.frameworks.push('express');
    if (allDeps.fastify) result.frameworks.push('fastify');
    if (allDeps['@nestjs/core']) result.frameworks.push('nestjs');
    if (allDeps['@sveltejs/kit']) result.frameworks.push('sveltekit');
    if (allDeps.nuxt) result.frameworks.push('nuxt');
    if (allDeps.astro) result.frameworks.push('astro');
    if (allDeps['@remix-run/node'] || allDeps['@remix-run/react']) result.frameworks.push('remix');
    if (allDeps.koa) result.frameworks.push('koa');
    if (allDeps['@hapi/hapi']) result.frameworks.push('hapi');
    if (allDeps.elysia) result.frameworks.push('elysia');

    // ORMs
    if (allDeps['drizzle-orm'] || allDeps.drizzle) result.orms.push('drizzle');
    if (allDeps['@prisma/client'] || allDeps.prisma) result.orms.push('prisma');
    if (allDeps.mongoose) result.orms.push('mongoose');
    if (allDeps.sequelize) result.orms.push('sequelize');
    if (allDeps.typeorm) result.orms.push('typeorm');
    if (allDeps.knex) result.orms.push('knex');
    if (allDeps.kysely) result.orms.push('kysely');
    if (allDeps['better-sqlite3'] || allDeps.sqlite3) result.orms.push('sqlite');

    // UI
    if (allDeps.react) result.ui.push('react');
    if (allDeps.vue) result.ui.push('vue');
    if (allDeps.svelte) result.ui.push('svelte');
    if (allDeps['@angular/core']) result.ui.push('angular');
    if (allDeps.solid) result.ui.push('solid');
  }

  // Python — check root and common subdirs (backend/, server/, api/, src/)
  const pyDepLocations = [
    projectDir,
    ...['backend', 'server', 'api', 'src', 'app'].map(d => join(projectDir, d)),
  ];
  const pyDepFiles = ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'];
  const hasPython = pyDepLocations.some(dir => pyDepFiles.some(f => existsSync(join(dir, f))));

  if (hasPython) {
    result.language = result.language === 'unknown' ? 'python' : result.language;
    const pyDeps = collectPythonDeps(pyDepLocations);
    if (pyDeps.has('django')) result.frameworks.push('django');
    if (pyDeps.has('flask')) result.frameworks.push('flask');
    if (pyDeps.has('fastapi')) result.frameworks.push('fastapi');
    if (pyDeps.has('starlette')) result.frameworks.push('starlette');
    if (pyDeps.has('sqlalchemy')) result.orms.push('sqlalchemy');
    if (pyDeps.has('django')) result.orms.push('django-orm');
    if (pyDeps.has('tortoise-orm')) result.orms.push('tortoise');
    if (pyDeps.has('mongoengine')) result.orms.push('mongoengine');
  }

  // Go
  if (existsSync(join(projectDir, 'go.mod'))) {
    result.language = result.language === 'unknown' ? 'go' : result.language;
    const goMod = readSafe(join(projectDir, 'go.mod'));
    if (goMod.includes('gin-gonic')) result.frameworks.push('gin');
    if (goMod.includes('gofiber')) result.frameworks.push('fiber');
    if (goMod.includes('labstack/echo')) result.frameworks.push('echo');
    if (goMod.includes('go-chi')) result.frameworks.push('chi');
    if (goMod.includes('gorilla/mux')) result.frameworks.push('gorilla');
    if (goMod.includes('gorm.io')) result.orms.push('gorm');
    if (goMod.includes('sqlx')) result.orms.push('sqlx');
    if (goMod.includes('ent')) result.orms.push('ent');
  }

  // Ruby
  if (existsSync(join(projectDir, 'Gemfile'))) {
    result.language = result.language === 'unknown' ? 'ruby' : result.language;
    const gemfile = readSafe(join(projectDir, 'Gemfile'));
    if (gemfile.includes("'rails'") || gemfile.includes('"rails"')) result.frameworks.push('rails');
    if (gemfile.includes("'sinatra'") || gemfile.includes('"sinatra"')) result.frameworks.push('sinatra');
    if (result.frameworks.includes('rails')) result.orms.push('activerecord');
    if (gemfile.includes('sequel')) result.orms.push('sequel');
  }

  // PHP
  if (existsSync(join(projectDir, 'composer.json'))) {
    result.language = result.language === 'unknown' ? 'php' : result.language;
    try {
      const composer = JSON.parse(readSafe(join(projectDir, 'composer.json')));
      const phpDeps = { ...(composer.require || {}), ...(composer['require-dev'] || {}) };
      if (phpDeps['laravel/framework']) result.frameworks.push('laravel');
      if (phpDeps['symfony/framework-bundle']) result.frameworks.push('symfony');
      if (phpDeps['doctrine/orm']) result.orms.push('doctrine');
      if (result.frameworks.includes('laravel')) result.orms.push('eloquent');
    } catch { /* skip */ }
  }

  // Rust
  if (existsSync(join(projectDir, 'Cargo.toml'))) {
    result.language = result.language === 'unknown' ? 'rust' : result.language;
    const cargo = readSafe(join(projectDir, 'Cargo.toml'));
    if (cargo.includes('actix-web')) result.frameworks.push('actix');
    if (cargo.includes('axum')) result.frameworks.push('axum');
    if (cargo.includes('rocket')) result.frameworks.push('rocket');
    if (cargo.includes('diesel')) result.orms.push('diesel');
    if (cargo.includes('sqlx')) result.orms.push('sqlx');
    if (cargo.includes('sea-orm')) result.orms.push('sea-orm');
  }

  // Java/Kotlin
  if (existsSync(join(projectDir, 'pom.xml')) || existsSync(join(projectDir, 'build.gradle')) ||
      existsSync(join(projectDir, 'build.gradle.kts'))) {
    result.language = result.language === 'unknown' ? 'java' : result.language;
    const buildFile = readSafe(join(projectDir, 'pom.xml')) ||
                      readSafe(join(projectDir, 'build.gradle')) ||
                      readSafe(join(projectDir, 'build.gradle.kts'));
    if (buildFile.includes('spring-boot')) result.frameworks.push('spring');
    if (buildFile.includes('quarkus')) result.frameworks.push('quarkus');
    if (buildFile.includes('hibernate')) result.orms.push('hibernate');
    if (buildFile.includes('spring-data-jpa')) result.orms.push('spring-data-jpa');
  }

  return result;
}

function collectNodeDeps() {
  const allDeps = {};

  function collectFrom(pkgPath) {
    if (!existsSync(pkgPath)) return;
    try {
      const pkg = JSON.parse(readSafe(pkgPath));
      Object.assign(allDeps, pkg.dependencies || {}, pkg.devDependencies || {});
    } catch { /* skip */ }
  }

  collectFrom(join(projectDir, 'package.json'));

  // Monorepo workspace dirs
  for (const wsDir of ['apps', 'packages', 'services', 'modules', 'libs']) {
    const wsPath = join(projectDir, wsDir);
    if (existsSync(wsPath)) {
      try {
        for (const entry of readdirSync(wsPath, { withFileTypes: true })) {
          if (entry.isDirectory()) collectFrom(join(wsPath, entry.name, 'package.json'));
        }
      } catch { /* skip */ }
    }
  }

  return allDeps;
}

function collectPythonDeps(searchDirs) {
  const deps = new Set();

  for (const dir of searchDirs) {
    // requirements.txt
    const reqPath = join(dir, 'requirements.txt');
    if (existsSync(reqPath)) {
      for (const line of readSafe(reqPath).split('\n')) {
        const pkg = line.trim().split(/[=<>!~\[]/)[0].toLowerCase();
        if (pkg && !pkg.startsWith('#') && !pkg.startsWith('-')) deps.add(pkg);
      }
    }

    // pyproject.toml (basic parsing)
    const pyprojectPath = join(dir, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      const content = readSafe(pyprojectPath);
      const depMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depMatch) {
        for (const line of depMatch[1].split('\n')) {
          const pkg = line.replace(/["',]/g, '').trim().split(/[=<>!~\[]/)[0].toLowerCase();
          if (pkg) deps.add(pkg);
        }
      }
    }
  }

  return deps;
}

// ── Route Extraction ──

function extractRoutes(files) {
  const routes = [];

  for (const file of files) {
    if (!isCodeFile(file)) continue;
    const rel = relPath(file);
    if (isTestFile(rel)) continue;

    const ext = extname(file);
    const content = readSafe(file);
    if (!content) continue;

    // ── JS/TS Routes ──

    // Next.js app router: app/**/route.ts
    if (rel.includes('app/') && basename(file).startsWith('route.')) {
      const methods = [];
      for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(content)) methods.push(m);
      }
      if (methods.length > 0) {
        const routePath = '/' + rel.replace(/^.*?app\//, '').replace(/\/route\.\w+$/, '').replace(/\[([^\]]+)\]/g, ':$1');
        routes.push({ path: routePath, methods, file: rel, tags: detectRouteTags(content.slice(0, 500)) });
      }
      continue;
    }

    // SvelteKit: +server.ts/js
    if (basename(file).startsWith('+server.')) {
      const methods = [];
      for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(content)) methods.push(m);
      }
      if (methods.length > 0) {
        const routePath = '/' + rel.replace(/^.*?routes\//, '').replace(/\/\+server\.\w+$/, '').replace(/\[([^\]]+)\]/g, ':$1');
        routes.push({ path: routePath, methods, file: rel, tags: detectRouteTags(content.slice(0, 500)) });
      }
      continue;
    }

    // Nuxt: server/api/**/*.ts
    if (rel.match(/server\/api\//) && ['.ts', '.js'].includes(ext)) {
      const method = basename(file).match(/\.(get|post|put|patch|delete)\.\w+$/i);
      const methods = method ? [method[1].toUpperCase()] : ['GET'];
      const routePath = '/api/' + rel.replace(/^.*?server\/api\//, '').replace(/\.\w+$/, '').replace(/\[([^\]]+)\]/g, ':$1').replace(/\.(?:get|post|put|patch|delete)$/i, '');
      routes.push({ path: routePath, methods, file: rel, tags: detectRouteTags(content.slice(0, 500)) });
      continue;
    }

    // NestJS decorators: @Get('/path'), @Post('/path'), etc.
    if (['.ts', '.js'].includes(ext)) {
      const decoratorPattern = /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
      let match;
      while ((match = decoratorPattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2] || '/';
        // Try to find controller-level prefix
        const controllerMatch = content.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/);
        const prefix = controllerMatch ? '/' + controllerMatch[1].replace(/^\//, '') : '';
        const fullPath = prefix + (path.startsWith('/') ? path : '/' + path);
        const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
        routes.push({ path: fullPath, methods: [method], file: rel, tags: detectRouteTags(handlerSnippet) });
      }
      if (decoratorPattern.lastIndex > 0) continue; // skip generic matching if NestJS found
    }

    // Hono/Express/Fastify/Koa/Elysia: app.get('/path', ...) or router.get(...)
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      const routePattern = /(?:app|router|server|api|route)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      let match;
      while ((match = routePattern.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        const existing = routes.find(r => r.path === path && r.file === rel);
        if (existing) {
          if (!existing.methods.includes(method)) existing.methods.push(method);
        } else {
          const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
          routes.push({ path, methods: [method], file: rel, tags: detectRouteTags(handlerSnippet) });
        }
      }
    }

    // ── Python Routes ──

    if (ext === '.py') {
      // FastAPI/Starlette: @app.get("/path") or @router.get("/path")
      const fastapiPattern = /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = fastapiPattern.exec(content)) !== null) {
        const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
        routes.push({ path: match[2], methods: [match[1].toUpperCase()], file: rel, tags: detectRouteTags(handlerSnippet) });
      }

      // Flask: @app.route("/path", methods=["GET", "POST"])
      const flaskPattern = /@(?:app|bp|blueprint)\s*\.route\s*\(\s*["']([^"']+)["'](?:.*?methods\s*=\s*\[([^\]]+)\])?/g;
      while ((match = flaskPattern.exec(content)) !== null) {
        const path = match[1];
        const methods = match[2]
          ? match[2].replace(/["'\s]/g, '').split(',').map(m => m.toUpperCase())
          : ['GET'];
        const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
        routes.push({ path, methods, file: rel, tags: detectRouteTags(handlerSnippet) });
      }

      // Django: path('url/', view) in urls.py
      if (basename(file) === 'urls.py') {
        const djangoPattern = /path\s*\(\s*["']([^"']+)["']/g;
        while ((match = djangoPattern.exec(content)) !== null) {
          routes.push({ path: '/' + match[1], methods: ['*'], file: rel, tags: [] });
        }
      }
    }

    // ── Go Routes ──

    if (ext === '.go') {
      // Gin: r.GET("/path", handler)
      const ginPattern = /\.\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*"([^"]+)"/g;
      let match;
      while ((match = ginPattern.exec(content)) !== null) {
        const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
        routes.push({ path: match[2], methods: [match[1]], file: rel, tags: detectRouteTags(handlerSnippet) });
      }

      // Echo/Fiber: e.Get("/path", handler) or app.Get("/path", handler)
      const echoPattern = /\.\s*(Get|Post|Put|Patch|Delete)\s*\(\s*"([^"]+)"/g;
      while ((match = echoPattern.exec(content)) !== null) {
        const handlerSnippet = content.slice(match.index, Math.min(content.length, match.index + 500));
        routes.push({ path: match[2], methods: [match[1].toUpperCase()], file: rel, tags: detectRouteTags(handlerSnippet) });
      }

      // Chi/Gorilla: r.Get("/path", handler) or r.HandleFunc("/path", handler).Methods("GET")
      const chiPattern = /\.HandleFunc\s*\(\s*"([^"]+)".*?\.Methods\s*\(\s*"([^"]+)"/gs;
      while ((match = chiPattern.exec(content)) !== null) {
        routes.push({ path: match[1], methods: [match[2]], file: rel, tags: [] });
      }
    }

    // ── Ruby Routes ──

    if (ext === '.rb' && (rel.includes('routes') || basename(file) === 'routes.rb')) {
      const railsPattern = /\b(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = railsPattern.exec(content)) !== null) {
        routes.push({ path: match[2], methods: [match[1].toUpperCase()], file: rel, tags: [] });
      }
      // resources :users
      const resourcePattern = /resources?\s+:(\w+)/g;
      while ((match = resourcePattern.exec(content)) !== null) {
        routes.push({ path: `/${match[1]}`, methods: ['CRUD'], file: rel, tags: ['db'] });
      }
    }

    // ── PHP/Laravel Routes ──

    if (ext === '.php' && rel.includes('routes')) {
      const laravelPattern = /Route::(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
      let match;
      while ((match = laravelPattern.exec(content)) !== null) {
        routes.push({ path: match[2], methods: [match[1].toUpperCase()], file: rel, tags: [] });
      }
    }

    // ── Rust Routes ──

    if (ext === '.rs') {
      // Actix: web::get().to(handler) or .route("/path", web::get())
      const actixPattern = /\.route\s*\(\s*"([^"]+)"\s*,\s*web::(get|post|put|patch|delete)/g;
      let match;
      while ((match = actixPattern.exec(content)) !== null) {
        routes.push({ path: match[1], methods: [match[2].toUpperCase()], file: rel, tags: [] });
      }

      // Axum: .route("/path", get(handler))
      const axumPattern = /\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\s*\(/g;
      while ((match = axumPattern.exec(content)) !== null) {
        routes.push({ path: match[1], methods: [match[2].toUpperCase()], file: rel, tags: [] });
      }
    }

    // ── Java/Spring Routes ──

    if (ext === '.java' || ext === '.kt') {
      const springPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?["']?([^"')]+)["']?\s*\)/g;
      let match;
      while ((match = springPattern.exec(content)) !== null) {
        const mapping = match[1];
        const path = match[2];
        let method = 'GET';
        if (mapping.startsWith('Post')) method = 'POST';
        else if (mapping.startsWith('Put')) method = 'PUT';
        else if (mapping.startsWith('Patch')) method = 'PATCH';
        else if (mapping.startsWith('Delete')) method = 'DELETE';
        else if (mapping === 'RequestMapping') method = '*';
        routes.push({ path, methods: [method], file: rel, tags: [] });
      }
    }
  }

  return routes.filter(r => isValidRoutePath(r.path));
}

// Regex route matching can catch code that isn't a route (e.g. `api.get(` inside
// a scanner's own source). Real route path literals never contain whitespace or
// JS operator syntax, so drop anything that does.
function isValidRoutePath(p) {
  if (!p || typeof p !== 'string' || p.length > 200) return false;
  if (/\s/.test(p)) return false;
  if (/[<>;`]/.test(p)) return false;
  if (/\|\||&&|=>/.test(p)) return false;
  return true;
}

function detectRouteTags(content) {
  const tags = [];
  if (/auth|session|jwt|bearer|token|login|signup|password/i.test(content)) tags.push('auth');
  if (/database|db\.|query|insert|select|update|delete.*from|\.findMany|\.findFirst|\.create\(|\.save\(/i.test(content)) tags.push('db');
  if (/cache|redis|memcache/i.test(content)) tags.push('cache');
  if (/queue|bullmq|bull|worker|celery|sidekiq/i.test(content)) tags.push('queue');
  if (/email|resend|sendgrid|nodemailer|smtp|mailer/i.test(content)) tags.push('email');
  if (/stripe|polar|paddle|payment|billing|checkout/i.test(content)) tags.push('payment');
  if (/webhook/i.test(content)) tags.push('webhook');
  if (/upload|multer|formdata|multipart|s3|storage/i.test(content)) tags.push('upload');
  return tags;
}

// ── Schema Extraction ──

function extractSchema(files, stack) {
  const tables = [];

  // Drizzle
  if (stack.orms.includes('drizzle')) tables.push(...extractDrizzleSchema(files));
  // Prisma
  if (stack.orms.includes('prisma')) tables.push(...extractPrismaSchema());
  // Mongoose
  if (stack.orms.includes('mongoose')) tables.push(...extractMongooseSchema(files));
  // Sequelize
  if (stack.orms.includes('sequelize')) tables.push(...extractSequelizeSchema(files));
  // TypeORM
  if (stack.orms.includes('typeorm')) tables.push(...extractTypeORMSchema(files));
  // SQLAlchemy
  if (stack.orms.includes('sqlalchemy')) tables.push(...extractSQLAlchemySchema(files));
  // Django ORM
  if (stack.orms.includes('django-orm')) tables.push(...extractDjangoSchema(files));
  // GORM (Go)
  if (stack.orms.includes('gorm')) tables.push(...extractGORMSchema(files));
  // ActiveRecord (Rails)
  if (stack.orms.includes('activerecord')) tables.push(...extractActiveRecordSchema());
  // Eloquent (Laravel)
  if (stack.orms.includes('eloquent')) tables.push(...extractEloquentSchema(files));

  // Fallback: raw SQL migrations (if no ORM detected or ORM missed some)
  if (tables.length === 0) tables.push(...extractRawSQLSchema(files));

  return tables;
}

function extractRawSQLSchema(files) {
  const tables = [];
  for (const file of files) {
    if (extname(file) !== '.sql') continue;
    const rel = relPath(file);
    if (!rel.includes('migration') && !rel.includes('schema') && !rel.includes('sql')) continue;

    const content = readSafe(file);
    const createPattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\);/gi;
    let match;
    while ((match = createPattern.exec(content)) !== null) {
      const tableName = match[1];
      const columns = [];
      for (const line of match[2].split('\n')) {
        const colMatch = line.trim().match(/^["`]?(\w+)["`]?\s+(VARCHAR|TEXT|INT|INTEGER|BIGINT|SERIAL|BOOLEAN|BOOL|TIMESTAMP|DATE|JSON|JSONB|UUID|FLOAT|DOUBLE|DECIMAL|NUMERIC|CHAR|BLOB|REAL|SMALLINT)\b/i);
        if (!colMatch) continue;
        if (AUDIT_FIELDS.has(colMatch[1])) continue;
        const flags = [];
        if (/PRIMARY\s+KEY/i.test(line)) flags.push('PK');
        if (/UNIQUE/i.test(line)) flags.push('UQ');
        if (/NOT\s+NULL/i.test(line)) flags.push('NN');
        if (/REFERENCES/i.test(line)) flags.push('FK');
        if (/DEFAULT/i.test(line)) flags.push('DEF');
        columns.push({ name: colMatch[1], type: colMatch[2].toLowerCase(), flags });
      }
      if (columns.length > 0) {
        tables.push({ table: tableName, file: rel, columns });
      }
    }
  }
  return tables;
}

const AUDIT_FIELDS = new Set([
  'createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at',
  'CreatedAt', 'UpdatedAt', 'DeletedAt',
]);

function extractDrizzleSchema(files) {
  const tables = [];
  const tablePattern = /export\s+const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"`](\w+)['"`]/g;
  const columnPattern = /(\w+)\s*:\s*(text|varchar|integer|serial|boolean|timestamp|json|jsonb|uuid|bigint|smallint|real|doublePrecision|numeric|date|time|interval|char|citext)\s*\(/g;

  for (const file of files) {
    if (!['.ts', '.js'].includes(extname(file))) continue;
    const content = readSafe(file);
    if (!content.includes('Table(')) continue;

    tablePattern.lastIndex = 0;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      const startIdx = match.index;
      let depth = 0;
      let blockEnd = startIdx;
      for (let i = content.indexOf('(', startIdx); i < content.length; i++) {
        if (content[i] === '(') depth++;
        if (content[i] === ')') { depth--; if (depth === 0) { blockEnd = i; break; } }
      }

      const block = content.slice(startIdx, blockEnd);
      const columns = [];
      columnPattern.lastIndex = 0;
      let colMatch;
      while ((colMatch = columnPattern.exec(block)) !== null) {
        if (AUDIT_FIELDS.has(colMatch[1])) continue;
        const afterCol = block.slice(colMatch.index, colMatch.index + 200);
        const flags = [];
        if (/primaryKey|\.pk\(\)/.test(afterCol)) flags.push('PK');
        if (/\.unique\(\)/.test(afterCol)) flags.push('UQ');
        if (/\.notNull\(\)/.test(afterCol)) flags.push('NN');
        if (/\.default\(/.test(afterCol)) flags.push('DEF');
        if (/references\s*\(/.test(afterCol)) flags.push('FK');
        columns.push({ name: colMatch[1], type: colMatch[2], flags });
      }

      tables.push({ table: match[2], file: relPath(file), columns });
    }
  }
  return tables;
}

function extractPrismaSchema() {
  const tables = [];
  for (const loc of ['prisma/schema.prisma', 'schema.prisma', 'prisma/schema']) {
    const schemaPath = join(projectDir, loc);
    if (!existsSync(schemaPath)) continue;

    const content = readSafe(schemaPath);
    const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = modelPattern.exec(content)) !== null) {
      const columns = [];
      for (const line of match[2].split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
        const colMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*(.*)/);
        if (!colMatch) continue;
        if (AUDIT_FIELDS.has(colMatch[1])) continue;
        const flags = [];
        if (colMatch[4].includes('@id')) flags.push('PK');
        if (colMatch[4].includes('@unique')) flags.push('UQ');
        if (colMatch[4].includes('@relation')) flags.push('FK');
        if (colMatch[4].includes('@default')) flags.push('DEF');
        if (!colMatch[4].includes('?') && !colMatch[3]) flags.push('NN');
        columns.push({ name: colMatch[1], type: colMatch[3] ? `${colMatch[2]}[]` : colMatch[2], flags });
      }
      tables.push({ table: match[1], file: relPath(schemaPath), columns });
    }
    break;
  }
  return tables;
}

function extractMongooseSchema(files) {
  const tables = [];
  for (const file of files) {
    if (!['.ts', '.js'].includes(extname(file))) continue;
    const content = readSafe(file);
    if (!content.includes('Schema(')) continue;

    // new Schema({ field: Type }) or mongoose.Schema({...})
    const schemaMatch = content.match(/(?:const|let)\s+(\w+)\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(/);
    if (!schemaMatch) continue;

    // Extract model name: mongoose.model('Name', schema)
    const modelMatch = content.match(/model\s*\(\s*['"](\w+)['"]/);
    const tableName = modelMatch ? modelMatch[1] : schemaMatch[1].replace(/Schema$/, '');

    // Simple field extraction from schema definition
    const columns = [];
    const fieldPattern = /(\w+)\s*:\s*\{?\s*type\s*:\s*(\w+)/g;
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      if (AUDIT_FIELDS.has(match[1])) continue;
      const flags = [];
      const lineCtx = content.slice(match.index, match.index + 200);
      if (/required\s*:\s*true/.test(lineCtx)) flags.push('NN');
      if (/unique\s*:\s*true/.test(lineCtx)) flags.push('UQ');
      if (/ref\s*:/.test(lineCtx)) flags.push('FK');
      if (/index\s*:\s*true/.test(lineCtx)) flags.push('IDX');
      columns.push({ name: match[1], type: match[2], flags });
    }

    if (columns.length > 0) {
      tables.push({ table: tableName, file: relPath(file), columns });
    }
  }
  return tables;
}

function extractSequelizeSchema(files) {
  const tables = [];
  for (const file of files) {
    if (!['.ts', '.js'].includes(extname(file))) continue;
    const content = readSafe(file);
    if (!content.includes('define(') && !content.includes('init(')) continue;

    // sequelize.define('ModelName', { fields }) or Model.init({ fields })
    const defineMatch = content.match(/\.define\s*\(\s*['"](\w+)['"]/) ||
                        content.match(/class\s+(\w+)\s+extends\s+Model/);
    if (!defineMatch) continue;

    const columns = [];
    const fieldPattern = /(\w+)\s*:\s*\{[\s\S]*?type\s*:\s*DataTypes\.(\w+)/g;
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      if (AUDIT_FIELDS.has(match[1])) continue;
      columns.push({ name: match[1], type: match[2], flags: [] });
    }

    if (columns.length > 0) {
      tables.push({ table: defineMatch[1], file: relPath(file), columns });
    }
  }
  return tables;
}

function extractTypeORMSchema(files) {
  const tables = [];
  for (const file of files) {
    if (!['.ts', '.js'].includes(extname(file))) continue;
    const content = readSafe(file);
    if (!content.includes('@Entity')) continue;

    const entityMatch = content.match(/@Entity\s*\(.*?\)\s*(?:export\s+)?class\s+(\w+)/);
    if (!entityMatch) continue;

    const columns = [];
    const colPattern = /@(?:Column|PrimaryColumn|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn)\s*\(([^)]*)\)\s*(\w+)/g;
    let match;
    while ((match = colPattern.exec(content)) !== null) {
      if (AUDIT_FIELDS.has(match[2])) continue;
      const flags = [];
      if (match[0].includes('Primary')) flags.push('PK');
      if (match[1].includes('unique: true')) flags.push('UQ');
      columns.push({ name: match[2], type: 'col', flags });
    }

    // Relations
    const relPattern = /@(?:ManyToOne|OneToMany|OneToOne|ManyToMany)\s*\([^)]*\)\s*(\w+)/g;
    while ((match = relPattern.exec(content)) !== null) {
      columns.push({ name: match[1], type: 'relation', flags: ['FK'] });
    }

    if (columns.length > 0) {
      tables.push({ table: entityMatch[1], file: relPath(file), columns });
    }
  }
  return tables;
}

function extractSQLAlchemySchema(files) {
  const tables = [];
  for (const file of files) {
    if (extname(file) !== '.py') continue;
    const content = readSafe(file);
    if (!content.includes('Column(') && !content.includes('mapped_column(')) continue;

    const classMatch = content.match(/class\s+(\w+)\s*\(.*(?:Base|Model|db\.Model)/);
    if (!classMatch) continue;

    const columns = [];
    // SQLAlchemy: field = Column(Type, ...)
    const colPattern = /(\w+)\s*=\s*(?:Column|mapped_column)\s*\(\s*(\w+)/g;
    let match;
    while ((match = colPattern.exec(content)) !== null) {
      if (AUDIT_FIELDS.has(match[1]) || match[1] === '__tablename__') continue;
      const lineCtx = content.slice(match.index, match.index + 200);
      const flags = [];
      if (/primary_key\s*=\s*True/.test(lineCtx)) flags.push('PK');
      if (/unique\s*=\s*True/.test(lineCtx)) flags.push('UQ');
      if (/nullable\s*=\s*False/.test(lineCtx)) flags.push('NN');
      if (/ForeignKey/.test(lineCtx)) flags.push('FK');
      columns.push({ name: match[1], type: match[2], flags });
    }

    if (columns.length > 0) {
      tables.push({ table: classMatch[1], file: relPath(file), columns });
    }
  }
  return tables;
}

function extractDjangoSchema(files) {
  const tables = [];
  for (const file of files) {
    if (extname(file) !== '.py' || !basename(file).match(/^models?\.py$/)) continue;
    const content = readSafe(file);
    if (!content.includes('models.Model')) continue;

    const classPattern = /class\s+(\w+)\s*\(\s*models\.Model\s*\)\s*:([\s\S]*?)(?=\nclass\s|\n[^\s]|$)/g;
    let match;
    while ((match = classPattern.exec(content)) !== null) {
      const columns = [];
      const fieldPattern = /(\w+)\s*=\s*models\.(\w+Field)\s*\(([^)]*)\)/g;
      let fMatch;
      while ((fMatch = fieldPattern.exec(match[2])) !== null) {
        if (AUDIT_FIELDS.has(fMatch[1])) continue;
        const flags = [];
        if (fMatch[2] === 'AutoField' || fMatch[2] === 'BigAutoField') flags.push('PK');
        if (/unique\s*=\s*True/.test(fMatch[3])) flags.push('UQ');
        if (fMatch[2].includes('ForeignKey') || fMatch[2].includes('OneToOne')) flags.push('FK');
        if (!/null\s*=\s*True/.test(fMatch[3]) && !fMatch[2].includes('Boolean')) flags.push('NN');
        columns.push({ name: fMatch[1], type: fMatch[2].replace('Field', ''), flags });
      }

      if (columns.length > 0) {
        tables.push({ table: match[1], file: relPath(file), columns });
      }
    }
  }
  return tables;
}

function extractGORMSchema(files) {
  const tables = [];
  for (const file of files) {
    if (extname(file) !== '.go') continue;
    const content = readSafe(file);
    if (!content.includes('gorm')) continue;

    const structPattern = /type\s+(\w+)\s+struct\s*\{([^}]+)\}/g;
    let match;
    while ((match = structPattern.exec(content)) !== null) {
      if (!match[2].includes('gorm')) continue;
      const columns = [];
      for (const line of match[2].split('\n')) {
        const fieldMatch = line.trim().match(/^(\w+)\s+(\S+)\s+`.*gorm:"([^"]*)".*`/);
        if (!fieldMatch) continue;
        if (AUDIT_FIELDS.has(fieldMatch[1])) continue;
        const flags = [];
        if (fieldMatch[3].includes('primaryKey')) flags.push('PK');
        if (fieldMatch[3].includes('unique')) flags.push('UQ');
        if (fieldMatch[3].includes('not null')) flags.push('NN');
        if (fieldMatch[3].includes('foreignKey')) flags.push('FK');
        columns.push({ name: fieldMatch[1], type: fieldMatch[2], flags });
      }
      if (columns.length > 0) {
        tables.push({ table: match[1], file: relPath(file), columns });
      }
    }
  }
  return tables;
}

function extractActiveRecordSchema() {
  const tables = [];
  // Parse db/schema.rb
  const schemaPath = join(projectDir, 'db', 'schema.rb');
  if (!existsSync(schemaPath)) return tables;

  const content = readSafe(schemaPath);
  const tablePattern = /create_table\s+"(\w+)".*?do\s*\|t\|([\s\S]*?)end/g;
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const columns = [];
    const colPattern = /t\.(\w+)\s+"(\w+)"(.*)/g;
    let colMatch;
    while ((colMatch = colPattern.exec(match[2])) !== null) {
      if (AUDIT_FIELDS.has(colMatch[2])) continue;
      const flags = [];
      if (colMatch[3].includes('null: false')) flags.push('NN');
      if (colMatch[3].includes('index')) flags.push('IDX');
      columns.push({ name: colMatch[2], type: colMatch[1], flags });
    }
    if (columns.length > 0) {
      tables.push({ table: match[1], file: 'db/schema.rb', columns });
    }
  }
  return tables;
}

function extractEloquentSchema(files) {
  const tables = [];
  // Parse migrations
  for (const file of files) {
    if (extname(file) !== '.php' || !relPath(file).includes('migrations')) continue;
    const content = readSafe(file);
    const tableMatch = content.match(/Schema::create\s*\(\s*['"](\w+)['"]/);
    if (!tableMatch) continue;

    const columns = [];
    const colPattern = /\$table->(\w+)\s*\(\s*['"](\w+)['"]/g;
    let match;
    while ((match = colPattern.exec(content)) !== null) {
      if (AUDIT_FIELDS.has(match[2])) continue;
      const flags = [];
      const lineCtx = content.slice(match.index, match.index + 200);
      if (match[1] === 'id' || match[1] === 'bigIncrements') flags.push('PK');
      if (/->unique\(\)/.test(lineCtx)) flags.push('UQ');
      if (match[1].includes('foreign') || /->references\(/.test(lineCtx)) flags.push('FK');
      if (!/->nullable\(\)/.test(lineCtx)) flags.push('NN');
      columns.push({ name: match[2], type: match[1], flags });
    }

    if (columns.length > 0) {
      tables.push({ table: tableMatch[1], file: relPath(file), columns });
    }
  }
  return tables;
}

// ── Component Extraction ──

function extractComponents(files) {
  const components = [];

  for (const file of files) {
    const ext = extname(file);
    const rel = relPath(file);
    if (isTestFile(rel)) continue;

    // React/Vue/Svelte/Astro/Angular
    if (!['.tsx', '.jsx', '.vue', '.svelte', '.astro'].includes(ext)) continue;

    const content = readSafe(file);
    if (!content) continue;

    // Vue SFC
    if (ext === '.vue') {
      const name = basename(file, '.vue');
      if (UI_PRIMITIVES.has(name)) continue;
      const propsMatch = content.match(/defineProps<\{([^}]+)\}>/s) ||
                         content.match(/props\s*:\s*\{([^}]+)\}/s);
      const props = propsMatch ? extractPropsFromBlock(propsMatch[1]) : [];
      components.push({ name, file: rel, props, client: false });
      continue;
    }

    // Svelte
    if (ext === '.svelte') {
      const compName = basename(file, '.svelte');
      if (UI_PRIMITIVES.has(compName)) continue;
      // Svelte 5 runes: let { prop1, prop2 } = $props()
      const propsMatch = content.match(/let\s*\{([^}]+)\}\s*=\s*\$props\(/);
      const props = [];
      if (propsMatch) {
        for (const p of propsMatch[1].split(',')) {
          const propName = p.trim().split(/[=:]/)[0].trim();
          if (propName) props.push({ name: propName, optional: p.includes('='), type: 'any' });
        }
      }
      // Svelte 4: export let prop
      const exportPattern = /export\s+let\s+(\w+)/g;
      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        if (!props.find(p => p.name === match[1])) {
          props.push({ name: match[1], optional: false, type: 'any' });
        }
      }
      components.push({ name: compName, file: rel, props, client: false });
      continue;
    }

    // Astro
    if (ext === '.astro') {
      const name = basename(file, '.astro');
      if (UI_PRIMITIVES.has(name)) continue;
      const propsMatch = content.match(/interface\s+Props\s*\{([^}]+)\}/);
      const props = propsMatch ? extractPropsFromBlock(propsMatch[1]) : [];
      components.push({ name, file: rel, props, client: false });
      continue;
    }

    // React (.tsx/.jsx)
    const nameMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/) ||
                      content.match(/export\s+default\s+(\w+)/) ||
                      content.match(/const\s+(\w+)\s*[:=]\s*(?:React\.)?(?:FC|memo|forwardRef)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (UI_PRIMITIVES.has(name)) continue;

    const propsMatch = content.match(/(?:interface|type)\s+\w*Props\w*\s*(?:=\s*)?\{([^}]+)\}/);
    const props = propsMatch ? extractPropsFromBlock(propsMatch[1]) : [];
    const isClient = content.includes("'use client'") || content.includes('"use client"');

    components.push({ name, file: rel, props, client: isClient });
  }

  // Angular components
  for (const file of files) {
    if (!file.endsWith('.component.ts')) continue;
    const content = readSafe(file);
    const nameMatch = content.match(/@Component[\s\S]*?class\s+(\w+)/);
    if (!nameMatch) continue;

    const props = [];
    const inputPattern = /@Input\(\)\s+(\w+)/g;
    let match;
    while ((match = inputPattern.exec(content)) !== null) {
      props.push({ name: match[1], optional: false, type: 'input' });
    }
    components.push({ name: nameMatch[1], file: relPath(file), props, client: false });
  }

  return components;
}

function extractPropsFromBlock(block) {
  const props = [];
  for (const line of block.split('\n')) {
    const propMatch = line.trim().match(/^(\w+)(\?)?\s*:\s*(.+?)(?:;|,|$)/);
    if (propMatch) {
      props.push({ name: propMatch[1], optional: !!propMatch[2], type: propMatch[3].trim() });
    }
  }
  return props;
}

// ── Library Export Extraction ──

function extractLibExports(files) {
  const libs = [];
  const libDirs = ['lib', 'utils', 'helpers', 'shared', 'common', 'packages', 'core', 'services', 'modules'];

  for (const file of files) {
    const ext = extname(file);
    const rel = relPath(file);
    if (isTestFile(rel)) continue;

    const isLib = libDirs.some(d => rel.startsWith(d + '/') || rel.includes('/' + d + '/'));
    if (!isLib) continue;

    const content = readSafe(file);
    if (!content) continue;

    const exports = [];

    // JS/TS exports
    if (['.ts', '.tsx', '.js', '.mjs', '.cjs'].includes(ext)) {
      const fnPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
      let m;
      while ((m = fnPattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'fn' });

      const constPattern = /export\s+const\s+(\w+)\s*[:=]/g;
      while ((m = constPattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'const' });

      const typePattern = /export\s+(?:type|interface)\s+(\w+)/g;
      while ((m = typePattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'type' });

      const classPattern = /export\s+(?:default\s+)?class\s+(\w+)/g;
      while ((m = classPattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'class' });
    }

    // Python exports
    if (ext === '.py') {
      const defPattern = /^def\s+(\w+)\s*\(/gm;
      let m;
      while ((m = defPattern.exec(content)) !== null) {
        if (!m[1].startsWith('_')) exports.push({ name: m[1], kind: 'fn' });
      }

      const classPattern = /^class\s+(\w+)/gm;
      while ((m = classPattern.exec(content)) !== null) {
        if (!m[1].startsWith('_')) exports.push({ name: m[1], kind: 'class' });
      }
    }

    // Go exports (capitalized functions/types)
    if (ext === '.go') {
      const funcPattern = /^func\s+(\p{Lu}\w*)\s*\(/gmu;
      let m;
      while ((m = funcPattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'fn' });

      const typePattern = /^type\s+(\p{Lu}\w*)\s+/gmu;
      while ((m = typePattern.exec(content)) !== null) exports.push({ name: m[1], kind: 'type' });
    }

    // Ruby (public methods, classes)
    if (ext === '.rb') {
      const defPattern = /def\s+(\w+)/g;
      let m;
      while ((m = defPattern.exec(content)) !== null) {
        if (!m[1].startsWith('_')) exports.push({ name: m[1], kind: 'fn' });
      }
    }

    if (exports.length > 0) {
      libs.push({ file: rel, exports: exports.slice(0, 10) });
    }
  }

  return libs;
}

// ── Project Structure (fallback for any stack) ──

function extractStructure() {
  const structure = [];
  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        const subEntries = [];
        try {
          const sub = readdirSync(join(projectDir, entry.name), { withFileTypes: true });
          for (const s of sub.slice(0, 10)) {
            subEntries.push(s.isDirectory() ? s.name + '/' : s.name);
          }
          if (sub.length > 10) subEntries.push(`+${sub.length - 10} more`);
        } catch { /* skip */ }
        structure.push({ name: entry.name + '/', children: subEntries });
      }
    }
  } catch { /* skip */ }
  return structure;
}

// ── Generate Compact Markdown ──

function generateMarkdown(data, stack) {
  const lines = [];

  const stackParts = [];
  if (stack.frameworks.length) stackParts.push(stack.frameworks.join(', '));
  if (stack.orms.length) stackParts.push(stack.orms.join(', '));
  if (stack.ui.length) stackParts.push(stack.ui.join(', '));
  if (!stackParts.length && stack.language !== 'unknown') stackParts.push(stack.language);

  lines.push('# Codebase Index');
  lines.push(`Stack: ${stackParts.join(' + ') || 'unknown'}`);
  lines.push('');

  // Structure (always included as lightweight overview)
  if (data.structure.length > 0) {
    lines.push('## Structure');
    for (const dir of data.structure) {
      lines.push(`  ${dir.name}`);
      for (const child of dir.children.slice(0, 5)) {
        lines.push(`    ${child}`);
      }
      if (dir.children.length > 5) lines.push(`    +${dir.children.length - 5} more`);
    }
    lines.push('');
  }

  // Routes
  if (data.routes.length > 0) {
    lines.push('## Routes');
    for (const r of data.routes) {
      const methods = r.methods.join(',');
      const tags = r.tags.length > 0 ? ` [${r.tags.join(',')}]` : '';
      lines.push(`  ${methods.padEnd(14)} ${r.path}${tags}`);
    }
    lines.push('');
  }

  // Schema
  if (data.schema.length > 0) {
    lines.push('## Schema');
    for (const t of data.schema) {
      lines.push(`  ${t.table} (${t.file})`);
      for (const c of t.columns) {
        const flags = c.flags.length > 0 ? ` ${c.flags.join(' ')}` : '';
        lines.push(`    ${c.name.padEnd(20)} ${c.type}${flags}`);
      }
    }
    lines.push('');
  }

  // Components
  if (data.components.length > 0) {
    lines.push('## Components');
    for (const c of data.components) {
      const client = c.client ? ' (c)' : '';
      const props = c.props.length > 0
        ? ` — ${c.props.slice(0, 6).map(p => `${p.name}${p.optional ? '?' : ''}`).join(', ')}${c.props.length > 6 ? ` +${c.props.length - 6}` : ''}`
        : '';
      lines.push(`  ${c.name}${client}${props}`);
      lines.push(`    ${c.file}`);
    }
    lines.push('');
  }

  // Lib exports
  if (data.libs.length > 0) {
    lines.push('## Lib');
    for (const l of data.libs) {
      const exps = l.exports.map(e => `${e.kind === 'type' ? 'T:' : ''}${e.name}`).join(', ');
      lines.push(`  ${l.file}`);
      lines.push(`    ${exps}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──

try {
  const stack = detectStack();
  const files = walk(projectDir);
  const data = {
    structure: extractStructure(),
    routes: extractRoutes(files),
    schema: extractSchema(files, stack),
    components: extractComponents(files),
    libs: extractLibExports(files),
  };

  const markdown = generateMarkdown(data, stack);

  // Write to .ultraship/codex.md
  const outputDir = join(projectDir, '.ultraship');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { mode: 0o700, recursive: true });

  const outputPath = join(outputDir, 'codex.md');
  writeFileSync(outputPath, markdown, { mode: 0o600 });

  const result = {
    success: true,
    output: outputPath,
    stack,
    stats: {
      routes: data.routes.length,
      tables: data.schema.length,
      components: data.components.length,
      libs: data.libs.length,
      lines: markdown.split('\n').length,
    },
    markdown,
  };

  console.log(JSON.stringify(result));
} catch (err) {
  console.log(JSON.stringify({ success: false, error: err.message }));
}
