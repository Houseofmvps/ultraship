import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'bundle-tracker.mjs');

function runTracker(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-bundle-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('bundle-tracker', () => {
  it('succeeds when no build output exists', () => {
    const result = runTracker(tmpDir);
    assert.equal(result.success, true);
  });

  it('detects dist/ directory', () => {
    const distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("hello");\n');
    const result = runTracker(tmpDir);
    assert.equal(result.success, true);
    assert.ok(result.bundle, 'Should detect build output');
  });

  it('reports JS file sizes', () => {
    const distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, 'bundle.js'), 'x'.repeat(10000));
    const result = runTracker(tmpDir);
    assert.ok(result.bundle.js.files > 0, 'Should report JS files');
    assert.ok(result.bundle.total_bytes > 0, 'Should report total bytes');
  });

  it('outputs valid JSON', () => {
    const out = execFileSync('node', [TOOL, tmpDir], { encoding: 'utf8' });
    assert.doesNotThrow(() => JSON.parse(out));
  });
});
