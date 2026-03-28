#!/usr/bin/env node
// tools/incident-commander.mjs
// Production Incident Commander — diagnose and recover from production incidents
// Usage: node tools/incident-commander.mjs <project-directory> [--url=<production-url>]
// Safe: reads files + git history, optional HTTP GET to production URL

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execFileSync } from 'child_process';
import https from 'https';
import http from 'http';
import { validateUrl, createResponseAccumulator, checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
function checkHealth(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) { resolve({ success: false, error: urlCheck.reason }); return; }
    const start = Date.now();
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'Ultraship-Rescue/1.0' } }, (res) => {
      const acc = createResponseAccumulator();
      res.on('data', (c) => acc.onData(c));
      res.on('end', () => {
        resolve({ success: true, status_code: res.statusCode, response_time_ms: Date.now() - start, body_length: acc.getTotalSize() });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.on('error', (e) => { resolve({ success: false, error: e.message }); });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Git analysis
// ---------------------------------------------------------------------------
function gitCmd(args, dir) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 }).trim(); } catch { return ''; }
}

function analyzeGit(dir) {
  const last5Raw = gitCmd(['log', '--format=%H|||%s|||%aI', '-5'], dir);
  const last5 = last5Raw ? last5Raw.split('\n').map(line => {
    const [hash, message, date] = line.split('|||');
    let filesChanged = 0;
    try {
      const stat = gitCmd(['diff', '--shortstat', `${hash}^`, hash], dir);
      const m = stat.match(/(\d+) file/);
      if (m) filesChanged = parseInt(m[1]);
    } catch {}
    return { hash: hash?.slice(0, 7), full_hash: hash, message, date, files_changed: filesChanged };
  }) : [];

  const commits24h = gitCmd(['log', '--oneline', '--since=24 hours ago'], dir);
  const commits24hCount = commits24h ? commits24h.split('\n').filter(Boolean).length : 0;

  const lastCommitStat = gitCmd(['diff', '--stat', 'HEAD~1', 'HEAD'], dir);
  const recentFiles = lastCommitStat ? lastCommitStat.split('\n').filter(l => l.includes('|')).map(l => l.trim().split(/\s+/)[0]) : [];

  // Likely culprit: most recent commit with most file changes
  const culprit = last5.length > 0 ? last5.reduce((a, b) => b.files_changed > a.files_changed ? b : a, last5[0]) : null;

  return { commits_24h: commits24hCount, last_5_commits: last5, likely_culprit: culprit, files_changed_recently: recentFiles };
}

// ---------------------------------------------------------------------------
// Error pattern scanning
// ---------------------------------------------------------------------------
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage']);

function walkFiles(dir, maxFiles = 500) {
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
      else if (CODE_EXTS.has(extname(e.name))) files.push(full);
    }
  }
  walk(dir, 0);
  return files;
}

