// tests/retro-analyzer.test.mjs
// Unit tests for retro-analyzer.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(__dirname, '..', 'tools', 'retro-analyzer.mjs');

function runTool(args = []) {
  try {
    const stdout = execFileSync('node', [TOOL, ...args], {
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    return JSON.parse(stdout);
  } catch (err) {
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch {}
    }
    throw err;
  }
}

describe('retro-analyzer CLI', () => {
  it('runs on current directory (ultraship repo)', () => {
    const result = runTool([resolve(__dirname, '..'), '--days', '7']);
    assert.equal(result.success, true);
    assert.ok(result.velocity);
    assert.ok(typeof result.velocity.commits === 'number');
    assert.ok(result.commit_patterns);
    assert.ok(result.test_health);
    assert.ok(result.insights);
    assert.ok(result.recommendations);
  });

  it('returns velocity metrics', () => {
    const result = runTool([resolve(__dirname, '..'), '--days', '7']);
    assert.ok('lines_added' in result.velocity);
    assert.ok('lines_removed' in result.velocity);
    assert.ok('net_lines' in result.velocity);
    assert.ok('authors' in result.velocity);
    assert.ok('hot_files' in result.velocity);
  });

  it('returns commit patterns', () => {
    const result = runTool([resolve(__dirname, '..'), '--days', '7']);
    assert.ok('commit_types' in result.commit_patterns);
    assert.ok('feature_fix_ratio' in result.commit_patterns);
    assert.ok(typeof result.commit_patterns.commit_types.features === 'number');
    assert.ok(typeof result.commit_patterns.commit_types.fixes === 'number');
  });

  it('returns test health info', () => {
    const result = runTool([resolve(__dirname, '..'), '--days', '7']);
    assert.ok('test_files' in result.test_health);
    assert.ok('has_test_script' in result.test_health);
    assert.equal(result.test_health.has_test_script, true);
    assert.ok(result.test_health.test_files > 0);
  });

  it('handles non-git directory', () => {
    const result = runTool(['/tmp']);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not a git repository'));
  });

  it('respects --since flag', () => {
    const result = runTool([resolve(__dirname, '..'), '--since', '2026-01-01']);
    assert.equal(result.success, true);
    assert.equal(result.period.since, '2026-01-01');
  });

  it('includes day and hour frequency', () => {
    const result = runTool([resolve(__dirname, '..'), '--days', '30']);
    assert.ok(result.velocity.day_frequency);
    assert.ok(result.velocity.hour_frequency);
  });
});
