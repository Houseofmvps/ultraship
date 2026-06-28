import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'a11y-scanner.mjs');

function runScanner(dir) {
  const out = execFileSync('node', [TOOL, dir], { encoding: 'utf8' });
  return JSON.parse(out);
}

function write(dir, name, html) {
  fs.writeFileSync(path.join(dir, name), html);
}

function hasRule(result, rule) {
  return result.findings.some(f => f.rule === rule);
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-a11y-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const CLEAN_PAGE = `<!doctype html>
<html lang="en">
<head><title>Good Page</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body>
<main>
<h1>Title</h1>
<h2>Section</h2>
<img src="/a.png" alt="A descriptive photo">
<img src="/deco.png" alt="">
<a href="/about">About our company</a>
<a href="/home"><img src="/i.png" alt="Home"></a>
<button>Submit</button>
<button aria-label="Close"><svg aria-label="x"></svg></button>
<label for="email">Email</label><input type="text" id="email" name="email">
<input type="hidden" name="csrf">
</main>
</body>
</html>`;

describe('a11y-scanner', () => {
  it('outputs valid JSON with summary and scores for an empty directory', () => {
    const result = runScanner(tmpDir);
    assert.equal(result.files_scanned, 0);
    assert.ok(Array.isArray(result.findings));
    assert.equal(result.scores.a11y, null);
    assert.ok(result.summary);
  });

  it('reports zero findings and score 100 on a clean WCAG-compliant page', () => {
    write(tmpDir, 'index.html', CLEAN_PAGE);
    const result = runScanner(tmpDir);
    assert.equal(result.files_scanned, 1);
    assert.equal(result.findings.length, 0, `expected no findings, got: ${JSON.stringify(result.findings)}`);
    assert.equal(result.scores.a11y, 100);
  });

  it('flags an <img> with no alt attribute', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><img src="/x.png"></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'img-missing-alt'));
  });

  it('does NOT flag a decorative img with alt=""', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><img src="/x.png" alt=""></main></body></html>`);
    assert.ok(!hasRule(runScanner(tmpDir), 'img-missing-alt'));
  });

  it('flags <html> missing a lang attribute', () => {
    write(tmpDir, 'p.html', `<html><head><title>t</title></head><body><main><h1>h</h1></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'html-missing-lang'));
  });

  it('flags a form control with only a placeholder (no label)', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><input type="text" name="q" placeholder="Search"></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'control-missing-label'));
  });

  it('does NOT flag a control associated via <label for>', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><label for="q">Search</label><input type="text" id="q"></main></body></html>`);
    assert.ok(!hasRule(runScanner(tmpDir), 'control-missing-label'));
  });

  it('does NOT flag a control with aria-label', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><input type="text" aria-label="Search"></main></body></html>`);
    assert.ok(!hasRule(runScanner(tmpDir), 'control-missing-label'));
  });

  it('flags an empty <button>', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><button></button></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'button-no-text'));
  });

  it('does NOT flag an icon button whose svg has aria-label', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><button><svg aria-label="Close"></svg></button></main></body></html>`);
    assert.ok(!hasRule(runScanner(tmpDir), 'button-no-text'));
  });

  it('flags an empty link, but not a link wrapping an img with alt', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><a href="/a"></a><a href="/b"><img src="/i.png" alt="Home"></a></main></body></html>`);
    const r = runScanner(tmpDir);
    assert.equal(r.findings.filter(f => f.rule === 'link-no-text').length, 1);
  });

  it('flags generic link text', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><a href="/a">click here</a></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'link-generic-text'));
  });

  it('flags a positive tabindex', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><div tabindex="3">x</div></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'positive-tabindex'));
  });

  it('does NOT flag tabindex="0" or tabindex="-1"', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><div tabindex="0">a</div><div tabindex="-1">b</div></main></body></html>`);
    assert.ok(!hasRule(runScanner(tmpDir), 'positive-tabindex'));
  });

  it('flags a viewport that disables zoom', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><main><h1>h</h1></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'viewport-zoom-disabled'));
  });

  it('flags duplicate ids', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><div id="d"></div><div id="d"></div></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'duplicate-id'));
  });

  it('flags a broken aria-describedby reference', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><p aria-describedby="nope">x</p></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'broken-aria-reference'));
  });

  it('flags a skipped heading level', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head><title>t</title></head><body><main><h1>h</h1><h3>skip</h3></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'heading-skip'));
  });

  it('flags a missing <title>', () => {
    write(tmpDir, 'p.html', `<html lang="en"><head></head><body><main><h1>h</h1></main></body></html>`);
    assert.ok(hasRule(runScanner(tmpDir), 'missing-title'));
  });

  it('exits 0 and stays JSON-valid on a nonexistent directory', () => {
    const out = execFileSync('node', [TOOL, path.join(tmpDir, 'does-not-exist')], { encoding: 'utf8' });
    const result = JSON.parse(out);
    assert.equal(result.files_scanned, 0);
  });
});
