import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(__dirname, '..', 'bin', 'ultraship.mjs');
const TIMEOUT = 120_000; // ship runs 6 tools across 5 categories in parallel, give it time

/** Strip ANSI escape codes so regex matching works on plain text. */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Helper: run `ultraship ship <dir>` and return stdout (ANSI-stripped).
 * Throws on non-zero exit (catch in tests that expect failure).
 * On throw, err.stdout is also ANSI-stripped for convenience.
 */
function ship(dir) {
  return stripAnsi(execFileSync('node', [BIN, 'ship', dir], {
    encoding: 'utf8',
    timeout: TIMEOUT,
  }));
}

// ── Temp directories used across tests ──

const EMPTY_DIR = path.join('/tmp', `ultraship-test-empty-${Date.now()}`);
const ENV_DIR = path.join('/tmp', `ultraship-test-env-${Date.now()}`);

before(() => {
  mkdirSync(EMPTY_DIR, { recursive: true });

  // Directory with a .env.example and a .env containing placeholders
  mkdirSync(ENV_DIR, { recursive: true });
  writeFileSync(path.join(ENV_DIR, '.env.example'), [
    'DATABASE_URL=',
    'API_KEY=',
    'SECRET_TOKEN=',
    'REDIS_URL=',
  ].join('\n'));
  writeFileSync(path.join(ENV_DIR, '.env'), [
    'DATABASE_URL=changeme',
    'API_KEY=your-api-key-here',
    'SECRET_TOKEN=replace_me',
    'REDIS_URL=TODO',
  ].join('\n'));
});

after(() => {
  // Clean up temp directories
  if (existsSync(EMPTY_DIR)) rmSync(EMPTY_DIR, { recursive: true, force: true });
  if (existsSync(ENV_DIR)) rmSync(ENV_DIR, { recursive: true, force: true });
});

