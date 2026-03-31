#!/usr/bin/env node
// tools/retro-analyzer.mjs
// Sprint retrospective analyzer — git velocity, test health, shipping patterns
// Usage: node tools/retro-analyzer.mjs [project-dir] [--days N] [--since YYYY-MM-DD]

import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', cwd, timeout: 30000 }).trim();
  } catch {
    return '';
  }
}

function analyzeGitVelocity(dir, since) {
  // Commit count
  const commitLog = runGit(['log', `--since=${since}`, '--oneline'], dir);
  const commits = commitLog ? commitLog.split('\n').filter(Boolean) : [];

  // Lines added/removed
  const diffStat = runGit(['log', `--since=${since}`, '--numstat', '--format='], dir);
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of diffStat.split('\n').filter(Boolean)) {
    const [added, removed] = line.split('\t');
    if (added !== '-') linesAdded += parseInt(added, 10) || 0;
    if (removed !== '-') linesRemoved += parseInt(removed, 10) || 0;
  }

  // Unique authors
  const authorLog = runGit(['log', `--since=${since}`, '--format=%ae'], dir);
  const authors = [...new Set(authorLog.split('\n').filter(Boolean))];

  // Commit frequency by day of week
  const dayLog = runGit(['log', `--since=${since}`, '--format=%ad', '--date=format:%A'], dir);
  const dayFreq = {};
  for (const day of dayLog.split('\n').filter(Boolean)) {
    dayFreq[day] = (dayFreq[day] || 0) + 1;
  }

  // Commit frequency by hour
  const hourLog = runGit(['log', `--since=${since}`, '--format=%ad', '--date=format:%H'], dir);
  const hourFreq = {};
  for (const hour of hourLog.split('\n').filter(Boolean)) {
    hourFreq[hour] = (hourFreq[hour] || 0) + 1;
  }

  // Most active files
  const fileLog = runGit(['log', `--since=${since}`, '--name-only', '--format='], dir);
  const fileFreq = {};
  for (const f of fileLog.split('\n').filter(Boolean)) {
    fileFreq[f] = (fileFreq[f] || 0) + 1;
  }
  const hotFiles = Object.entries(fileFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([file, count]) => ({ file, changes: count }));

  // Recent tags/releases
  const tags = runGit(['tag', '--sort=-creatordate', '--format=%(refname:short) %(creatordate:short)'], dir);
  const recentTags = tags.split('\n').filter(Boolean).slice(0, 5);

  return {
    commits: commits.length,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    net_lines: linesAdded - linesRemoved,
    authors,
    author_count: authors.length,
    day_frequency: dayFreq,
    hour_frequency: hourFreq,
    hot_files: hotFiles,
    recent_tags: recentTags,
  };
}

function analyzeCommitPatterns(dir, since) {
  const log = runGit(['log', `--since=${since}`, '--format=%s'], dir);
  const messages = log.split('\n').filter(Boolean);

  const patterns = {
    features: 0,
    fixes: 0,
    refactors: 0,
    docs: 0,
    tests: 0,
    chores: 0,
    other: 0,
  };

  for (const msg of messages) {
    const lower = msg.toLowerCase();
    if (lower.startsWith('feat') || lower.includes('add ') || lower.includes('new ')) patterns.features++;
    else if (lower.startsWith('fix') || lower.includes('bug') || lower.includes('patch')) patterns.fixes++;
    else if (lower.includes('refactor') || lower.includes('cleanup') || lower.includes('rename')) patterns.refactors++;
    else if (lower.startsWith('doc') || lower.includes('readme') || lower.includes('comment')) patterns.docs++;
    else if (lower.startsWith('test') || lower.includes('spec') || lower.includes('coverage')) patterns.tests++;
    else if (lower.startsWith('chore') || lower.includes('deps') || lower.includes('bump')) patterns.chores++;
    else patterns.other++;
  }

  // Feature-to-fix ratio
  const featureFixRatio = patterns.fixes > 0
    ? Math.round((patterns.features / patterns.fixes) * 100) / 100
    : patterns.features > 0 ? Infinity : 0;

  return { commit_types: patterns, feature_fix_ratio: featureFixRatio, total_commits: messages.length };
}

