// tests/code-profiler.test.mjs
// Tests for tools/code-profiler.mjs — static analysis for backend performance anti-patterns

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOL_PATH = join(__dirname, '..', 'tools', 'code-profiler.mjs');

/** Run the profiler on a directory, return parsed JSON output */
function run(dir) {
  const stdout = execFileSync('node', [TOOL_PATH, dir], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

/** Create a temp directory with a unique prefix */
function makeTmpDir(label) {
  return mkdtempSync(join(tmpdir(), `profiler-test-${label}-`));
}

// ──────────────────────────────────────────────────────────
// 1. Empty directory — no files to scan
// ──────────────────────────────────────────────────────────
describe('empty directory', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('returns success with zero findings', () => {
    tmp = makeTmpDir('empty');
    const result = run(tmp);
    assert.equal(result.success, true);
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.findings.length, 0);
  });
});

// ──────────────────────────────────────────────────────────
// 2. N+1 query detection — DB call inside a loop
// ──────────────────────────────────────────────────────────
describe('N+1 query detection', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects database query inside for...of loop', () => {
    tmp = makeTmpDir('n-plus-1');
    writeFileSync(join(tmp, 'service.ts'), `
import { db } from './db';

async function loadOrders(users) {
  for (const user of users) {
    const order = await db.query('SELECT * FROM orders WHERE user_id = $1', [user.id]);
    console.log(order);
  }
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1');
    assert.ok(n1.length >= 1, 'should detect at least one N+1 finding');
    assert.equal(n1[0].severity, 'high');
  });

  it('detects query inside forEach', () => {
    writeFileSync(join(tmp, 'repo.ts'), `
async function process(items) {
  items.forEach(async (item) => {
    const row = await prisma.order.findFirst({ where: { id: item.id } });
    console.log(row);
  });
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1' && f.file.includes('repo.ts'));
    assert.ok(n1.length >= 1, 'should detect N+1 inside forEach');
  });

  it('detects query inside .map()', () => {
    writeFileSync(join(tmp, 'mapper.ts'), `
async function enrich(ids) {
  const results = ids.map(async (id) => {
    return await prisma.user.findUnique({ where: { id } });
  });
  return Promise.all(results);
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1' && f.file.includes('mapper.ts'));
    assert.ok(n1.length >= 1, 'should detect N+1 inside .map()');
  });
});

// ──────────────────────────────────────────────────────────
// 3. Sync I/O in request handler
// ──────────────────────────────────────────────────────────
describe('sync I/O in request handler', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects readFileSync in a route handler', () => {
    tmp = makeTmpDir('sync-io');
    const apiDir = join(tmp, 'api');
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(apiDir, 'handler.ts'), `
import { readFileSync } from 'fs';

app.get('/config', (req, res) => {
  const data = readFileSync('/etc/config.json', 'utf8');
  res.json(JSON.parse(data));
});
`);
    const result = run(tmp);
    const syncFindings = result.findings.filter(f => f.category === 'sync-io');
    assert.ok(syncFindings.length >= 1, 'should detect readFileSync in handler');
    assert.equal(syncFindings[0].severity, 'high');
    assert.ok(syncFindings[0].message.includes('readFileSync'));
  });

  it('detects execSync in a route handler', () => {
    writeFileSync(join(tmp, 'api', 'exec-handler.ts'), `
import { execSync } from 'child_process';

router.post('/deploy', (req, res) => {
  const output = execSync('git pull');
  res.json({ output: output.toString() });
});
`);
    const result = run(tmp);
    const syncFindings = result.findings.filter(
      f => f.category === 'sync-io' && f.file.includes('exec-handler.ts')
    );
    assert.ok(syncFindings.length >= 1, 'should detect execSync in handler');
  });
});

// ──────────────────────────────────────────────────────────
// 4. Sync I/O in non-handler is NOT flagged
// ──────────────────────────────────────────────────────────
describe('handler vs non-handler distinction', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('does NOT flag readFileSync in a utility file (no handler markers)', () => {
    tmp = makeTmpDir('non-handler');
    writeFileSync(join(tmp, 'utils.ts'), `
import { readFileSync } from 'fs';

function loadConfig() {
  return JSON.parse(readFileSync('config.json', 'utf8'));
}

export { loadConfig };
`);
    const result = run(tmp);
    const syncFindings = result.findings.filter(f => f.category === 'sync-io');
    assert.equal(syncFindings.length, 0, 'should not flag sync I/O in non-handler files');
  });
});

// ──────────────────────────────────────────────────────────
// 5. Unbounded query detection
// ──────────────────────────────────────────────────────────
describe('unbounded query detection', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects findMany without take/limit', () => {
    tmp = makeTmpDir('unbounded');
    writeFileSync(join(tmp, 'list.ts'), `
async function listAll() {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return users;
}
`);
    const result = run(tmp);
    const ub = result.findings.filter(f => f.category === 'unbounded');
    assert.ok(ub.length >= 1, 'should detect findMany without take');
    assert.equal(ub[0].severity, 'high');
  });

  it('does NOT flag findMany with take', () => {
    writeFileSync(join(tmp, 'safe-list.ts'), `
async function listPaged() {
  const users = await prisma.user.findMany({
    where: { active: true },
    take: 50,
  });
  return users;
}
`);
    const result = run(tmp);
    const ub = result.findings.filter(f => f.category === 'unbounded' && f.file.includes('safe-list.ts'));
    assert.equal(ub.length, 0, 'should not flag findMany with take');
  });

  it('detects SELECT * without LIMIT', () => {
    writeFileSync(join(tmp, 'raw-query.ts'), `
async function rawQuery(db) {
  const rows = await db.query("SELECT * FROM orders WHERE status = 'active'");
  return rows;
}
`);
    const result = run(tmp);
    const ub = result.findings.filter(f => f.category === 'unbounded' && f.file.includes('raw-query.ts'));
    assert.ok(ub.length >= 1, 'should detect SELECT * without LIMIT');
  });
});

// ──────────────────────────────────────────────────────────
// 6. Sequential await detection
// ──────────────────────────────────────────────────────────
describe('sequential await detection', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects independent sequential awaits', () => {
    tmp = makeTmpDir('seq-await');
    writeFileSync(join(tmp, 'fetch.ts'), `
async function loadDashboard() {
  const users = await fetchUsers();
  const orders = await fetchOrders();
  return { users, orders };
}
`);
    const result = run(tmp);
    const seq = result.findings.filter(f => f.category === 'sequential-await');
    assert.ok(seq.length >= 1, 'should detect sequential awaits');
    assert.equal(seq[0].severity, 'low');
  });

  it('does NOT flag sequential awaits when second depends on first', () => {
    writeFileSync(join(tmp, 'dependent.ts'), `
async function loadUserOrders() {
  const user = await fetchUser(id);
  const orders = await fetchOrdersForUser(user);
  return orders;
}
`);
    const result = run(tmp);
    const seq = result.findings.filter(
      f => f.category === 'sequential-await' && f.file.includes('dependent.ts')
    );
    assert.equal(seq.length, 0, 'should not flag dependent sequential awaits');
  });
});

// ──────────────────────────────────────────────────────────
// 7. Memory leak — module-scoped array with .push()
// ──────────────────────────────────────────────────────────
describe('memory leak detection', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects module-scoped array with .push()', () => {
    tmp = makeTmpDir('memleak');
    writeFileSync(join(tmp, 'cache.ts'), `const requestLog = [];

export function logRequest(req) {
  requestLog.push({ url: req.url, time: Date.now() });
}
`);
    const result = run(tmp);
    const ml = result.findings.filter(f => f.category === 'memory-leak');
    assert.ok(ml.length >= 1, 'should detect module-scoped array with push');
    assert.ok(ml[0].message.includes('requestLog'));
  });
});

// ──────────────────────────────────────────────────────────
// 8. Event listener in handler
// ──────────────────────────────────────────────────────────
describe('event listener in handler', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects .on() event listener inside a route handler', () => {
    tmp = makeTmpDir('event-listener');
    const apiDir = join(tmp, 'api');
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(apiDir, 'stream-handler.ts'), `
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

app.get('/stream', (req, res) => {
  emitter.on('data', (chunk) => {
    res.write(chunk);
  });
});
`);
    const result = run(tmp);
    const ml = result.findings.filter(
      f => f.category === 'memory-leak' && f.message.includes('Event listener')
    );
    assert.ok(ml.length >= 1, 'should detect event listener in handler');
  });
});

// ──────────────────────────────────────────────────────────
// 9. JSON.parse without try/catch and dynamic RegExp in handler
// ──────────────────────────────────────────────────────────
describe('error handling and ReDoS in handlers', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects JSON.parse without try/catch in handler', () => {
    tmp = makeTmpDir('error-handling');
    const apiDir = join(tmp, 'api');
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(apiDir, 'parse-handler.ts'), `
app.post('/webhook', (req, res) => {
  const body = JSON.parse(req.body);
  res.json({ ok: true });
});
`);
    const result = run(tmp);
    const eh = result.findings.filter(f => f.category === 'error-handling');
    assert.ok(eh.length >= 1, 'should detect JSON.parse without try/catch');
  });

  it('does NOT flag JSON.parse inside try/catch', () => {
    writeFileSync(join(tmp, 'api', 'safe-parse-handler.ts'), `
app.post('/safe-webhook', (req, res) => {
  try {
    const body = JSON.parse(req.body);
    res.json(body);
  } catch (e) {
    res.status(400).json({ error: 'bad json' });
  }
});
`);
    const result = run(tmp);
    const eh = result.findings.filter(
      f => f.category === 'error-handling' && f.file.includes('safe-parse-handler.ts')
    );
    assert.equal(eh.length, 0, 'should not flag JSON.parse inside try/catch');
  });

  it('detects dynamic RegExp in handler (ReDoS risk)', () => {
    writeFileSync(join(tmp, 'api', 'regex-handler.ts'), `
app.get('/search', (req, res) => {
  const pattern = new RegExp(req.query.q, 'i');
  const results = items.filter(i => pattern.test(i.name));
  res.json(results);
});
`);
    const result = run(tmp);
    const redos = result.findings.filter(f => f.category === 'redos');
    assert.ok(redos.length >= 1, 'should detect dynamic RegExp in handler');
  });
});

// ──────────────────────────────────────────────────────────
// 10. Missing database index detection
// ──────────────────────────────────────────────────────────
describe('missing database index detection', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('detects Drizzle foreign key without index', () => {
    tmp = makeTmpDir('missing-index');
    writeFileSync(join(tmp, 'schema.ts'), `
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  total: integer('total'),
});
`);
    const result = run(tmp);
    const idx = result.findings.filter(f => f.category === 'missing-index');
    assert.ok(idx.length >= 1, 'should detect FK without index');
    assert.ok(idx[0].message.includes('users'));
  });
});

// ──────────────────────────────────────────────────────────
// 11. Clean code — no false positives
// ──────────────────────────────────────────────────────────
describe('clean code produces no findings', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('reports zero findings for clean handler code', () => {
    tmp = makeTmpDir('clean');
    const apiDir = join(tmp, 'api');
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(apiDir, 'handler.ts'), `
import { readFile } from 'fs/promises';

app.get('/health', async (req, res) => {
  const [users, config] = await Promise.all([
    prisma.user.findMany({ take: 10 }),
    readFile('/etc/config.json', 'utf8'),
  ]);
  try {
    const parsed = JSON.parse(config);
    res.json({ users, config: parsed });
  } catch (e) {
    res.status(500).json({ error: 'config parse error' });
  }
});
`);
    const result = run(tmp);
    assert.equal(result.success, true);
    assert.equal(result.total_findings, 0, 'clean code should have zero findings');
    assert.equal(result.performance_score, 100, 'clean code should score 100');
  });
});

// ──────────────────────────────────────────────────────────
// 12. Performance score calculation
// ──────────────────────────────────────────────────────────
describe('performance score', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('subtracts correctly: high=-5, medium=-2, low=-0.5', () => {
    tmp = makeTmpDir('score');
    const apiDir = join(tmp, 'api');
    mkdirSync(apiDir, { recursive: true });
    // 1 high (N+1) + 1 high (sync I/O) = 100 - 5 - 5 = 90
    writeFileSync(join(apiDir, 'controller.ts'), `
import { readFileSync } from 'fs';

app.get('/data', async (req, res) => {
  const config = readFileSync('config.json', 'utf8');
  const users = await getUsers();
  for (const user of users) {
    const profile = await db.query('SELECT * FROM profiles WHERE uid = $1', [user.id]);
  }
});
`);
    const result = run(tmp);
    assert.ok(result.performance_score < 100, 'score should be below 100');
    // Should have at least two high findings (N+1 + sync-io)
    const highCount = result.findings.filter(f => f.severity === 'high').length;
    assert.ok(highCount >= 2, 'should have at least two high findings');
  });

  it('score never goes below 0', () => {
    // Write many bad patterns to drive score well below 0
    writeFileSync(join(tmp, 'api', 'terrible.ts'), `
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

app.get('/bad', async (req, res) => {
  readFileSync('a'); writeFileSync('b', ''); readdirSync('c');
  statSync('d'); existsSync('e'); copyFileSync('f', 'g'); mkdirSync('h');
  execSync('ls');
  for (const x of items) {
    await db.query('SELECT 1');
    await prisma.user.findFirst({ where: { id: x } });
  }
});
`);
    const result = run(tmp);
    assert.ok(result.performance_score >= 0, 'score should never go below 0');
  });
});

// ──────────────────────────────────────────────────────────
// 13. Braceless .map() arrow — no false positives on later code
// ──────────────────────────────────────────────────────────
describe('braceless arrow false positive regression', () => {
  let tmp;
  after(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('does NOT flag DB queries after a braceless .map() call', () => {
    tmp = makeTmpDir('braceless-map');
    writeFileSync(join(tmp, 'admin.ts'), `
import { db } from './db';

async function getStats() {
  const allUsers = await db.query('SELECT tier, count(*) FROM users GROUP BY tier');
  const tiers = allUsers.map((r) => [r.tier, r.count]);

  // This query is NOT inside the .map() — should not be flagged
  const revenue = await db.query('SELECT sum(amount) FROM payments');
  const churn = await db.query('SELECT count(*) FROM cancellations');
  return { tiers, revenue, churn };
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1');
    assert.equal(n1.length, 0, 'braceless .map() should not cause false N+1 findings on subsequent queries');
  });

  it('DOES flag DB query inside a braceless .map() that actually queries', () => {
    writeFileSync(join(tmp, 'enricher.ts'), `
async function enrich(userIds) {
  const details = userIds.map(async (id) => await prisma.user.findUnique({ where: { id } }));
  return Promise.all(details);
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1' && f.file.includes('enricher.ts'));
    assert.ok(n1.length >= 1, 'should detect N+1 inside braceless .map() with DB query');
  });

  it('does NOT flag Drizzle query builder chaining as N+1', () => {
    writeFileSync(join(tmp, 'drizzle-query.ts'), `
import { db } from './db';

async function getActiveUsers() {
  for (const filter of filters) {
    console.log(filter.name);
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.active, true));
  return users;
}
`);
    const result = run(tmp);
    const n1 = result.findings.filter(f => f.category === 'n+1' && f.file.includes('drizzle-query.ts'));
    assert.equal(n1.length, 0, 'Drizzle .select().from().where() outside loop should not be flagged');
  });
});
