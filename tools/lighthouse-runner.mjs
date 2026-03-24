#!/usr/bin/env node
// Uses execFileSync (not exec) to avoid shell injection with user-provided URLs
import { execFileSync } from 'child_process';
import { readFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function findChrome() {
  // Check known paths first
  for (const p of CHROME_PATHS) {
    try {
      execFileSync('test', ['-f', p]);
      return p;
    } catch {
      // not found at this path
    }
  }

  // Try `which` as fallback using execFileSync (safe — args are hardcoded strings)
  const candidates = ['google-chrome', 'chromium-browser', 'chromium', 'chrome'];
  for (const name of candidates) {
    try {
      const result = execFileSync('which', [name], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const found = result.trim();
      if (found) return found;
    } catch {
      // not in PATH
    }
  }

  return null;
}

function errorResult(url, message) {
  return { url, error: message, scores: null };
}

function main() {
  const url = process.argv[2];

  if (!url) {
    process.stdout.write(JSON.stringify(errorResult('', 'Usage: node tools/lighthouse-runner.mjs <url>'), null, 2) + '\n');
    process.exit(0);
  }

  const chromePath = findChrome();

  if (!chromePath) {
    process.stdout.write(JSON.stringify(errorResult(url, 'Chrome not found'), null, 2) + '\n');
    process.exit(0);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'lighthouse-'));
  const outputFile = join(tmpDir, 'report.json');

  try {
    execFileSync(
      'npx',
      [
        '-y',
        'lighthouse',
        url,
        '--output=json',
        `--output-path=${outputFile}`,
        '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
        '--quiet',
        '--only-categories=performance,accessibility,best-practices,seo',
      ],
      {
        env: { ...process.env, CHROME_PATH: chromePath },
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let report;
    try {
      report = JSON.parse(readFileSync(outputFile, 'utf8'));
    } catch {
      process.stdout.write(JSON.stringify(errorResult(url, 'Failed to parse Lighthouse output'), null, 2) + '\n');
      process.exit(0);
    }

    // Extract scores (0-1 float → 0-100 int)
    const cats = report.categories || {};
    const scores = {
      performance: cats.performance ? Math.round(cats.performance.score * 100) : null,
      accessibility: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
      best_practices: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : null,
      seo: cats.seo ? Math.round(cats.seo.score * 100) : null,
    };

    // Extract opportunities: audits where score < 1 and details.type === 'opportunity'
    const audits = report.audits || {};
    const opportunities = Object.values(audits)
      .filter(audit => {
        return (
          audit.score !== null &&
          audit.score < 1 &&
          audit.details &&
          audit.details.type === 'opportunity'
        );
      })
      .map(audit => ({
        id: audit.id,
        severity: audit.score <= 0.49 ? 'high' : 'medium',
        savings_ms: Math.round(audit.details.overallSavingsMs || 0),
        message: audit.title,
      }))
      .sort((a, b) => b.savings_ms - a.savings_ms)
      .slice(0, 10);

    const result = {
      url,
      scores,
      opportunities,
      error: null,
    };

    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    const message = err.message || 'Lighthouse run failed';
    process.stdout.write(JSON.stringify(errorResult(url, message), null, 2) + '\n');
    process.exit(0);
  } finally {
    // Clean up temp file
    try { unlinkSync(outputFile); } catch { /* ignore */ }
    try { unlinkSync(tmpDir); } catch { /* ignore */ }
  }
}

main();
