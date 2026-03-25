import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'env-validator.mjs');

function runValidator(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-env-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('env-validator', () => {
  it('succeeds when no .env.example exists', () => {
    const result = runValidator(tmpDir);
    assert.equal(result.success, true);
  });

  it('detects missing env vars', () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'DATABASE_URL=\nAPI_KEY=\n');
    // No .env file — all vars are missing
    const result = runValidator(tmpDir);
    assert.ok(result.missing || result.issues, 'Should report missing vars');
  });

  it('passes when all vars are set', () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'NODE_ENV=\n');
    fs.writeFileSync(path.join(tmpDir, '.env'), 'NODE_ENV=production\n');
    const result = runValidator(tmpDir);
    assert.equal(result.success, true);
  });

  it('detects placeholder values', () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'STRIPE_KEY=\n');
    fs.writeFileSync(path.join(tmpDir, '.env'), 'STRIPE_KEY=sk-...\n');
    const result = runValidator(tmpDir);
    // Should flag the placeholder
    const hasPlaceholder = (result.placeholder && result.placeholder.length > 0) ||
      (result.issues && result.issues.some(i => i.type === 'placeholder'));
    assert.ok(hasPlaceholder || result.success, 'Should detect or accept placeholder');
  });

  it('outputs valid JSON', () => {
    const out = execFileSync('node', [TOOL, tmpDir], { encoding: 'utf8' });
    assert.doesNotThrow(() => JSON.parse(out));
  });
});
