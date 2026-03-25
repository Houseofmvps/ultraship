import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TOOL = path.join(import.meta.dirname, '..', 'tools', 'secret-scanner.mjs');

function runScanner(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('secret-scanner', () => {
  it('outputs valid JSON with zero findings on clean dir', () => {
    fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const x = 1;\n');
    const result = runScanner(tmpDir);
    assert.equal(typeof result.files_scanned, 'number');
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.findings.length, 0);
  });

  it('detects AWS access key', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.js'), 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
    const result = runScanner(tmpDir);
    assert.ok(result.findings.length > 0);
    assert.equal(result.findings[0].pattern, 'aws-access-key');
    assert.equal(result.findings[0].severity, 'critical');
  });

  it('detects Stripe live secret key', () => {
    fs.writeFileSync(path.join(tmpDir, 'pay.js'), `const sk = "sk_live_${'a'.repeat(24)}";\n`);
    const result = runScanner(tmpDir);
    const stripe = result.findings.find(f => f.pattern === 'stripe-secret-key');
    assert.ok(stripe, 'Should detect Stripe secret key');
    assert.equal(stripe.severity, 'critical');
  });

  it('detects GitHub token', () => {
    fs.writeFileSync(path.join(tmpDir, 'gh.js'), 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl";\n');
    const result = runScanner(tmpDir);
    const gh = result.findings.find(f => f.pattern === 'github-token');
    assert.ok(gh, 'Should detect GitHub token');
  });

  it('detects private key header', () => {
    fs.writeFileSync(path.join(tmpDir, 'key.pem'), '-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----\n');
    const result = runScanner(tmpDir);
    const pk = result.findings.find(f => f.pattern === 'private-key');
    assert.ok(pk, 'Should detect private key');
  });

  it('detects database URL with password', () => {
    fs.writeFileSync(path.join(tmpDir, 'db.js'), 'const url = "postgres://user:s3cret@db.host.com:5432/mydb";\n');
    const result = runScanner(tmpDir);
    const db = result.findings.find(f => f.pattern === 'database-url-with-password');
    assert.ok(db, 'Should detect database URL with password');
  });

  it('redacts matched values in output', () => {
    fs.writeFileSync(path.join(tmpDir, 'leak.js'), 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
    const result = runScanner(tmpDir);
    assert.ok(result.findings[0].match.includes('redacted'), 'Match should be redacted');
    assert.ok(!result.findings[0].match.includes('AKIAIOSFODNN7EXAMPLE'), 'Full key should not appear');
  });

  it('skips binary files', () => {
    fs.writeFileSync(path.join(tmpDir, 'image.png'), 'AKIAIOSFODNN7EXAMPLE');
    const result = runScanner(tmpDir);
    assert.equal(result.findings.length, 0);
  });

  it('skips .env.example files', () => {
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\n');
    const result = runScanner(tmpDir);
    // Should not flag the .env.example as a committed env file
    const envFinding = result.findings.find(f => f.pattern === 'committed-env-file');
    assert.ok(!envFinding, '.env.example should not be flagged as committed env');
  });

  it('flags committed .env files', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=value\n');
    const result = runScanner(tmpDir);
    const envFinding = result.findings.find(f => f.pattern === 'committed-env-file');
    assert.ok(envFinding, 'Should flag committed .env file');
  });
});
