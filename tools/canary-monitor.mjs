#!/usr/bin/env node
// tools/canary-monitor.mjs
// Post-deploy canary monitoring — checks site health, console errors, perf regression
// Usage: node tools/canary-monitor.mjs <url> [--baseline <file>] [--checks N] [--interval S]

import https from 'https';
import http from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function checkUrl(url) {
  return new Promise((resolvePromise) => {
    const startTime = Date.now();
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;

    const req = mod.request(url, { method: 'GET', timeout: 15000 }, (res) => {
      const responseTime = Date.now() - startTime;
      const acc = createResponseAccumulator();
      res.on('data', (chunk) => { acc.onData(chunk); });
      res.on('end', () => {
        const body = acc.getBody();

        // Check for error indicators in HTML
        const errorPatterns = [];
        if (body.includes('Internal Server Error')) errorPatterns.push('Internal Server Error in response body');
        if (body.includes('502 Bad Gateway')) errorPatterns.push('502 Bad Gateway');
        if (body.includes('503 Service Unavailable')) errorPatterns.push('503 Service Unavailable');
        if (body.includes('Application error')) errorPatterns.push('Application error page detected');
        if (body.includes('NEXT_NOT_FOUND') || body.includes('MODULE_NOT_FOUND')) errorPatterns.push('Module not found error');
        if (body.includes('Uncaught') || body.includes('unhandled')) errorPatterns.push('Uncaught error in page');
        if (body.includes('TypeError') || body.includes('ReferenceError')) errorPatterns.push('JavaScript runtime error');

        // Check for common deployment issues
        const deployIssues = [];
        if (res.statusCode === 404) deployIssues.push('Page returns 404 — deployment may have failed');
        if (res.statusCode >= 500) deployIssues.push(`Server error: HTTP ${res.statusCode}`);
        if (responseTime > 5000) deployIssues.push(`Extremely slow response: ${responseTime}ms`);
        if (body.length < 100 && res.statusCode === 200) deployIssues.push('Suspiciously small response body — possible empty page');

        // Check security headers
        const missingHeaders = [];
        if (!res.headers['strict-transport-security']) missingHeaders.push('strict-transport-security');
        if (!res.headers['x-content-type-options']) missingHeaders.push('x-content-type-options');
        if (!res.headers['x-frame-options'] && !res.headers['content-security-policy']) {
          missingHeaders.push('x-frame-options or CSP frame-ancestors');
        }

        resolvePromise({
          url,
          status_code: res.statusCode,
          status_ok: res.statusCode >= 200 && res.statusCode < 400,
          response_time_ms: responseTime,
          content_length: body.length,
          error_patterns: errorPatterns,
          deploy_issues: deployIssues,
          missing_security_headers: missingHeaders,
          server: res.headers['server'] || null,
          cache_status: res.headers['x-vercel-cache'] || res.headers['x-cache'] || res.headers['cf-cache-status'] || null,
          timestamp: new Date().toISOString(),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolvePromise({
        url,
        status_code: 0,
        status_ok: false,
        response_time_ms: 15000,
        error_patterns: ['Request timed out after 15s'],
        deploy_issues: ['Site is unreachable — possible deployment failure'],
        timestamp: new Date().toISOString(),
      });
    });

    req.on('error', (err) => {
      resolvePromise({
        url,
        status_code: 0,
        status_ok: false,
        response_time_ms: 0,
        error_patterns: [err.message],
        deploy_issues: [`Connection failed: ${err.message}`],
        timestamp: new Date().toISOString(),
      });
    });

    req.end();
  });
}

function loadBaseline(baselinePath) {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf-8'));
  } catch {
    return null;
  }
}

function compareWithBaseline(current, baseline) {
  if (!baseline) return { has_baseline: false, regressions: [] };

  const regressions = [];

  // Response time regression (>50% slower)
  if (baseline.response_time_ms > 0 && current.response_time_ms > baseline.response_time_ms * 1.5) {
    regressions.push({
      type: 'response_time',
      severity: current.response_time_ms > baseline.response_time_ms * 3 ? 'critical' : 'warning',
      message: `Response time regressed: ${baseline.response_time_ms}ms → ${current.response_time_ms}ms (+${Math.round((current.response_time_ms / baseline.response_time_ms - 1) * 100)}%)`,
    });
  }

  // Status code change
  if (baseline.status_ok && !current.status_ok) {
    regressions.push({
      type: 'status_code',
      severity: 'critical',
      message: `Status code changed: ${baseline.status_code} → ${current.status_code}`,
    });
  }

  // New error patterns
  const baselineErrors = new Set(baseline.error_patterns || []);
  for (const err of current.error_patterns || []) {
    if (!baselineErrors.has(err)) {
      regressions.push({
        type: 'new_error',
        severity: 'high',
        message: `New error detected: ${err}`,
      });
    }
  }

  // Content size drop (>80% smaller could indicate broken page)
  if (baseline.content_length > 0 && current.content_length < baseline.content_length * 0.2) {
    regressions.push({
      type: 'content_size',
      severity: 'high',
      message: `Content size dropped significantly: ${baseline.content_length} → ${current.content_length} bytes (-${Math.round((1 - current.content_length / baseline.content_length) * 100)}%)`,
    });
  }

  return { has_baseline: true, regressions };
}

async function runCanaryChecks(url, checks, intervalMs, baselinePath) {
  // Ensure at least 1 check
  checks = Math.max(1, checks);

  const results = [];
  const baseline = baselinePath ? loadBaseline(baselinePath) : null;

  for (let i = 0; i < checks; i++) {
    const result = await checkUrl(url);
    const comparison = compareWithBaseline(result, baseline);
    results.push({ ...result, ...comparison });

    if (i < checks - 1 && intervalMs > 0) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  // Aggregate
  const allOk = results.every(r => r.status_ok);
  const allErrors = results.flatMap(r => r.error_patterns || []);
  const allIssues = results.flatMap(r => r.deploy_issues || []);
  const allRegressions = results.flatMap(r => r.regressions || []);
  const avgResponseTime = Math.round(results.reduce((s, r) => s + r.response_time_ms, 0) / results.length);

  // Determine overall health
  let health = 'healthy';
  if (!allOk) health = 'down';
  else if (allRegressions.some(r => r.severity === 'critical')) health = 'critical_regression';
  else if (allErrors.length > 0 || allIssues.length > 0) health = 'degraded';
  else if (allRegressions.length > 0) health = 'regression_detected';

  // Save as new baseline if healthy
  const baselineDir = resolve(process.cwd(), '.ultraship', 'canary');
  mkdirSync(baselineDir, { recursive: true, mode: 0o700 });
  if (health === 'healthy' && results.length > 0) {
    const baselineFile = resolve(baselineDir, 'baseline.json');
    writeFileSync(baselineFile, JSON.stringify(results[0], null, 2) + '\n', { mode: 0o600 });
  }

  return {
    success: true,
    url,
    health,
    checks_run: results.length,
    avg_response_time_ms: avgResponseTime,
    all_status_ok: allOk,
    error_patterns: [...new Set(allErrors)],
    deploy_issues: [...new Set(allIssues)],
    regressions: allRegressions,
    baseline_used: !!baseline,
    results,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('--'));

  if (!url) {
    output({ error: 'Usage: node canary-monitor.mjs <url> [--baseline <file>] [--checks N] [--interval S]', success: false });
    process.exit(0);
  }

  const urlCheck = validateUrl(url);
  if (!urlCheck.valid) {
    output({ error: urlCheck.reason, success: false });
    process.exit(0);
  }

  // Parse flags
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  const checks = parseInt(flags.checks || '3', 10);
  const interval = parseInt(flags.interval || '2', 10);
  const baselinePath = flags.baseline || resolve(process.cwd(), '.ultraship', 'canary', 'baseline.json');

  const result = await runCanaryChecks(url, checks, interval * 1000, baselinePath);
  output(result);
}

main();
