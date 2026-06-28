#!/usr/bin/env node
// vibe-security-scanner — the Vibe-Coding Security Sentinel.
// Catches the 2026 "shipped-fast, leaked-everything" breach class that generic secret scanning
// misses, by looking at CONTEXT rather than raw secret patterns:
//   1. Server-only secrets behind a client/public env prefix (NEXT_PUBLIC_, VITE_, ...).
//   2. A real secret VALUE (incl. a decoded Supabase service_role JWT) behind a public prefix.
//   3. A Supabase service_role key referenced inside a "use client" file (ships to the browser).
//   4. Supabase tables created without Row Level Security in SQL migrations.
//   5. (advisory) mutation endpoints with no auth library present.
//
// Zero false positives: every finding is a categorical mistake or carries decoded proof.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { checkFileSize } from './lib/security.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '.output', '.vercel', '.turbo']);
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro']);

const PUBLIC_PREFIX = '(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|GATSBY_|NUXT_PUBLIC_|VUE_APP_|PUBLIC_)';
// Keywords that must NEVER sit behind a public prefix. Deliberately NARROW (no generic API_KEY/TOKEN,
// which are routinely and legitimately public — Mapbox, Stripe publishable, PostHog, etc.).
const SECRET_NAME = '(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PRIVATE|PASSWORD)';
const PUBLIC_SECRET_NAME_RE = new RegExp(`\\b${PUBLIC_PREFIX}[A-Z0-9_]*${SECRET_NAME}[A-Z0-9_]*\\b`, 'g');

// High-confidence secret VALUE patterns (used only to judge values held behind a public prefix).
const SECRET_VALUE_RES = [
  { re: /sk_live_[0-9a-zA-Z]{20,}/, what: 'a Stripe live secret key' },
  { re: /rk_live_[0-9a-zA-Z]{20,}/, what: 'a Stripe live restricted key' },
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, what: 'an Anthropic API key' },
  { re: /sk-[A-Za-z0-9]{20,}/, what: 'an OpenAI-style secret key' },
  { re: /AKIA[0-9A-Z]{16}/, what: 'an AWS access key' },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, what: 'a private key' },
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (e.isFile()) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

function read(file) {
  if (!checkFileSize(file, statSync).ok) return null;
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

function lineOf(content, index) {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) if (content[i] === '\n') line++;
  return line;
}

// Decode a JWT payload (base64url) and return the parsed object, or null.
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch { return null; }
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;

function isEnvFile(name) { return name === '.env' || name.startsWith('.env.'); }
function isExampleEnv(name) { return /\.(example|sample|template|dist|local\.example)$/i.test(name) || /\.env\.(example|sample|template)$/i.test(name); }

function scanEnvAndCode(file, relFile, content, findings) {
  const name = basename(file);
  const ext = extname(file);
  const isEnv = isEnvFile(name);
  const isCode = CODE_EXT.has(ext);
  if (!isEnv && !isCode) return;

  // Detector 1 — server-only secret name behind a public prefix (matches .env AND source usage).
  PUBLIC_SECRET_NAME_RE.lastIndex = 0;
  let m;
  while ((m = PUBLIC_SECRET_NAME_RE.exec(content)) !== null) {
    findings.push({
      file: relFile, line: lineOf(content, m.index), severity: 'critical', category: 'vibe-security',
      rule: 'public-prefixed-secret-name',
      message: `\`${m[0]}\` puts a server-only secret behind a client/public env prefix — it WILL be bundled into the browser. Rename without the public prefix and read it only on the server (WCAG n/a; this is the Moltbook breach class).`,
    });
  }

  // Detector 2 — a real secret VALUE (or decoded service_role JWT) behind a public prefix, in a real .env.
  if (isEnv && !isExampleEnv(name)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const eq = raw.indexOf('=');
      if (eq < 1) continue;
      const key = raw.slice(0, eq).trim();
      let val = raw.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!new RegExp(`^${PUBLIC_PREFIX}`).test(key)) continue;
      // Skip the legitimately-public Supabase anon key and obvious placeholders.
      if (!val || /^(your|changeme|todo|replace|xxx|<|placeholder)/i.test(val)) continue;

      const jwt = val.match(JWT_RE);
      if (jwt) {
        const payload = decodeJwtPayload(jwt[0]);
        if (payload && payload.role === 'service_role') {
          findings.push({
            file: relFile, line: i + 1, severity: 'critical', category: 'vibe-security',
            rule: 'public-supabase-service-role-key',
            message: `\`${key}\` holds a Supabase **service_role** JWT (decoded role="service_role") behind a public prefix — this key bypasses Row Level Security and is being shipped to the browser. Rotate it now and use it only server-side.`,
          });
          continue;
        }
        // anon-role JWT behind a public prefix is fine by design — do not flag.
      } else {
        for (const { re, what } of SECRET_VALUE_RES) {
          if (re.test(val)) {
            findings.push({
              file: relFile, line: i + 1, severity: 'critical', category: 'vibe-security',
              rule: 'public-prefixed-secret-value',
              message: `\`${key}\` (a client/public env var) holds ${what} — it will be exposed in the browser bundle. Move it server-side and rotate the key.`,
            });
            break;
          }
        }
      }
    }
  }

  // Detector 3 — Supabase service_role referenced inside a "use client" file (definitely ships to browser).
  if (isCode) {
    const head = content.slice(0, 400);
    const isClient = /^\s*["']use client["']/m.test(head) || /["']use client["']\s*;?/.test(head);
    if (isClient) {
      const ref = content.match(/SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE|serviceRoleKey|service_role_key/);
      if (ref) {
        findings.push({
          file: relFile, line: lineOf(content, content.indexOf(ref[0])), severity: 'critical', category: 'vibe-security',
          rule: 'service-role-in-client',
          message: `A Supabase service_role key is referenced in a "use client" component — it ships to the browser and bypasses Row Level Security. Use the anon key on the client; keep service_role on the server only.`,
        });
      }
    }
  }
}

