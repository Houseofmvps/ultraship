#!/usr/bin/env node
// tools/health-check.mjs
// Production health check — status code, response time, SSL, headers
// Usage: node tools/health-check.mjs <url> [--full]

import https from 'https';
import http from 'http';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function checkUrl(url, followRedirects = 3) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;

    const req = mod.request(url, { method: 'GET', timeout: 10000 }, (res) => {
      const responseTime = Date.now() - startTime;

      // Capture SSL cert immediately before body consumption destroys the socket
      let ssl = null;
      if (isHttps && res.socket) {
        try {
          const getPeerCert = res.socket.getPeerCertificate || res.connection?.getPeerCertificate;
          if (getPeerCert) {
            const cert = getPeerCert.call(res.socket);
            if (cert && Object.keys(cert).length > 0) {
              const expiresAt = cert.valid_to ? new Date(cert.valid_to) : null;
              const daysUntilExpiry = expiresAt ? Math.floor((expiresAt - Date.now()) / 86400000) : null;
              ssl = {
                valid: daysUntilExpiry !== null ? daysUntilExpiry > 0 : null,
                expires: cert.valid_to || null,
                days_until_expiry: daysUntilExpiry,
                issuer: cert.issuer ? (cert.issuer.O || cert.issuer.CN || null) : null,
                subject: cert.subject ? (cert.subject.CN || null) : null,
                warning: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? `SSL expires in ${daysUntilExpiry} days` : null,
              };
            }
          }
        } catch { /* ignore */ }
      }

      const acc = createResponseAccumulator();
      res.on('data', (chunk) => { acc.onData(chunk); });
      res.on('end', () => {
        const body = acc.getBody();
        // Follow redirects — re-validate each hop to prevent SSRF via redirect
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && followRedirects > 0) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const u = new URL(url);
            redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
          }
          const redirectCheck = validateUrl(redirectUrl);
          if (!redirectCheck.valid) {
            resolve({
              success: false,
              url: redirectUrl,
              error: `Redirect blocked: ${redirectCheck.reason}`,
              status_ok: false,
              redirects: [{ from: url, to: redirectUrl, status: res.statusCode, blocked: true }],
            });
            return;
          }
          resolve(checkUrl(redirectUrl, followRedirects - 1).then(result => ({
            ...result,
            redirects: [{ from: url, to: redirectUrl, status: res.statusCode }, ...(result.redirects || [])],
          })));
          return;
        }

        // Security headers
        const securityHeaders = {
          'content-security-policy': res.headers['content-security-policy'] || null,
          'strict-transport-security': res.headers['strict-transport-security'] || null,
          'x-frame-options': res.headers['x-frame-options'] || null,
          'x-content-type-options': res.headers['x-content-type-options'] || null,
          'referrer-policy': res.headers['referrer-policy'] || null,
          'permissions-policy': res.headers['permissions-policy'] || null,
        };

        const missingHeaders = Object.entries(securityHeaders)
          .filter(([, v]) => !v)
          .map(([k]) => k);

        resolve({
          success: true,
          url,
          status_code: res.statusCode,
          status_ok: res.statusCode >= 200 && res.statusCode < 400,
          response_time_ms: responseTime,
          response_time_rating: responseTime < 500 ? 'fast' : responseTime < 2000 ? 'acceptable' : 'slow',
          content_length: body.length,
          content_type: res.headers['content-type'] || null,
          ssl,
          security_headers: securityHeaders,
          missing_security_headers: missingHeaders,
          server: res.headers['server'] || null,
          redirects: [],
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, url, error: 'Request timed out (10s)', status_ok: false });
    });

    req.on('error', (err) => {
      resolve({ success: false, url, error: err.message, status_ok: false });
    });

    req.end();
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    output({ error: 'Usage: node health-check.mjs <url>', success: false });
    process.exit(0);
  }

  // Validate URL format and block SSRF targets
  const urlCheck = validateUrl(url);
  if (!urlCheck.valid) {
    output({ error: urlCheck.reason, success: false });
    process.exit(0);
  }

  const result = await checkUrl(url);

  // Add overall health assessment
  const issues = [];
  if (!result.status_ok) issues.push(`HTTP ${result.status_code} — site is not responding correctly`);
  if (result.response_time_ms > 2000) issues.push(`Response time ${result.response_time_ms}ms is too slow (target <500ms)`);
  if (result.ssl && !result.ssl.valid) issues.push('SSL certificate is expired');
  if (result.ssl && result.ssl.days_until_expiry <= 14) issues.push(`SSL expires in ${result.ssl.days_until_expiry} days`);
  if (result.missing_security_headers && result.missing_security_headers.length > 3) {
    issues.push(`Missing ${result.missing_security_headers.length} security headers`);
  }
  if (!url.startsWith('https://')) issues.push('Site is not using HTTPS');

  result.health = issues.length === 0 ? 'healthy' : 'issues_found';
  result.issues = issues;

  output(result);
}

main();
