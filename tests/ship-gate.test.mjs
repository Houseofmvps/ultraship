import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'ship-gate.mjs');

// Run the tool. execFileSync throws on a non-zero exit; tests that expect a failing
// gate catch the throw and read err.status / err.stdout.
function run(args) {
  return execFileSync('node', [TOOL, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}
function runExpectFail(args) {
  try {
    run(args);
    return { status: 0, stdout: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout || '' };
  }
}

let tmpDir;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-gate-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('ship-gate', () => {
  it('init writes .ultraship/ship-gate.json with default thresholds', () => {
    run(['init', tmpDir]);
    const p = path.join(tmpDir, '.ultraship', 'ship-gate.json');
    assert.ok(fs.existsSync(p));
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.equal(cfg.thresholds.overall, 80);
    assert.equal(cfg.hardFail.onLeakedSecrets, true);
  });

  it('init refuses to overwrite without --force', () => {
    run(['init', tmpDir]);
    const out = run(['init', tmpDir]);
    assert.match(out, /already exists/);
  });

  it('init --force overwrites an existing config', () => {
    run(['init', tmpDir]);
    const out = run(['init', tmpDir, '--force']);
    assert.match(out, /written/);
  });

  it('passes on an empty directory (exit 0)', () => {
    // empty dir → seo/a11y skipped, security/quality/bundle = 100 → pass. No throw = exit 0.
    const out = run(['run', tmpDir]);
    assert.match(out, /GATE PASSED/);
  });

  it('run --json emits valid JSON with passed=true on a clean directory', () => {
    const out = run(['run', tmpDir, '--json']);
    const r = JSON.parse(out);
    assert.equal(r.passed, true);
    assert.equal(typeof r.merge_confidence, 'number');
    assert.ok(Array.isArray(r.categories));
  });

  it('defaults to the run subcommand when given just a directory', () => {
    const out = run([tmpDir]);
    assert.match(out, /SHIP-GATE/);
  });

  it('fails (exit 1) on leaked secrets via hard-fail', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.js'),
      'const AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE+wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";');
    const { status, stdout } = runExpectFail(['run', tmpDir, '--json']);
    assert.equal(status, 1, 'gate must exit 1 so it blocks CI/push');
    const r = JSON.parse(stdout);
    assert.equal(r.passed, false);
    assert.ok(r.violations.some(v => v.rule === 'leaked-secrets'), 'should report a leaked-secrets violation');
  });

  it('respects a custom threshold (impossible overall always fails)', () => {
    fs.mkdirSync(path.join(tmpDir, '.ultraship'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ultraship', 'ship-gate.json'),
      JSON.stringify({ thresholds: { overall: 101 } }));
    const { status } = runExpectFail(['run', tmpDir]);
    assert.equal(status, 1);
  });

  it('reports config_source as the file when a config exists', () => {
    run(['init', tmpDir]);
    const r = JSON.parse(run(['run', tmpDir, '--json']));
    assert.match(r.config_source, /ship-gate\.json/);
  });

  it('ci writes a GitHub Actions workflow that runs the gate', () => {
    run(['ci', tmpDir]);
    const p = path.join(tmpDir, '.github', 'workflows', 'ship-gate.yml');
    assert.ok(fs.existsSync(p));
    assert.match(fs.readFileSync(p, 'utf8'), /ultraship ship-gate/);
  });

  it('hook reports gracefully when not a git repo', () => {
    const out = run(['hook', tmpDir]);
    assert.match(out, /not a git repository/i);
  });

  it('hook writes an executable pre-push when .git exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    run(['hook', tmpDir]);
    const p = path.join(tmpDir, '.git', 'hooks', 'pre-push');
    assert.ok(fs.existsSync(p));
    assert.ok((fs.statSync(p).mode & 0o100) !== 0, 'pre-push should be executable');
  });
});
