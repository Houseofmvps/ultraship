#!/usr/bin/env node
// tools/audit-history.mjs
// Saves and compares audit scores over time
// Usage:
//   node tools/audit-history.mjs save <project-dir> <category> <score> [--details=<json>]
//   node tools/audit-history.mjs show <project-dir> [category]
//   node tools/audit-history.mjs diff <project-dir> [category]
// Safe: reads/writes local files only, no shell execution

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function getHistoryPath(dir) {
  return join(dir, '.ultraship/reports/audit-history.json');
}

function loadHistory(dir) {
  const path = getHistoryPath(dir);
  if (!existsSync(path)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function saveHistory(dir, history) {
  const reportsDir = join(dir, '.ultraship/reports');
  mkdirSync(reportsDir, { recursive: true, mode: 0o700 });
  writeFileSync(getHistoryPath(dir), JSON.stringify(history, null, 2), { mode: 0o600 });
}

function formatDate(iso) {
  return iso.split('T')[0] + ' ' + iso.split('T')[1].slice(0, 5);
}

function cmdSave(dir, args) {
  const category = args[0];
  const score = parseInt(args[1], 10);

  if (!category || isNaN(score)) {
    output({ error: 'Usage: save <project-dir> <category> <score> [--details=<json>]', success: false });
    return;
  }

  const detailsArg = args.find(a => a.startsWith('--details='));
  let details = null;
  if (detailsArg) {
    try {
      details = JSON.parse(detailsArg.split('=').slice(1).join('='));
    } catch { /* ignore */ }
  }

  const history = loadHistory(dir);
  const entry = {
    timestamp: new Date().toISOString(),
    category,
    score: Math.max(0, Math.min(100, score)),
    details,
  };

  history.entries.push(entry);

  // Keep last 100 entries per category
  const byCategory = {};
  for (const e of history.entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  }
  for (const cat of Object.keys(byCategory)) {
    if (byCategory[cat].length > 100) {
      byCategory[cat] = byCategory[cat].slice(-100);
    }
  }
  history.entries = Object.values(byCategory).flat();

  saveHistory(dir, history);

  // Find previous score for comparison
  const catEntries = byCategory[category] || [];
  const prevEntry = catEntries.length >= 2 ? catEntries[catEntries.length - 2] : null;

  output({
    success: true,
    saved: entry,
    previous: prevEntry ? { score: prevEntry.score, date: formatDate(prevEntry.timestamp) } : null,
    diff: prevEntry ? score - prevEntry.score : null,
    trend: prevEntry ? (score > prevEntry.score ? 'improved' : score < prevEntry.score ? 'declined' : 'unchanged') : 'first_run',
  });
}

function cmdShow(dir, args) {
  const category = args[0] || null;
  const history = loadHistory(dir);

  if (history.entries.length === 0) {
    output({ success: true, message: 'No audit history yet. Run audits with --save to track scores over time.', entries: [] });
    return;
  }

  let entries = history.entries;
  if (category) {
    entries = entries.filter(e => e.category === category);
  }

  // Group by category
  const byCategory = {};
  for (const e of entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  }

  const summary = {};
  for (const [cat, catEntries] of Object.entries(byCategory)) {
    const latest = catEntries[catEntries.length - 1];
    const oldest = catEntries[0];
    const best = Math.max(...catEntries.map(e => e.score));
    const worst = Math.min(...catEntries.map(e => e.score));

    summary[cat] = {
      latest_score: latest.score,
      latest_date: formatDate(latest.timestamp),
      first_score: oldest.score,
      first_date: formatDate(oldest.timestamp),
      best_score: best,
      worst_score: worst,
      total_runs: catEntries.length,
      overall_change: latest.score - oldest.score,
      trend: latest.score > oldest.score ? 'improving' : latest.score < oldest.score ? 'declining' : 'stable',
      history: catEntries.slice(-10).map(e => ({
        score: e.score,
        date: formatDate(e.timestamp),
      })),
    };
  }

  output({
    success: true,
    categories: Object.keys(summary),
    summary,
  });
}

function cmdDiff(dir, args) {
  const category = args[0] || null;
  const history = loadHistory(dir);

  if (history.entries.length === 0) {
    output({ success: true, message: 'No audit history to compare', diffs: [] });
    return;
  }

  const byCategory = {};
  for (const e of history.entries) {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e);
  }

  const diffs = [];
  for (const [cat, catEntries] of Object.entries(byCategory)) {
    if (category && cat !== category) continue;
    if (catEntries.length < 2) continue;

    const latest = catEntries[catEntries.length - 1];
    const previous = catEntries[catEntries.length - 2];
    const diff = latest.score - previous.score;

    diffs.push({
      category: cat,
      current: latest.score,
      previous: previous.score,
      diff,
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'unchanged',
      current_date: formatDate(latest.timestamp),
      previous_date: formatDate(previous.timestamp),
    });
  }

  output({
    success: true,
    diffs,
    overall_trend: diffs.length > 0
      ? (diffs.reduce((sum, d) => sum + d.diff, 0) > 0 ? 'improving' : 'declining')
      : 'no_data',
  });
}

function main() {
  const command = process.argv[2];
  const dir = process.argv[3];

  if (!command || !dir) {
    output({
      error: 'Usage:\n  save <project-dir> <category> <score>\n  show <project-dir> [category]\n  diff <project-dir> [category]',
      success: false,
    });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const args = process.argv.slice(4);

  switch (command) {
    case 'save': cmdSave(dir, args); break;
    case 'show': cmdShow(dir, args); break;
    case 'diff': cmdDiff(dir, args); break;
    default:
      output({ error: `Unknown command: ${command}. Available: save, show, diff`, success: false });
  }
}

main();
