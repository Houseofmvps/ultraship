// tests/canary-monitor.test.mjs
// Unit tests for canary-monitor.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(__dirname, '..', 'tools', 'canary-monitor.mjs');

function runTool(args = []) {
  try {
    const stdout = execFileSync('node', [TOOL, ...args], {
      encoding: 'utf-8',
      timeout: 30000,
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

describe('canary-monitor CLI', () => {
  it('shows usage when no args provided', () => {
    const result = runTool([]);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Usage'));
  });

  it('returns JSON with success field', () => {
    const result = runTool([]);
    assert.ok('success' in result);
  });

  it('handles unreachable target gracefully', () => {
    const result = runTool(['https://this-domain-definitely-does-not-exist-ultraship.test', '--checks', '1']);
    assert.equal(result.success, true);
    assert.equal(result.health, 'down');
    assert.equal(result.all_status_ok, false);
  });

  it('blocks SSRF on private IPs', () => {
    const result = runTool(['http://169.254.169.254/latest/meta-data']);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Blocked'));
  });

  it('includes required fields in output', () => {
    const result = runTool(['https://this-domain-does-not-exist-ultraship.test', '--checks', '1']);
    assert.ok('health' in result);
    assert.ok('checks_run' in result);
    assert.ok('avg_response_time_ms' in result);
    assert.ok('all_status_ok' in result);
  });
});