function scanErrorPatterns(dir) {
  const findings = [];
  const files = walkFiles(dir);

  for (const file of files) {
    const rel = file.replace(dir + '/', '');
    if (/\.(test|spec)\./i.test(rel) || /__tests__/i.test(rel)) continue;

    const sc = checkFileSize(file, statSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      // Unhandled await (not in try block)
      if (/\bawait\b/.test(line) && !/\.catch\(/.test(line)) {
        let inTry = false;
        for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
          if (/\btry\s*\{/.test(lines[j])) { inTry = true; break; }
          if (/\bcatch\s*\(/.test(lines[j])) { inTry = true; break; }
        }
        if (!inTry && /\b(app|router|server|fastify)\.(get|post|put|delete|patch)\b/i.test(content.slice(0, content.indexOf(line)))) {
          findings.push({ severity: 'high', pattern: 'unhandled_await', file: rel, line: ln, message: `Await without try/catch in potential route handler` });
        }
      }

      // Hardcoded secrets (basic detection)
      if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}/i.test(line) && !/\.env|example|test|mock/i.test(rel)) {
        findings.push({ severity: 'critical', pattern: 'hardcoded_secret', file: rel, line: ln, message: 'Possible hardcoded secret — should be in environment variable' });
      }
    }
  }

  // Check env vars
  const envIssues = [];
  const examplePath = join(dir, '.env.example');
  const envPath = join(dir, '.env');
  if (existsSync(examplePath)) {
    const exampleContent = readFileSync(examplePath, 'utf8');
    const requiredVars = exampleContent.split('\n').map(l => l.split('=')[0].trim()).filter(v => v && !v.startsWith('#'));
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');
      const envVars = envContent.split('\n').map(l => l.split('=')[0].trim()).filter(v => v && !v.startsWith('#'));
      for (const v of requiredVars) {
        if (!envVars.includes(v)) {
          envIssues.push({ var: v, status: 'missing_in_env', required_by: '.env.example' });
        }
      }
    } else {
      envIssues.push({ var: '.env', status: 'file_missing', required_by: '.env.example exists but .env does not' });
    }
  }

  return { findings, env_issues: envIssues };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const urlFlag = args.find(a => a.startsWith('--url='));
  const url = urlFlag ? urlFlag.replace('--url=', '') : null;

  if (!dir) {
    output({ error: 'Usage: node incident-commander.mjs <project-directory> [--url=<production-url>]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  // Phase 1: Health check (if URL provided)
  let incidentStatus = { site_status: 'unknown', response_time_ms: null, status_code: null, health_endpoint: 'unknown' };
  if (url) {
    const [mainCheck, healthCheck] = await Promise.all([
      checkHealth(url),
      checkHealth(url.replace(/\/$/, '') + '/health').catch(() => checkHealth(url.replace(/\/$/, '') + '/healthz')),
    ]);
    if (mainCheck.success) {
      incidentStatus.status_code = mainCheck.status_code;
      incidentStatus.response_time_ms = mainCheck.response_time_ms;
      incidentStatus.site_status = mainCheck.status_code >= 500 ? 'down' : mainCheck.status_code >= 400 ? 'degraded' : mainCheck.response_time_ms > 5000 ? 'degraded' : 'up';
    } else {
      incidentStatus.site_status = 'down';
    }
    incidentStatus.health_endpoint = healthCheck?.success && healthCheck?.status_code < 400 ? 'up' : 'down';
  }

  // Phase 2: Git analysis
  const recentChanges = analyzeGit(dir);

  // Phase 3: Error patterns
  const errorPatterns = scanErrorPatterns(dir);

  // Phase 4: Recovery plan
  const culpritHash = recentChanges.likely_culprit?.full_hash || recentChanges.likely_culprit?.hash || 'HEAD';
  const recovery = {
    rollback_command: `git revert ${culpritHash.slice(0, 7)} --no-edit && git push`,
    vercel_rollback: `git revert ${culpritHash.slice(0, 7)} --no-edit && git push origin main`,
    railway_rollback: 'railway service rollback (or redeploy previous commit from Railway dashboard)',
    quick_fixes: [],
  };

  for (const f of errorPatterns.findings.slice(0, 5)) {
    if (f.pattern === 'unhandled_await') recovery.quick_fixes.push(`Add try/catch to route handler in ${f.file}:${f.line}`);
    if (f.pattern === 'hardcoded_secret') recovery.quick_fixes.push(`Move hardcoded secret to env variable in ${f.file}:${f.line}`);
  }
  for (const e of errorPatterns.env_issues.slice(0, 3)) {
    recovery.quick_fixes.push(`Set ${e.var} environment variable`);
  }

  // Post-mortem template
  const today = new Date().toISOString().split('T')[0];
  const postMortem = `## Incident Report\n\n**Date:** ${today}\n**Duration:** TBD\n**Severity:** ${incidentStatus.site_status === 'down' ? 'P1 — Site Down' : incidentStatus.site_status === 'degraded' ? 'P2 — Degraded' : 'P3 — Investigation'}\n**Summary:** [What happened]\n\n### Timeline\n- [time] — Issue detected\n- [time] — Investigation started (Ultraship /rescue)\n- [time] — Root cause identified: ${recentChanges.likely_culprit?.message || 'TBD'}\n- [time] — Fix deployed\n- [time] — Service restored\n\n### Root Cause\n${recentChanges.likely_culprit ? `Likely caused by commit ${recentChanges.likely_culprit.hash}: "${recentChanges.likely_culprit.message}" (${recentChanges.likely_culprit.files_changed} files changed)` : '[Describe root cause]'}\n\n### What Went Well\n- [ ] Fast detection\n- [ ] Quick recovery\n\n### What Went Wrong\n- [ ] [Describe what failed]\n\n### Action Items\n- [ ] Add test coverage for the failure case\n- [ ] Add monitoring/alerting for this pattern\n- [ ] Update deployment checklist\n- [ ] Run /ship before next deploy`;

  output({
    success: true,
    incident_status: incidentStatus,
    recent_changes: recentChanges,
    error_patterns: errorPatterns,
    recovery,
    post_mortem_template: postMortem,
  });
}

main();
