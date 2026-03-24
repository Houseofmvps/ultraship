#!/usr/bin/env node
// tools/api-smoke-test.mjs
// API endpoint smoke testing — status codes, response shapes, auth
// Usage: node tools/api-smoke-test.mjs <base-url> [--routes=<routes-file>]
// Safe: uses native https/http modules only, no shell execution

import https from 'https';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function request(method, url, options = {}) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;
    const parsed = new URL(url);

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ultraship-smoke-test/1.0',
        ...options.headers,
      },
    };

    if (options.body) {
      const bodyStr = JSON.stringify(options.body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const startTime = Date.now();
    const req = mod.request(reqOptions, (res) => {
      const responseTime = Date.now() - startTime;
      const acc = createResponseAccumulator();
      res.on('data', (chunk) => { acc.onData(chunk); });
      res.on('end', () => {
        const body = acc.getBody();
        let isJson = false;
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('json')) {
          try { JSON.parse(body); isJson = true; } catch { /* not json */ }
        }

        resolve({
          url,
          method,
          status: res.statusCode,
          response_time_ms: responseTime,
          content_type: contentType,
          is_json: isJson,
          body_length: acc.getTotalSize(),
          body_preview: body.slice(0, 500),
          headers: {
            cors: res.headers['access-control-allow-origin'] || null,
            rate_limit: res.headers['x-ratelimit-limit'] || res.headers['ratelimit-limit'] || null,
            rate_remaining: res.headers['x-ratelimit-remaining'] || res.headers['ratelimit-remaining'] || null,
          },
          error: null,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ url, method, status: null, error: 'timeout', response_time_ms: 10000 });
    });

    req.on('error', (err) => {
      resolve({ url, method, status: null, error: err.message, response_time_ms: null });
    });

    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// Common API routes to probe
const DEFAULT_ROUTES = [
  { method: 'GET', path: '/', description: 'Root endpoint' },
  { method: 'GET', path: '/health', description: 'Health check' },
  { method: 'GET', path: '/healthz', description: 'Health check (k8s)' },
  { method: 'GET', path: '/api', description: 'API root' },
  { method: 'GET', path: '/api/health', description: 'API health' },
  { method: 'GET', path: '/api/v1', description: 'API v1 root' },
  { method: 'GET', path: '/status', description: 'Status endpoint' },
  { method: 'GET', path: '/.well-known/security.txt', description: 'Security contact' },
  { method: 'GET', path: '/robots.txt', description: 'Robots.txt' },
  { method: 'GET', path: '/sitemap.xml', description: 'Sitemap' },
  { method: 'GET', path: '/favicon.ico', description: 'Favicon' },
  { method: 'GET', path: '/404-test-page', description: '404 handling' },
];

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = args.find(a => !a.startsWith('--'));
  const routesArg = args.find(a => a.startsWith('--routes='));

  if (!baseUrl) {
    output({ error: 'Usage: node api-smoke-test.mjs <base-url> [--routes=<routes-file>]', success: false });
    process.exit(0);
  }

  // Validate URL and block SSRF targets
  const urlCheck = validateUrl(baseUrl);
  if (!urlCheck.valid) {
    output({ error: urlCheck.reason, success: false });
    process.exit(0);
  }
  const parsedBase = urlCheck.url;

  let routes = DEFAULT_ROUTES;

  // Load custom routes if provided
  if (routesArg) {
    const routesFile = routesArg.split('=').slice(1).join('=');
    if (existsSync(routesFile)) {
      try {
        const custom = JSON.parse(readFileSync(routesFile, 'utf8'));
        if (Array.isArray(custom)) routes = custom;
      } catch (err) {
        output({ error: `Cannot parse routes file: ${err.message}`, success: false });
        process.exit(0);
      }
    }
  }

  const results = [];
  const issues = [];

  for (const route of routes) {
    const url = `${parsedBase.protocol}//${parsedBase.host}${route.path}`;
    const result = await request(route.method, url);
    result.description = route.description;
    results.push(result);

    // Analyze result
    if (result.error) {
      if (result.error === 'timeout') {
        issues.push({ path: route.path, severity: 'high', issue: 'timeout', message: `${route.description} timed out after 10s` });
      } else {
        issues.push({ path: route.path, severity: 'high', issue: 'connection_error', message: `${route.description}: ${result.error}` });
      }
    } else if (result.status >= 500) {
      issues.push({ path: route.path, severity: 'critical', issue: 'server_error', message: `${route.description} returned ${result.status}` });
    } else if (route.path === '/404-test-page' && result.status !== 404) {
      issues.push({ path: route.path, severity: 'medium', issue: 'no_404', message: `404 page returns ${result.status} instead of 404 — bad for SEO` });
    } else if (result.response_time_ms > 3000) {
      issues.push({ path: route.path, severity: 'medium', issue: 'slow_response', message: `${route.description} took ${result.response_time_ms}ms (target <1000ms)` });
    }

    // Check API responses are JSON
    if (route.path.startsWith('/api') && result.status >= 200 && result.status < 300 && !result.is_json) {
      issues.push({ path: route.path, severity: 'medium', issue: 'not_json', message: `API endpoint returns ${result.content_type} instead of JSON` });
    }

    // CORS check for API endpoints
    if (route.path.startsWith('/api') && result.status >= 200 && result.status < 300 && !result.headers.cors) {
      issues.push({ path: route.path, severity: 'low', issue: 'no_cors', message: 'No CORS headers — frontend on different domain will be blocked' });
    }
  }

  // Check for health endpoint
  const healthEndpoints = results.filter(r =>
    (r.url.includes('/health') || r.url.includes('/healthz') || r.url.includes('/status')) &&
    r.status >= 200 && r.status < 300
  );
  if (healthEndpoints.length === 0) {
    issues.push({ path: '/health', severity: 'medium', issue: 'no_health_endpoint', message: 'No health check endpoint found — needed for monitoring and container orchestration' });
  }

  const reachable = results.filter(r => r.status !== null);
  const errors = results.filter(r => r.status >= 500);
  const avgResponseTime = reachable.length > 0
    ? Math.round(reachable.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / reachable.length)
    : null;

  output({
    success: true,
    base_url: baseUrl,
    routes_tested: results.length,
    reachable: reachable.length,
    server_errors: errors.length,
    avg_response_time_ms: avgResponseTime,
    total_issues: issues.length,
    api_healthy: errors.length === 0 && issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    results,
  });
}

main();