function analyzeTestHealth(dir) {
  // Look for test files
  const testPatterns = ['tests', 'test', '__tests__', 'spec'];
  let testFiles = 0;
  let testDir = null;

  for (const pattern of testPatterns) {
    const testPath = join(dir, pattern);
    try {
      const stat = statSync(testPath);
      if (stat.isDirectory()) {
        testDir = testPath;
        const files = readdirSync(testPath);
        testFiles = files.filter(f =>
          f.endsWith('.test.js') || f.endsWith('.test.mjs') || f.endsWith('.test.ts') ||
          f.endsWith('.spec.js') || f.endsWith('.spec.mjs') || f.endsWith('.spec.ts')
        ).length;
        break;
      }
    } catch { /* ignore */ }
  }

  // Check package.json for test script
  let hasTestScript = false;
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    hasTestScript = !!(pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes('no test specified'));
  } catch { /* ignore */ }

  // Try running tests if available
  let testResult = null;
  if (hasTestScript) {
    try {
      const stdout = execFileSync('npm', ['test', '--', '--reporter=tap'], {
        encoding: 'utf-8',
        cwd: dir,
        timeout: 60000,
        env: { ...process.env, NODE_OPTIONS: '' },
      });
      const passing = (stdout.match(/# pass\s+(\d+)/i) || [, '0'])[1];
      const failing = (stdout.match(/# fail\s+(\d+)/i) || [, '0'])[1];
      testResult = { passing: parseInt(passing), failing: parseInt(failing), ran: true };
    } catch (err) {
      const stdout = err.stdout || '';
      const passing = (stdout.match(/# pass\s+(\d+)/i) || [, '0'])[1];
      const failing = (stdout.match(/# fail\s+(\d+)/i) || [, '0'])[1];
      testResult = { passing: parseInt(passing), failing: parseInt(failing), ran: true, error: true };
    }
  }

  return {
    test_files: testFiles,
    test_directory: testDir ? testDir.replace(dir, '.') : null,
    has_test_script: hasTestScript,
    test_result: testResult,
  };
}

function generateInsights(velocity, patterns, testHealth) {
  const insights = [];
  const recommendations = [];

  // Velocity insights
  if (velocity.commits === 0) {
    insights.push('No commits in this period — project may be paused or between sprints');
  } else if (velocity.commits > 50) {
    insights.push(`High velocity: ${velocity.commits} commits — shipping fast`);
  }

  if (velocity.lines_removed > velocity.lines_added * 0.5) {
    insights.push('Good code hygiene — significant deletion alongside additions');
  }

  if (velocity.hot_files.length > 0 && velocity.hot_files[0].changes > velocity.commits * 0.3) {
    insights.push(`"${velocity.hot_files[0].file}" is a hotspot (${velocity.hot_files[0].changes} changes) — consider splitting`);
    recommendations.push(`Break up ${velocity.hot_files[0].file} into smaller modules`);
  }

  // Pattern insights
  if (patterns.feature_fix_ratio < 0.5 && patterns.commit_types.fixes > 5) {
    insights.push('Fix-heavy sprint — spending more time fixing than building');
    recommendations.push('Invest in test coverage to prevent regressions');
  }

  if (patterns.commit_types.tests === 0 && patterns.total_commits > 10) {
    insights.push('No test commits this period');
    recommendations.push('Add test commits — use /tdd for test-driven development');
  }

  // Test health insights
  if (!testHealth.has_test_script) {
    recommendations.push('Set up a test framework and npm test script');
  }

  if (testHealth.test_result && testHealth.test_result.failing > 0) {
    insights.push(`${testHealth.test_result.failing} tests failing`);
    recommendations.push('Fix failing tests before shipping new features');
  }

  // Day/hour patterns
  const peakDay = Object.entries(velocity.day_frequency).sort((a, b) => b[1] - a[1])[0];
  if (peakDay) {
    insights.push(`Most productive day: ${peakDay[0]} (${peakDay[1]} commits)`);
  }

  return { insights, recommendations };
}

function main() {
  const args = process.argv.slice(2);
  const dir = resolve(args.find(a => !a.startsWith('--')) || process.cwd());

  // Parse flags
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  const days = parseInt(flags.days || '7', 10);
  const since = flags.since || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Verify it's a git repo
  const isGit = runGit(['rev-parse', '--is-inside-work-tree'], dir);
  if (isGit !== 'true') {
    output({ error: `${dir} is not a git repository`, success: false });
    process.exit(0);
  }

  const velocity = analyzeGitVelocity(dir, since);
  const patterns = analyzeCommitPatterns(dir, since);
  const testHealth = analyzeTestHealth(dir);
  const { insights, recommendations } = generateInsights(velocity, patterns, testHealth);

  output({
    success: true,
    project: dir,
    period: { since, days },
    velocity,
    commit_patterns: patterns,
    test_health: testHealth,
    insights,
    recommendations,
  });
}

main();
