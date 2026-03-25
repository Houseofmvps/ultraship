import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'ultraship.mjs');

function run(...args) {
  return execFileSync('node', [CLI, ...args], { encoding: 'utf8', timeout: 30000 });
}

describe('ultraship CLI', () => {
  it('shows help with no args', () => {
    const out = run('help');
    assert.match(out, /ultraship/);
    assert.match(out, /Commands:/);
    assert.match(out, /ship/);
    assert.match(out, /init/);
  });

  it('shows version', () => {
    const out = run('version');
    assert.match(out, /ultraship v\d+\.\d+\.\d+/);
  });

  it('shows help with --help flag', () => {
    const out = run('--help');
    assert.match(out, /Commands:/);
  });

  it('shows version with -v flag', () => {
    const out = run('-v');
    assert.match(out, /ultraship v/);
  });

  it('exits with error for unknown command', () => {
    assert.throws(() => run('nonexistent'), { status: 1 });
  });

  it('runs seo on /tmp', () => {
    const out = run('seo', '/tmp');
    const data = JSON.parse(out);
    assert.ok('files_scanned' in data);
    assert.ok('findings' in data);
  });

  it('runs security on /tmp', () => {
    const out = run('security', '/tmp');
    const data = JSON.parse(out);
    assert.ok('files_scanned' in data);
  });

  it('runs env on /tmp', () => {
    const out = run('env', '/tmp');
    const data = JSON.parse(out);
    assert.equal(data.success, true);
  });
});