describe('ultraship ship scorecard', () => {

  it('runs on /tmp without crashing and outputs the scorecard', () => {
    // ship on /tmp may exit 0 or 1 depending on score; capture either way
    let out;
    try {
      out = ship('/tmp');
    } catch (err) {
      // Non-zero exit is acceptable — we just need the output
      out = stripAnsi(err.stdout || '');
    }
    assert.match(out, /ULTRASHIP/, 'Output should contain ULTRASHIP banner');
    assert.match(out, /S C O R E/, 'Output should contain SCORE header');
  });

  it('exits with code 1 and shows error for nonexistent path', () => {
    try {
      ship('/nonexistent/path/that/does/not/exist');
      assert.fail('Should have thrown for nonexistent path');
    } catch (err) {
      assert.strictEqual(err.status, 1, 'Exit code should be 1');
      const output = stripAnsi((err.stderr || '') + (err.stdout || ''));
      assert.match(output, /Error/, 'Output should mention an error');
      assert.match(output, /not found|nonexistent/i, 'Output should reference the missing path');
    }
  });

  it('produces a scorecard on an empty directory with numeric scores or FAIL', () => {
    let out;
    try {
      out = ship(EMPTY_DIR);
    } catch (err) {
      out = stripAnsi(err.stdout || '');
    }

    assert.match(out, /ULTRASHIP/, 'Should show ULTRASHIP banner');
    assert.match(out, /SEO/, 'Should show SEO row');
    assert.match(out, /Security/, 'Should show Security row');
    assert.match(out, /Quality/, 'Should show Quality row');
    assert.match(out, /Performance/, 'Should show Performance row');
    assert.match(out, /OVERALL/, 'Should show OVERALL row');

    // Every score line inside the box should contain a number/100 or FAIL
    const lines = out.split('\n');
    const scoreLines = lines.filter(l => /║/.test(l) && /SEO|Security|Quality|Performance/.test(l));
    for (const line of scoreLines) {
      const hasNumber = /\d+\/100/.test(line);
      const hasFail = /FAIL/.test(line);
      const hasNA = /N\/A/.test(line);
      assert.ok(hasNumber || hasFail || hasNA, `Score line should have number, FAIL, or N/A: ${line.trim()}`);
    }
  });

  it('produces a scorecard for directory with .env placeholder values', () => {
    let envOut;
    try {
      envOut = ship(ENV_DIR);
    } catch (err) {
      envOut = stripAnsi(err.stdout || '');
    }

    assert.match(envOut, /ULTRASHIP/, 'Should show scorecard');
    assert.match(envOut, /S C O R E/, 'Should show SCORE header');

    // The scorecard should contain all four audit categories
    assert.match(envOut, /SEO/, 'Should show SEO row');
    assert.match(envOut, /Security/, 'Should show Security row');
    assert.match(envOut, /Quality/, 'Should show Quality row');
    assert.match(envOut, /Performance/, 'Should show Performance row');

    // Overall should be a number between 0 and 100
    const overallMatch = envOut.match(/OVERALL\s+(\d+)\/100/);
    assert.ok(overallMatch, 'Should have an OVERALL numeric score');
    const overall = parseInt(overallMatch[1], 10);
    assert.ok(overall >= 0 && overall <= 100, `Overall score (${overall}) should be 0-100`);
  });

  it('exits with code 0 when overall score >= 80', () => {
    // An empty directory typically scores high (no issues found)
    const out = ship(EMPTY_DIR);
    const overallMatch = out.match(/OVERALL\s+(\d+)\/100/);
    assert.ok(overallMatch, 'Should have an OVERALL score');
    // Scorecard always exits 0 — low scores are not errors
  });

  it('exits with code 0 even when overall score < 80', () => {
    // Create a directory rigged to fail: secrets in files + bad env
    const badDir = path.join('/tmp', `ultraship-test-bad-${Date.now()}`);
    mkdirSync(badDir, { recursive: true });

    // Plant leaked secrets to tank security score
    writeFileSync(path.join(badDir, 'config.js'), [
      'const AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE+wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";',
      'const STRIPE_SK = "sk_live_' + 'TESTONLY'.repeat(6) + '";',
      'const password = "supersecretpassword123";',
      'const GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";',
      'const PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----";',
    ].join('\n'));

    // Bad env to tank env score
    writeFileSync(path.join(badDir, '.env.example'), [
      'DB_URL=', 'API_KEY=', 'SECRET=', 'TOKEN=', 'REDIS=',
      'SMTP_PASS=', 'AWS_KEY=', 'STRIPE_KEY=', 'WEBHOOK_SECRET=', 'JWT_SECRET=',
    ].join('\n'));
    writeFileSync(path.join(badDir, '.env'), [
      'DB_URL=changeme', 'API_KEY=your-key-here', 'SECRET=TODO', 'TOKEN=replace_me', 'REDIS=changeme',
      'SMTP_PASS=changeme', 'AWS_KEY=TODO', 'STRIPE_KEY=your-key-here', 'WEBHOOK_SECRET=TODO', 'JWT_SECRET=changeme',
    ].join('\n'));

    // Scorecard always exits 0 — low scores are informational, not errors
    const out = ship(badDir);

    // Clean up
    rmSync(badDir, { recursive: true, force: true });

    assert.match(out, /ULTRASHIP/, 'Should show scorecard even with bad project');
    const overallMatch = out.match(/OVERALL\s+(\d+)\/100/);
    assert.ok(overallMatch, 'Should have an OVERALL score');
  });

  it('shows scanned/todo footer and tagline in the scorecard', () => {
    let out;
    try {
      out = ship(EMPTY_DIR);
    } catch (err) {
      out = stripAnsi(err.stdout || '');
    }

    // Footer: "✓ Scanned: N/5 audits completed" and "● Todo: N manual items remaining"
    assert.match(out, /Scanned:/, 'Should show Scanned line');
    assert.match(out, /\d+\/5 audits completed/, 'Should show audit count out of 5');
    assert.match(out, /Todo:/, 'Should show Todo line');
    assert.match(out, /manual items remaining/, 'Should show remaining items');
  });

  it('shows contextual tagline after the scorecard', () => {
    let out;
    try {
      out = ship(EMPTY_DIR);
    } catch (err) {
      out = stripAnsi(err.stdout || '');
    }

    // Tagline is contextual: "Ship it." when passing, "Fix..." when not
    const hasShipIt = /Ship it/.test(out);
    const hasFix = /Fix/.test(out) || /re-run/.test(out);
    assert.ok(hasShipIt || hasFix, 'Should show a contextual tagline (Ship it or Fix issues)');
  });

});
