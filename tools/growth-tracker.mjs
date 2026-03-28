#!/usr/bin/env node
// tools/growth-tracker.mjs
// Post-Ship Growth Intelligence — tracks growth metrics over time
// Usage: node tools/growth-tracker.mjs <project-directory> [--url=<url>] [--save] [--show]
// Safe: reads files + git history, optional HTTP GET, writes to .ultraship/

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import https from 'https';
import http from 'http';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function gitCmd(args, dir) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 }).trim(); } catch { return ''; }
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const v = validateUrl(url);
    if (!v.valid) { resolve({ success: false }); return; }
    const start = Date.now();
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 10000, headers: { 'User-Agent': 'Ultraship-Growth/1.0' } }, (res) => {
      const acc = createResponseAccumulator();
      res.on('data', c => acc.onData(c));
      res.on('end', () => resolve({ success: true, status: res.statusCode < 400 ? 'up' : 'down', status_code: res.statusCode, response_time_ms: Date.now() - start }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ success: false, status: 'down' }); });
    req.on('error', () => resolve({ success: false, status: 'down' }));
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const urlFlag = args.find(a => a.startsWith('--url='));
  const url = urlFlag ? urlFlag.replace('--url=', '') : null;
  const shouldSave = args.includes('--save');
  const shouldShow = args.includes('--show');

  if (!dir) {
    output({ error: 'Usage: node growth-tracker.mjs <directory> [--url=<url>] [--save] [--show]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const ultraDir = join(dir, '.ultraship');
  const historyPath = join(ultraDir, 'growth-history.json');
  const auditHistoryPath = join(ultraDir, 'audit-history.json');

  // Uptime check
  let uptime = { status: 'unknown', response_time_ms: null, status_code: null };
  if (url) {
    const check = await checkUrl(url);
    if (check.success) {
      uptime = { status: check.status, response_time_ms: check.response_time_ms, status_code: check.status_code };
    } else {
      uptime = { status: 'down', response_time_ms: null, status_code: null };
    }
  }

  // Git activity
  const weeks = [7, 14, 21, 28];
  const commitsPerWeek = weeks.map((d, i) => {
    const since = `${d} days ago`;
    const until = i === 0 ? 'now' : `${weeks[i - 1]} days ago`;
    const log = gitCmd(['log', '--oneline', `--since=${since}`, `--until=${until}`], dir);
    return log ? log.split('\n').filter(Boolean).length : 0;
  }).reverse();

  const commitsThisWeek = commitsPerWeek[commitsPerWeek.length - 1] || 0;
  const commitsLastWeek = commitsPerWeek[commitsPerWeek.length - 2] || 0;

  const tags30d = gitCmd(['tag', '--sort=-creatordate', '--format=%(creatordate:iso)'], dir);
  const deployCount = tags30d ? tags30d.split('\n').filter(d => {
    try { return (Date.now() - new Date(d).getTime()) < 30 * 86400000; } catch { return false; }
  }).length : 0;

  const activeDays = gitCmd(['log', '--format=%aI', '--since=30 days ago'], dir);
  const uniqueDays = new Set(activeDays.split('\n').filter(Boolean).map(d => d.split('T')[0]));

  const diffStat = gitCmd(['diff', '--shortstat', '@{30 days ago}', 'HEAD'], dir);
  const addedMatch = diffStat.match(/(\d+) insertion/);
  const removedMatch = diffStat.match(/(\d+) deletion/);

  const gitActivity = {
    commits_this_week: commitsThisWeek,
    commits_last_week: commitsLastWeek,
    commits_4_weeks: commitsPerWeek,
    deploy_count_30d: deployCount,
    active_days_30d: uniqueDays.size,
    lines_added_30d: addedMatch ? parseInt(addedMatch[1]) : 0,
    lines_removed_30d: removedMatch ? parseInt(removedMatch[1]) : 0,
  };

  // SEO trajectory from audit history
  let seoTrajectory = { current: {}, previous: {}, trend: 'stable', seo_change: '0', geo_change: '0', aeo_change: '0' };
  const auditHistory = readJSON(auditHistoryPath);
  if (auditHistory) {
    const getLatest = (cat) => {
      const entries = auditHistory[cat];
      if (!entries || entries.length === 0) return null;
      return entries[entries.length - 1];
    };
    const getPrev = (cat) => {
      const entries = auditHistory[cat];
      if (!entries || entries.length < 2) return null;
      return entries[entries.length - 2];
    };
    const curSEO = getLatest('seo')?.score || 0;
    const curGEO = getLatest('geo')?.score || 0;
    const curAEO = getLatest('aeo')?.score || 0;
    const prevSEO = getPrev('seo')?.score || curSEO;
    const prevGEO = getPrev('geo')?.score || curGEO;
    const prevAEO = getPrev('aeo')?.score || curAEO;

    const totalChange = (curSEO - prevSEO) + (curGEO - prevGEO) + (curAEO - prevAEO);
    seoTrajectory = {
      current: { seo: curSEO, geo: curGEO, aeo: curAEO },
      previous: { seo: prevSEO, geo: prevGEO, aeo: prevAEO },
      trend: totalChange > 0 ? 'improving' : totalChange < 0 ? 'declining' : 'stable',
      seo_change: `${curSEO - prevSEO >= 0 ? '+' : ''}${curSEO - prevSEO}`,
      geo_change: `${curGEO - prevGEO >= 0 ? '+' : ''}${curGEO - prevGEO}`,
      aeo_change: `${curAEO - prevAEO >= 0 ? '+' : ''}${curAEO - prevAEO}`,
    };
  }

  // Dependency health
  let depHealth = { total_deps: 0, outdated: 0, vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } };
  const pkg = readJSON(join(dir, 'package.json'));
  if (pkg) {
    depHealth.total_deps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
    try {
      const auditOut = execFileSync('npm', ['audit', '--json'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
      const audit = JSON.parse(auditOut);
      if (audit.metadata?.vulnerabilities) {
        depHealth.vulnerabilities = {
          critical: audit.metadata.vulnerabilities.critical || 0,
          high: audit.metadata.vulnerabilities.high || 0,
          moderate: audit.metadata.vulnerabilities.moderate || 0,
          low: audit.metadata.vulnerabilities.low || 0,
        };
      }
    } catch {}
  }

  // Code health from audit history
  let codeHealth = { current_score: null, previous_score: null, trend: 'stable' };
  if (auditHistory?.['code-quality']) {
    const entries = auditHistory['code-quality'];
    if (entries.length > 0) {
      codeHealth.current_score = entries[entries.length - 1].score;
      if (entries.length > 1) {
        codeHealth.previous_score = entries[entries.length - 2].score;
        codeHealth.trend = codeHealth.current_score > codeHealth.previous_score ? 'improving' : codeHealth.current_score < codeHealth.previous_score ? 'declining' : 'stable';
      }
    }
  }

  // Build snapshot
  const snapshot = {
    timestamp: new Date().toISOString(),
    uptime,
    git_activity: gitActivity,
    seo_trajectory: seoTrajectory,
    dependency_health: depHealth,
    code_health: codeHealth,
  };

  // Growth summary
  const highlights = [];
  const actionItems = [];

  if (seoTrajectory.trend === 'improving') highlights.push(`SEO improving: ${seoTrajectory.seo_change} points`);
  if (commitsThisWeek > commitsLastWeek) highlights.push(`Velocity up: ${commitsThisWeek} commits this week vs ${commitsLastWeek} last week`);
  if (uptime.status === 'up' && uptime.response_time_ms < 500) highlights.push(`Fast response: ${uptime.response_time_ms}ms`);
  if (depHealth.vulnerabilities.critical === 0 && depHealth.vulnerabilities.high === 0) highlights.push('No critical/high vulnerabilities');

  if (depHealth.vulnerabilities.critical > 0) actionItems.push(`Fix ${depHealth.vulnerabilities.critical} critical vulnerabilities`);
  if (depHealth.vulnerabilities.high > 0) actionItems.push(`Fix ${depHealth.vulnerabilities.high} high severity vulnerabilities`);
  if (uptime.status === 'down') actionItems.push('Site is DOWN — run /rescue immediately');
  if (uptime.response_time_ms > 2000) actionItems.push(`Response time ${uptime.response_time_ms}ms is slow — investigate performance`);
  if (seoTrajectory.trend === 'declining') actionItems.push('SEO score declining — run /seo to investigate');

  const overallHealth = actionItems.some(a => a.includes('DOWN') || a.includes('critical')) ? 'declining' : highlights.length > actionItems.length ? 'growing' : 'stable';

  // History management
  let history = [];
  if (existsSync(historyPath)) {
    history = readJSON(historyPath) || [];
  }

  if (shouldSave) {
    if (!existsSync(ultraDir)) mkdirSync(ultraDir, { mode: 0o700, recursive: true });
    history.push({
      timestamp: snapshot.timestamp,
      seo: seoTrajectory.current.seo || null,
      uptime_ms: uptime.response_time_ms,
      commits: commitsThisWeek,
      vulnerabilities: depHealth.vulnerabilities.critical + depHealth.vulnerabilities.high,
    });
    if (history.length > 100) history = history.slice(-100);
    writeFileSync(historyPath, JSON.stringify(history, null, 2), { mode: 0o600 });
  }

  output({
    success: true,
    snapshot,
    growth_summary: { overall_health: overallHealth, highlights, action_items: actionItems },
    history: shouldShow ? history : history.slice(-5),
  });
}

main();
