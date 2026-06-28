import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'vibe-security-scanner.mjs');

function scan(dir) {
  return JSON.parse(execFileSync('node', [TOOL, dir], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
}
function b64u(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Realistic-length signature so it matches the scanner's JWT pattern.
function jwt(role) {
  return `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ role, iss: 'supabase' })}.${'a'.repeat(43)}`;
}
function hasRule(r, rule) { return r.findings.some(f => f.rule === rule); }
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-vibe-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('vibe-security-scanner', () => {
  it('outputs valid JSON with score null on an empty directory', () => {
    const r = scan(tmp);
    assert.equal(r.files_scanned, 0);
    assert.equal(r.score, null);
    assert.ok(Array.isArray(r.findings));
  });

  it('reports ZERO findings on a clean project (anon key, public token, server-only secrets, RLS, auth lib)', () => {
    write(tmp, '.env', [
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${jwt('anon')}`,
      'NEXT_PUBLIC_MAPBOX_TOKEN=pk.abc123',
      'STRIPE_SECRET_KEY=server-only-no-public-prefix-so-fine',
      'SUPABASE_SERVICE_ROLE_KEY=server-only-no-public-prefix',
    ].join('\n'));
    write(tmp, 'package.json', JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2', '@clerk/nextjs': '^5' } }));
    write(tmp, 'db.sql', 'create table public.profiles (id uuid);\nalter table profiles enable row level security;\n');
    write(tmp, 'src/page.tsx', 'export default function P(){ return null }\n');
    const r = scan(tmp);
    assert.equal(r.findings.length, 0, `expected 0 findings, got ${JSON.stringify(r.findings.map(f => f.rule))}`);
    assert.equal(r.score, 100);
  });

  it('flags a server-only secret name behind a public prefix', () => {
    write(tmp, '.env', 'NEXT_PUBLIC_STRIPE_SECRET_KEY=whatever\n');
    assert.ok(hasRule(scan(tmp), 'public-prefixed-secret-name'));
  });

  it('does NOT flag legitimately-public client vars (anon key, publishable token)', () => {
    write(tmp, '.env', `NEXT_PUBLIC_SUPABASE_ANON_KEY=${jwt('anon')}\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_abc\nNEXT_PUBLIC_API_URL=https://api.example.com\n`);
    const r = scan(tmp);
    assert.equal(r.findings.length, 0, JSON.stringify(r.findings.map(f => f.rule)));
  });

  it('flags a real secret VALUE behind a public prefix (AWS example key)', () => {
    // AKIAIOSFODNN7EXAMPLE is AWS's documented example key — matches the AKIA pattern but is not a live credential.
    write(tmp, '.env', 'NEXT_PUBLIC_AWS_KEY=AKIAIOSFODNN7EXAMPLE\n');
    assert.ok(hasRule(scan(tmp), 'public-prefixed-secret-value'));
  });

  it('decodes and flags a Supabase service_role JWT behind a public prefix', () => {
    write(tmp, '.env', `NEXT_PUBLIC_SB=${jwt('service_role')}\n`);
    assert.ok(hasRule(scan(tmp), 'public-supabase-service-role-key'));
  });

  it('does NOT flag an anon JWT behind a public prefix (anon is public by design)', () => {
    write(tmp, '.env', `NEXT_PUBLIC_SB=${jwt('anon')}\n`);
    assert.ok(!hasRule(scan(tmp), 'public-supabase-service-role-key'));
  });

  it('flags a service_role key referenced inside a "use client" file', () => {
    write(tmp, 'src/Admin.tsx', '"use client";\nconst c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);\n');
    assert.ok(hasRule(scan(tmp), 'service-role-in-client'));
  });

  it('does NOT flag service_role usage in a server file (no "use client")', () => {
    write(tmp, 'src/server.ts', 'const c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);\n');
    assert.ok(!hasRule(scan(tmp), 'service-role-in-client'));
  });

  it('flags a Supabase table created without RLS', () => {
    write(tmp, 'package.json', JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2' } }));
    write(tmp, 'supabase/migrations/001.sql', 'create table public.profiles (id uuid);\n');
    assert.ok(hasRule(scan(tmp), 'supabase-table-without-rls'));
  });

  it('does NOT flag a table that has RLS enabled', () => {
    write(tmp, 'package.json', JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2' } }));
    write(tmp, 'supabase/migrations/001.sql', 'create table public.posts (id uuid);\nalter table posts enable row level security;\n');
    assert.ok(!hasRule(scan(tmp), 'supabase-table-without-rls'));
  });

  it('does NOT run the RLS check on a non-Supabase Postgres project', () => {
    write(tmp, 'package.json', JSON.stringify({ dependencies: { pg: '^8' } }));
    write(tmp, 'db/schema.sql', 'create table public.widgets (id serial primary key);\n');
    const r = scan(tmp);
    assert.equal(r.supabase_detected, false);
    assert.ok(!hasRule(r, 'supabase-table-without-rls'));
  });

  it('advises on mutation routes when no auth library is present', () => {
    write(tmp, 'package.json', JSON.stringify({ dependencies: { hono: '^4' } }));
    write(tmp, 'src/api/route.ts', 'export async function POST(req){ return new Response("ok"); }\n');
    assert.ok(hasRule(scan(tmp), 'mutation-routes-no-auth-lib'));
  });

  it('does NOT advise on mutation routes when an auth library IS present', () => {
    write(tmp, 'package.json', JSON.stringify({ dependencies: { 'better-auth': '^1' } }));
    write(tmp, 'src/api/route.ts', 'export async function POST(req){ return new Response("ok"); }\n');
    assert.ok(!hasRule(scan(tmp), 'mutation-routes-no-auth-lib'));
  });
});