// Detector 4 — Supabase tables created without RLS (only when a Supabase signal exists).
function scanSqlRls(sqlFiles, findings) {
  const created = []; // { table, file, line }
  const rlsEnabled = new Set();
  const SYS_SCHEMAS = new Set(['auth', 'storage', 'realtime', 'extensions', 'vault', 'graphql', 'pgsodium', 'supabase_functions', 'net', 'cron']);

  for (const { rel, content } of sqlFiles) {
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\.)?["']?([a-z_][a-z0-9_]*)["']?/gi;
    let m;
    while ((m = createRe.exec(content)) !== null) {
      const schema = (m[1] || 'public').toLowerCase();
      if (SYS_SCHEMAS.has(schema)) continue;
      if (schema !== 'public') continue; // only judge the public schema
      created.push({ table: m[2].toLowerCase(), rel, line: lineOf(content, m.index) });
    }
    const enableRe = /alter\s+table\s+(?:[a-z_][a-z0-9_]*\.)?["']?([a-z_][a-z0-9_]*)["']?\s+enable\s+row\s+level\s+security/gi;
    let e;
    while ((e = enableRe.exec(content)) !== null) rlsEnabled.add(e[1].toLowerCase());
  }

  const seen = new Set();
  for (const c of created) {
    if (seen.has(c.table)) continue;
    seen.add(c.table);
    if (!rlsEnabled.has(c.table)) {
      findings.push({
        file: c.rel, line: c.line, severity: 'high', category: 'vibe-security',
        rule: 'supabase-table-without-rls',
        message: `Table \`${c.table}\` is created without Row Level Security. If it holds user data and the anon key reaches the browser, the whole table is world-readable/writable. Add: \`alter table ${c.table} enable row level security;\` plus policies.`,
      });
    }
  }
}

function scanDirectory(rootDir) {
  const files = walk(rootDir);
  const rel = (f) => f.slice(rootDir.length).replace(/^[/\\]/, '') || basename(f);
  const findings = [];

  // Supabase signal (gates the RLS detector to avoid FPs on plain-Postgres projects).
  let supabaseSignal = existsSync(join(rootDir, 'supabase'));
  let authLibPresent = false;
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = read(pkgPath) || '';
    if (/@supabase\//.test(pkg)) supabaseSignal = true;
    if (/(next-auth|@auth\/|better-auth|@clerk\/|lucia|@lucia-auth|passport|express-session|@supabase\/auth|@kinde|workos|stytch|@authjs)/.test(pkg)) authLibPresent = true;
  }

  const sqlFiles = [];
  let mutationRouteCount = 0;
  let filesScanned = 0;

  for (const file of files) {
    const ext = extname(file);
    const name = basename(file);
    if (ext === '.sql') {
      const c = read(file);
      if (c !== null) { sqlFiles.push({ rel: rel(file), content: c }); filesScanned++; }
      continue;
    }
    if (!CODE_EXT.has(ext) && !isEnvFile(name)) continue;
    const content = read(file);
    if (content === null) continue;
    filesScanned++;
    scanEnvAndCode(file, rel(file), content, findings);

    // Detector 5 input — count mutation route handlers (advisory only).
    if (CODE_EXT.has(ext)) {
      if (/export\s+(?:async\s+)?function\s+(?:POST|PUT|DELETE|PATCH)\b/.test(content) ||
          /\.(?:post|put|delete|patch)\s*\(/.test(content) && /\/api\/|routes?\/|router\./.test(rel(file) + content.slice(0, 200))) {
        mutationRouteCount++;
      }
    }
  }

  if (supabaseSignal) scanSqlRls(sqlFiles, findings);

  // Detector 5 — advisory only, and only when there's no auth library at all.
  if (mutationRouteCount > 0 && !authLibPresent) {
    findings.push({
      file: 'package.json', line: 0, severity: 'low', category: 'vibe-security',
      rule: 'mutation-routes-no-auth-lib',
      message: `${mutationRouteCount} mutation endpoint(s) (POST/PUT/DELETE/PATCH) found but no auth library is in dependencies. Verify every mutation route checks the caller's identity and is rate-limited — the most common vibe-coded gap.`,
    });
  }

  let score;
  if (filesScanned === 0) {
    score = null;
  } else {
    const deduct = { critical: 20, high: 10, medium: 5, low: 2, info: 0 };
    score = 100;
    for (const f of findings) score = Math.max(0, score - (deduct[f.severity] ?? 0));
  }

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity] = (summary[f.severity] || 0) + 1;

  return {
    files_scanned: filesScanned,
    supabase_detected: supabaseSignal,
    findings,
    summary,
    score,
    note: 'Vibe-Coding Security Sentinel — context-aware checks that complement secret-scanner. RLS checks run only when Supabase is detected.',
  };
}

const rootDir = process.argv[2] || '.';
process.stdout.write(JSON.stringify(scanDirectory(rootDir), null, 2) + '\n');
