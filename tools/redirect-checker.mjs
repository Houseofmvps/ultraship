#!/usr/bin/env node
// tools/redirect-checker.mjs
// Checks redirect chains, loops, and mixed HTTP/HTTPS for URLs
// Usage: node tools/redirect-checker.mjs <url1> [url2] ...
//    OR: node tools/redirect-checker.mjs --sitemap=<sitemap-url-or-path>
// Safe: uses native https/http modules only, no shell execution

import https from 'https';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function followRedirects(url, maxHops = 10) {
  return new Promise((resolve) => {
    const chain = [];
    const visited = new Set();

    function hop(currentUrl, remaining) {
      if (remaining <= 0) {
        resolve({ url, chain, final_url: currentUrl, status: 'max_redirects', error: 'Exceeded maximum redirect hops (possible loop)' });
        return;
      }
      if (visited.has(currentUrl)) {
        resolve({ url, chain, final_url: currentUrl, status: 'loop', error: `Redirect loop detected at ${currentUrl}` });
        return;
      }
      // Validate each hop URL to prevent SSRF via redirect
      const hopCheck = validateUrl(currentUrl);
      if (!hopCheck.valid) {
        resolve({ url, chain, final_url: currentUrl, status: 'blocked', error: `Redirect blocked: ${hopCheck.reason}` });
        return;
      }
      visited.add(currentUrl);

      const isHttps = currentUrl.startsWith('https://');
      const mod = isHttps ? https : http;

      const req = mod.request(currentUrl, { method: 'HEAD', timeout: 8000 }, (res) => {
        chain.push({ url: currentUrl, status: res.statusCode });

        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let nextUrl = res.headers.location;
          if (nextUrl.startsWith('/')) {
            const u = new URL(currentUrl);
            nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
          }
          hop(nextUrl, remaining - 1);
        } else {
          resolve({
            url,
            chain,
            final_url: currentUrl,
            final_status: res.statusCode,
            status: res.statusCode >= 200 && res.statusCode < 400 ? 'ok' : 'error',
            redirect_count: chain.length - 1,
            has_chain: chain.length > 2,
            mixed_protocol: chain.some(c => c.url.startsWith('http://')) && chain.some(c => c.url.startsWith('https://')),
          });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        chain.push({ url: currentUrl, status: 'timeout' });
        resolve({ url, chain, final_url: currentUrl, status: 'timeout', error: `Timeout at ${currentUrl}` });
      });

      req.on('error', (err) => {
        chain.push({ url: currentUrl, status: 'error', error: err.message });
        resolve({ url, chain, final_url: currentUrl, status: 'error', error: err.message });
      });

      req.end();
    }

    hop(url, maxHops);
  });
}

function extractUrlsFromSitemap(content) {
  const urls = [];
  const regex = /<loc>(.*?)<\/loc>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) { reject(new Error(urlCheck.reason)); return; }
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { timeout: 10000 }, (res) => {
      const acc = createResponseAccumulator();
      res.on('data', (chunk) => { acc.onData(chunk); });
      res.on('end', () => resolve(acc.getBody()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    output({ error: 'Usage: node redirect-checker.mjs <url1> [url2] ... OR --sitemap=<path-or-url>', success: false });
    process.exit(0);
  }

  let urls = [];
  const sitemapArg = args.find(a => a.startsWith('--sitemap='));

  if (sitemapArg) {
    const sitemapPath = sitemapArg.split('=').slice(1).join('=');
    let content;
    if (sitemapPath.startsWith('http')) {
      try {
        content = await fetchUrl(sitemapPath);
      } catch (err) {
        output({ error: `Cannot fetch sitemap: ${err.message}`, success: false });
        process.exit(0);
      }
    } else if (existsSync(sitemapPath)) {
      content = readFileSync(sitemapPath, 'utf8');
    } else {
      output({ error: `Sitemap not found: ${sitemapPath}`, success: false });
      process.exit(0);
    }
    urls = extractUrlsFromSitemap(content);
    if (urls.length === 0) {
      output({ error: 'No URLs found in sitemap', success: false });
      process.exit(0);
    }
  } else {
    urls = args.filter(a => !a.startsWith('--'));
  }

  const results = [];
  const issues = [];

  for (const url of urls) {
    const result = await followRedirects(url);
    results.push(result);

    if (result.status === 'loop') {
      issues.push({ url, severity: 'critical', issue: 'redirect_loop', message: result.error });
    } else if (result.status === 'max_redirects') {
      issues.push({ url, severity: 'critical', issue: 'too_many_redirects', message: result.error });
    } else if (result.has_chain) {
      issues.push({ url, severity: 'high', issue: 'redirect_chain', message: `${result.redirect_count} redirects before reaching final URL — consolidate to single redirect` });
    } else if (result.mixed_protocol) {
      issues.push({ url, severity: 'high', issue: 'mixed_protocol', message: 'Redirect chain mixes HTTP and HTTPS — ensure all redirects go to HTTPS' });
    } else if (result.redirect_count === 1 && result.chain[0].status === 302) {
      issues.push({ url, severity: 'medium', issue: 'temporary_redirect', message: 'Using 302 (temporary) redirect — use 301 (permanent) for SEO value transfer' });
    }
  }

  output({
    success: true,
    urls_checked: urls.length,
    total_issues: issues.length,
    redirects_found: results.filter(r => r.redirect_count > 0).length,
    chains_found: results.filter(r => r.has_chain).length,
    loops_found: results.filter(r => r.status === 'loop').length,
    issues,
    results,
  });
}

main();
