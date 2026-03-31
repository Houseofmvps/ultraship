#!/usr/bin/env node
// tools/learnings-manager.mjs
// Project learnings manager — save, search, list, prune, export learnings
// Usage: node tools/learnings-manager.mjs <action> [options]
//   Actions: save, search, list, prune, export
//   save --title "Title" --body "Learning content" --tags "tag1,tag2"
//   search --query "keyword"
//   list [--limit N]
//   prune --older-than 90  (days)
//   export [--format json|markdown]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { randomBytes } from 'crypto';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function getLearningsDir() {
  // Store learnings in project's .ultraship/learnings/ directory
  const dir = resolve(process.cwd(), '.ultraship', 'learnings');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function generateId() {
  return randomBytes(4).toString('hex');
}

function loadLearning(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function loadAllLearnings(dir) {
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    const learnings = [];
    for (const file of files) {
      const learning = loadLearning(join(dir, file));
      if (learning) learnings.push(learning);
    }
    // Sort by date, newest first
    learnings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return learnings;
  } catch {
    return [];
  }
}

function saveLearning(title, body, tags) {
  const dir = getLearningsDir();
  const id = generateId();
  const now = new Date().toISOString();
  const learning = {
    id,
    title,
    body,
    tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    created_at: now,
    updated_at: now,
  };
  const filePath = join(dir, `${id}.json`);
  writeFileSync(filePath, JSON.stringify(learning, null, 2) + '\n', { mode: 0o600 });
  return learning;
}

function searchLearnings(query) {
  const dir = getLearningsDir();
  const all = loadAllLearnings(dir);
  const q = query.toLowerCase();
  return all.filter(l =>
    l.title.toLowerCase().includes(q) ||
    l.body.toLowerCase().includes(q) ||
    l.tags.some(t => t.toLowerCase().includes(q))
  );
}

function listLearnings(limit) {
  const dir = getLearningsDir();
  const all = loadAllLearnings(dir);
  return limit ? all.slice(0, limit) : all;
}

function pruneLearnings(olderThanDays) {
  const dir = getLearningsDir();
  const all = loadAllLearnings(dir);
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const pruned = [];
  for (const learning of all) {
    if (new Date(learning.created_at).getTime() < cutoff) {
      const filePath = join(dir, `${learning.id}.json`);
      try { unlinkSync(filePath); } catch { /* ignore */ }
      pruned.push(learning);
    }
  }
  return pruned;
}

function exportLearnings(format) {
  const dir = getLearningsDir();
  const all = loadAllLearnings(dir);

  if (format === 'markdown') {
    let md = '# Project Learnings\n\n';
    md += `_Exported ${new Date().toISOString()}_\n\n`;
    for (const l of all) {
      md += `## ${l.title}\n\n`;
      md += `${l.body}\n\n`;
      if (l.tags.length > 0) {
        md += `**Tags:** ${l.tags.join(', ')}\n`;
      }
      md += `**Date:** ${l.created_at}\n\n---\n\n`;
    }
    return { format: 'markdown', content: md, count: all.length };
  }

  return { format: 'json', learnings: all, count: all.length };
}

function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action) {
    output({
      error: 'Usage: node learnings-manager.mjs <action> [options]\nActions: save, search, list, prune, export',
      success: false,
    });
    process.exit(0);
  }

  // Parse flags
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  switch (action) {
    case 'save': {
      if (!flags.title || !flags.body) {
        output({ error: 'save requires --title and --body', success: false });
        process.exit(0);
      }
      const learning = saveLearning(flags.title, flags.body, flags.tags || '');
      output({ success: true, action: 'save', learning });
      break;
    }

    case 'search': {
      if (!flags.query) {
        output({ error: 'search requires --query', success: false });
        process.exit(0);
      }
      const results = searchLearnings(flags.query);
      output({ success: true, action: 'search', query: flags.query, results, count: results.length });
      break;
    }

    case 'list': {
      const limit = flags.limit ? parseInt(flags.limit, 10) : 0;
      const learnings = listLearnings(limit);
      output({ success: true, action: 'list', learnings, count: learnings.length });
      break;
    }

    case 'prune': {
      const days = parseInt(flags['older-than'] || '90', 10);
      const pruned = pruneLearnings(days);
      output({ success: true, action: 'prune', pruned_count: pruned.length, older_than_days: days });
      break;
    }

    case 'export': {
      const format = flags.format || 'json';
      const result = exportLearnings(format);
      output({ success: true, action: 'export', ...result });
      break;
    }

    default:
      output({ error: `Unknown action: ${action}. Valid: save, search, list, prune, export`, success: false });
  }
}

main();
