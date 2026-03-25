import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'seo-scanner.mjs');

function runScanner(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-seo-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('seo-scanner', () => {
  it('outputs valid JSON for empty directory', () => {
    const result = runScanner(tmpDir);
    assert.equal(result.files_scanned, 0);
    assert.ok(Array.isArray(result.findings));
  });

  it('scans HTML files and reports findings', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.html'), `<!DOCTYPE html>
<html>
<head></head>
<body><p>Hello</p></body>
</html>`);
    const result = runScanner(tmpDir);
    assert.equal(result.files_scanned, 1);
    assert.ok(result.findings.length > 0, 'Should find SEO issues in minimal HTML');
  });

  it('flags missing title tag', () => {
    fs.writeFileSync(path.join(tmpDir, 'page.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body><h1>Hi</h1></body></html>`);
    const result = runScanner(tmpDir);
    const titleFinding = result.findings.find(f =>
      f.rule && f.rule.toLowerCase().includes('title')
    );
    assert.ok(titleFinding, 'Should flag missing title');
  });

  it('flags missing meta description', () => {
    fs.writeFileSync(path.join(tmpDir, 'page.html'), `<!DOCTYPE html>
<html><head><title>Test</title></head><body><h1>Hi</h1></body></html>`);
    const result = runScanner(tmpDir);
    const descFinding = result.findings.find(f =>
      f.rule && f.rule.toLowerCase().includes('description')
    );
    assert.ok(descFinding, 'Should flag missing meta description');
  });

  it('flags missing h1', () => {
    fs.writeFileSync(path.join(tmpDir, 'page.html'), `<!DOCTYPE html>
<html><head><title>Test</title><meta name="description" content="test"></head><body><p>No heading</p></body></html>`);
    const result = runScanner(tmpDir);
    const h1Finding = result.findings.find(f =>
      f.rule && f.rule.toLowerCase().includes('h1')
    );
    assert.ok(h1Finding, 'Should flag missing h1');
  });

  it('flags images without alt text', () => {
    fs.writeFileSync(path.join(tmpDir, 'page.html'), `<!DOCTYPE html>
<html><head><title>Test</title></head><body><h1>Hi</h1><img src="photo.jpg"></body></html>`);
    const result = runScanner(tmpDir);
    const altFinding = result.findings.find(f =>
      f.rule && f.rule.toLowerCase().includes('alt')
    );
    assert.ok(altFinding, 'Should flag image without alt');
  });

  it('categorizes findings by severity', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.html'), `<!DOCTYPE html>
<html><head></head><body><p>Bare page</p></body></html>`);
    const result = runScanner(tmpDir);
    const severities = new Set(result.findings.map(f => f.severity));
    assert.ok(severities.size > 0, 'Should have findings with severity levels');
    for (const s of severities) {
      assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(s), `Unknown severity: ${s}`);
    }
  });

  it('skips node_modules directory', () => {
    const nmDir = path.join(tmpDir, 'node_modules', 'pkg');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'index.html'), '<html><body>Bad SEO</body></html>');
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html><head><title>Main</title></head><body><h1>Hi</h1></body></html>');
    const result = runScanner(tmpDir);
    assert.equal(result.files_scanned, 1, 'Should only scan 1 file, skipping node_modules');
  });
});
