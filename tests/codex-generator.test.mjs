import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'codex-generator.mjs');

function runCodex(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-codex-'));
}

function write(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('codex-generator', () => {
  // 1. Empty project -> success with zeroed stats
  describe('empty project', () => {
    let tmpDir;
    before(() => { tmpDir = makeTmpDir(); });
    after(() => { cleanup(tmpDir); });

    it('succeeds and reports zero routes/tables/components/libs', () => {
      const result = runCodex(tmpDir);
      assert.equal(result.success, true);
      assert.equal(result.stats.routes, 0);
      assert.equal(result.stats.tables, 0);
      assert.equal(result.stats.components, 0);
      assert.equal(result.stats.libs, 0);
    });

    it('writes the index to .ultraship/codex.md', () => {
      const result = runCodex(tmpDir);
      assert.ok(result.output.endsWith(path.join('.ultraship', 'codex.md')));
      assert.equal(fs.existsSync(path.join(tmpDir, '.ultraship', 'codex.md')), true);
      const md = fs.readFileSync(path.join(tmpDir, '.ultraship', 'codex.md'), 'utf8');
      assert.match(md, /^# Codebase Index/);
    });
  });

  // 2. Stack detection + Hono route extraction
  describe('Hono project', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'package.json', JSON.stringify({
        dependencies: { hono: '^4.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }));
      write(tmpDir, 'src/index.ts', [
        "import { Hono } from 'hono';",
        "const app = new Hono();",
        "app.get('/users', (c) => c.json([]));",
        "app.post('/users', (c) => c.json({}));",
        "app.get('/users/:id', (c) => c.json({}));",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('detects typescript + hono', () => {
      const result = runCodex(tmpDir);
      assert.equal(result.stack.language, 'typescript');
      assert.ok(result.stack.frameworks.includes('hono'));
    });

    it('extracts GET and POST routes with merged methods', () => {
      const result = runCodex(tmpDir);
      const md = result.markdown;
      assert.match(md, /\/users\b/);
      assert.match(md, /\/users\/:id/);
      assert.ok(result.stats.routes >= 2);
    });
  });

  // 3. Next.js app router route handlers
  describe('Next.js app router', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'package.json', JSON.stringify({
        dependencies: { next: '^15.0.0', react: '^18.0.0' },
      }));
      write(tmpDir, 'app/api/health/route.ts', [
        "export async function GET() { return Response.json({ ok: true }); }",
        "export async function POST() { return Response.json({}); }",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('detects nextjs and maps the route path', () => {
      const result = runCodex(tmpDir);
      assert.ok(result.stack.frameworks.includes('nextjs'));
      assert.match(result.markdown, /\/api\/health/);
    });
  });

  // 4. Regression: route matcher must not emit garbage from non-route code
  describe('route path validation', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'package.json', JSON.stringify({ dependencies: { hono: '^4.0.0' } }));
      // A real route alongside code that the generic matcher would otherwise
      // capture as a bogus "route" (string with spaces / operators after .get/.post).
      write(tmpDir, 'src/server.ts', [
        "app.get('/legit', (c) => c.text('ok'));",
        "if (router.post('this is not a route path', x) || something) {}",
        "const msg = api.get('value || fallback');",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('keeps the legit route', () => {
      const result = runCodex(tmpDir);
      assert.match(result.markdown, /\/legit/);
    });

    it('drops paths containing whitespace or operators', () => {
      const result = runCodex(tmpDir);
      const md = result.markdown;
      assert.ok(!md.includes('this is not a route path'));
      assert.ok(!/\|\|/.test(md.split('## Lib')[0] || md));
    });
  });

  // 5. Drizzle schema extraction
  describe('Drizzle schema', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'package.json', JSON.stringify({
        dependencies: { 'drizzle-orm': '^0.30.0' },
      }));
      write(tmpDir, 'src/db/schema.ts', [
        "import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';",
        "export const users = pgTable('users', {",
        "  id: uuid('id').primaryKey(),",
        "  email: text('email').notNull().unique(),",
        "  createdAt: timestamp('created_at').defaultNow(),",
        "});",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('detects drizzle and extracts the table, skipping audit fields', () => {
      const result = runCodex(tmpDir);
      assert.ok(result.stack.orms.includes('drizzle'));
      assert.equal(result.stats.tables, 1);
      const md = result.markdown;
      assert.match(md, /users \(/);
      assert.match(md, /\bemail\b/);
      assert.ok(!md.includes('createdAt'), 'audit field createdAt should be skipped');
    });
  });

  // 6. React component extraction (skips primitives)
  describe('React components', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'package.json', JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }));
      write(tmpDir, 'src/components/UserCard.tsx', [
        "interface UserCardProps { name: string; age?: number; }",
        "export function UserCard({ name, age }: UserCardProps) {",
        "  return <div>{name}</div>;",
        "}",
      ].join('\n'));
      // A shadcn-style primitive that must be skipped
      write(tmpDir, 'src/components/ui/Button.tsx', [
        "export function Button() { return <button />; }",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('extracts named component with props but skips UI primitives', () => {
      const result = runCodex(tmpDir);
      const md = result.markdown;
      assert.match(md, /UserCard/);
      assert.match(md, /name/);
      const names = result.markdown;
      assert.ok(!/^\s*Button\b/m.test(names), 'Button primitive should be skipped');
    });
  });

  // 7. Lib exports extraction
  describe('lib exports', () => {
    let tmpDir;
    before(() => {
      tmpDir = makeTmpDir();
      write(tmpDir, 'src/lib/format.ts', [
        "export function formatDate(d: Date): string { return ''; }",
        "export const SLUG = 'x';",
        "export type Money = number;",
      ].join('\n'));
    });
    after(() => { cleanup(tmpDir); });

    it('lists exported functions, consts, and types from lib dirs', () => {
      const result = runCodex(tmpDir);
      assert.ok(result.stats.libs >= 1);
      const md = result.markdown;
      assert.match(md, /formatDate/);
      assert.match(md, /SLUG/);
      assert.match(md, /Money/);
    });
  });

  // 8. Never crashes — always exits 0 with JSON, even on a bad path
  describe('error handling', () => {
    it('returns valid JSON for a nonexistent directory', () => {
      const result = runCodex(path.join(os.tmpdir(), 'ultraship-codex-does-not-exist-zzz'));
      assert.equal(typeof result.success, 'boolean');
    });
  });
});
