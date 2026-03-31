#!/usr/bin/env node
// tools/index-doctor.mjs
// Index Doctor — diagnoses and fixes non-indexed pages
// Usage: node tools/index-doctor.mjs <command> <site-url> [args]
// Commands:
//   diagnose <site-url> <sitemap-url>         — Check indexing status of all sitemap URLs
//   inspect <site-url> <page-url>             — Deep inspection of single URL
//   fix <site-url> <sitemap-url>              — Auto-submit non-indexed pages for re-indexing
//   coverage <site-url>                       — GSC index coverage report
//   compare <site-url> <sitemap-url>          — Compare GSC vs Bing indexing
//
// Auth: ULTRASHIP_GSC_CREDENTIALS or ULTRASHIP_GSC_ACCESS_TOKEN (required)
//       ULTRASHIP_BING_KEY (optional, enables cross-engine comparison)
//
// The Index Doctor:
//   1. Fetches your sitemap to get all URLs
//   2. Inspects each URL via GSC URL Inspection API
//   3. Diagnoses WHY pages aren't indexed (crawl errors, noindex, redirect, etc.)
//   4. Generates a fix plan with specific actions per URL
//   5. Auto-submits non-indexed URLs for re-crawling

import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function error(message) {
  output({ error: message, success: false });
  process.exit(0);
}

// GSC Auth (same pattern as gsc-client.mjs)
async function getGscToken() {
  let token = process.env.ULTRASHIP_GSC_ACCESS_TOKEN;
  if (token) return token;

  const keyPath = process.env.ULTRASHIP_GSC_CREDENTIALS;
  if (!keyPath) {
    error('No GSC credentials configured.\n\nSetup:\n1. Enable Search Console API in Google Cloud Console\n2. Create Service Account → Download JSON key\n3. Add service account email in GSC Settings → Users\n4. Set ULTRASHIP_GSC_CREDENTIALS=/path/to/key.json');
  }

  let key;
  try {
    key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch {
    error(`Cannot read service account key at: ${keyPath}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(key.private_key, 'base64url');
  const jwt = `${signInput}.${signature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) resolve(data.access_token);
          else reject(new Error(data.error_description || 'Token exchange failed'));
        } catch { reject(new Error('Failed to parse token response')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function gscRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'searchconsole.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(data ? JSON.parse(data) : {}); }
          catch { resolve({ raw: data }); }
        } else {
          try {
            const err = JSON.parse(data);
            reject(new Error(err.error?.message || `HTTP ${res.statusCode}`));
          } catch { reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)); }
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Fetch and parse sitemap XML to extract URLs
async function fetchSitemapUrls(sitemapUrl, depth = 0) {
  if (depth > 3) {
    throw new Error(`Too many redirects fetching sitemap: ${sitemapUrl}`);
  }
  const check = validateUrl(sitemapUrl);
  if (!check.valid) error(`Invalid sitemap URL: ${check.reason}`);

  return new Promise((resolve, reject) => {
    const parsed = new URL(sitemapUrl);
    const acc = createResponseAccumulator();
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'Ultraship-IndexDoctor/1.0' },
    }, (res) => {
      // Follow redirects (up to 3 hops)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectCheck = validateUrl(res.headers.location);
        if (!redirectCheck.valid) {
          reject(new Error(`Redirect to blocked URL: ${res.headers.location}`));
          return;
        }
        fetchSitemapUrls(res.headers.location, depth + 1).then(resolve).catch(reject);
        return;
      }
      res.on('data', (chunk) => acc.onData(chunk));
      res.on('end', () => {
        const body = acc.getBody();
        // Extract <loc> URLs from sitemap XML
        const urls = [];
        const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
        let match;
        while ((match = locRegex.exec(body)) !== null) {
          urls.push(match[1].trim());
        }

        // Check if this is a sitemap index (contains other sitemaps)
        if (body.includes('<sitemapindex') && urls.length > 0) {
          // These are sub-sitemaps — fetch sequentially to avoid overwhelming the server
          // Limit to first 10 sub-sitemaps to prevent excessive requests
          const subSitemaps = urls.slice(0, 10);
          const results = [];
          (async () => {
            for (const u of subSitemaps) {
              try { results.push(await fetchSitemapUrls(u)); } catch { /* skip failed sub-sitemaps */ }
            }
            resolve(results.flat());
          })().catch(reject);
        } else {
          resolve(urls);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Inspect a single URL via GSC URL Inspection API
async function inspectUrl(siteUrl, pageUrl, token) {
  try {
    const result = await gscRequest('POST', '/v1/urlInspection/index:inspect', token, {
      inspectionUrl: pageUrl,
      siteUrl,
    });
    const inspection = result.inspectionResult || {};
    const indexStatus = inspection.indexStatusResult || {};

    return {
      url: pageUrl,
      verdict: indexStatus.verdict || 'UNKNOWN',
      coverage_state: indexStatus.coverageState || 'Unknown',
      indexing_state: indexStatus.indexingState || 'Unknown',
      crawled_as: indexStatus.crawledAs || 'Unknown',
      last_crawl_time: indexStatus.lastCrawlTime || null,
      page_fetch_state: indexStatus.pageFetchState || 'Unknown',
      robots_txt_state: indexStatus.robotsTxtState || 'Unknown',
      referring_urls: indexStatus.referringUrls || [],
      crawl_allowed: indexStatus.robotsTxtState !== 'DISALLOWED',
      is_indexed: indexStatus.verdict === 'PASS',
    };
  } catch (err) {
    return {
      url: pageUrl,
      verdict: 'ERROR',
      error: err.message,
      is_indexed: false,
    };
  }
}

// Diagnose why a page isn't indexed
function diagnoseNonIndexed(inspection) {
  const diagnosis = {
    url: inspection.url,
    is_indexed: inspection.is_indexed,
    reason: 'Unknown',
    severity: 'high',
    fix: '',
  };

  if (inspection.is_indexed) {
    diagnosis.reason = 'Page is indexed';
    diagnosis.severity = 'none';
    diagnosis.fix = 'No action needed';
    return diagnosis;
  }

  if (inspection.error) {
    diagnosis.reason = `API error: ${inspection.error}`;
    diagnosis.fix = 'Check if the URL is accessible and try again';
    return diagnosis;
  }

  const state = (inspection.coverage_state || '').toLowerCase();
  const fetchState = (inspection.page_fetch_state || '').toLowerCase();

  // Robots.txt blocked
  if (inspection.robots_txt_state === 'DISALLOWED' || state.includes('blocked by robots')) {
    diagnosis.reason = 'Blocked by robots.txt';
    diagnosis.severity = 'critical';
    diagnosis.fix = 'Remove the Disallow rule from robots.txt that blocks this URL path. Then request re-indexing.';
    return diagnosis;
  }

  // Noindex tag
  if (state.includes('noindex') || state.includes('excluded by noindex')) {
    diagnosis.reason = 'Page has noindex meta tag or X-Robots-Tag header';
    diagnosis.severity = 'critical';
    diagnosis.fix = 'Remove <meta name="robots" content="noindex"> from the page HTML. Remove X-Robots-Tag: noindex from server headers. Then request re-indexing.';
    return diagnosis;
  }

  // Redirect
  if (state.includes('redirect') || state.includes('page with redirect')) {
    diagnosis.reason = 'Page redirects to another URL';
    diagnosis.severity = 'medium';
    diagnosis.fix = 'Update your sitemap and internal links to point to the final redirect destination URL instead.';
    return diagnosis;
  }

  // Soft 404
  if (state.includes('soft 404') || state.includes('soft-404')) {
    diagnosis.reason = 'Google considers this a soft 404 (page exists but looks empty/error-like)';
    diagnosis.severity = 'high';
    diagnosis.fix = 'Add substantial unique content to this page. Ensure it returns HTTP 200 with meaningful content (not thin/boilerplate). If the page truly doesn\'t exist, return a proper 404 status code.';
    return diagnosis;
  }

  // 404
  if (state.includes('not found') || fetchState.includes('not found') || state.includes('404')) {
    diagnosis.reason = 'Page returns 404 Not Found';
    diagnosis.severity = 'high';
    diagnosis.fix = 'Either fix the URL so it returns content, or remove it from sitemap and set up a 301 redirect to a relevant page.';
    return diagnosis;
  }

  // Server error (5xx)
  if (fetchState.includes('error') || state.includes('server error') || state.includes('5xx')) {
    diagnosis.reason = 'Server error when Google tried to crawl the page';
    diagnosis.severity = 'critical';
    diagnosis.fix = 'Fix the server error. Check server logs for the specific error. Ensure the page loads correctly. Then request re-indexing.';
    return diagnosis;
  }

  // Unauthorized (401)
  if (state.includes('unauthorized') || state.includes('401')) {
    diagnosis.reason = 'Blocked due to unauthorized request (401) — page requires authentication';
    diagnosis.severity = 'critical';
    diagnosis.fix = 'Ensure Googlebot can access this page without authentication. Remove login requirements for public content. If the page should be private, remove it from sitemap.';
    return diagnosis;
  }

  // Forbidden (403)
  if (state.includes('forbidden') || state.includes('403')) {
    diagnosis.reason = 'Blocked due to access forbidden (403) — server rejects the crawler';
    diagnosis.severity = 'critical';
    diagnosis.fix = 'Check server/CDN firewall rules — Googlebot may be blocked. Ensure your WAF/rate limiter allows search engine bots. Whitelist Googlebot user agents.';
    return diagnosis;
  }

  // Discovered but not indexed (NOT "not crawled" — Google's actual state says "not indexed")
  if (state.includes('discovered') && state.includes('not indexed')) {
    diagnosis.reason = 'Discovered but not yet crawled — Google knows about the URL but hasn\'t visited it yet';
    diagnosis.severity = 'medium';
    diagnosis.fix = 'Submit URL directly for indexing via GSC. Build internal links from your most-crawled pages to this URL. This often resolves on its own within 1-2 weeks for newer sites.';
    return diagnosis;
  }

  // Crawled but not indexed
  if (state.includes('crawled') && state.includes('not indexed')) {
    diagnosis.reason = 'Crawled but not indexed — Google found the page but decided not to index it';
    diagnosis.severity = 'high';
    diagnosis.fix = 'This usually means Google thinks the content is low quality, duplicate, or not useful. Actions: (1) Add more unique, valuable content. (2) Build internal links to this page. (3) Get external backlinks. (4) Ensure content is substantially different from similar pages on your site. (5) Request re-indexing via GSC.';
    return diagnosis;
  }

  // URL unknown to Google
  if (state.includes('unknown') || state === '') {
    diagnosis.reason = 'URL is unknown to Google — not discovered yet';
    diagnosis.severity = 'high';
    diagnosis.fix = 'Submit this URL via GSC URL Inspection → Request Indexing. Add it to your sitemap. Build internal links from indexed pages. Submit sitemap to GSC.';
    return diagnosis;
  }

  // Alternate page with proper canonical (check BEFORE canonical/duplicate — "alternate" state also contains "canonical")
  if (state.includes('alternate')) {
    diagnosis.reason = 'Alternate page with proper canonical tag — Google indexes the canonical version instead';
    diagnosis.severity = 'low';
    diagnosis.fix = 'This is usually correct behavior. Verify the canonical URL is the one you want indexed.';
    return diagnosis;
  }

  // Canonical mismatch / duplicate
  if (state.includes('canonical') || state.includes('duplicate')) {
    diagnosis.reason = 'Duplicate page — Google chose a different canonical URL';
    diagnosis.severity = 'medium';
    diagnosis.fix = 'Either: (1) Set the canonical tag to point to this URL if this is the preferred version, or (2) Accept that Google prefers the other URL and redirect this one to the canonical.';
    return diagnosis;
  }

  // Fallback
  diagnosis.reason = `Coverage state: ${inspection.coverage_state || 'Unknown'}. Fetch state: ${inspection.page_fetch_state || 'Unknown'}`;
  diagnosis.fix = 'Submit the URL for re-indexing via GSC. Check the URL Inspection tool in GSC web interface for more details.';

  return diagnosis;
}

async function main() {
  const command = process.argv[2];
  const siteUrl = process.argv[3];

  if (!command) {
    error('Usage: node index-doctor.mjs <command> <site-url> [args]\nCommands: diagnose, inspect, fix, coverage, compare');
  }

  if (!siteUrl) {
    error('Site URL required. Example: node index-doctor.mjs diagnose https://example.com https://example.com/sitemap.xml');
  }

  const siteCheck = validateUrl(siteUrl);
  if (!siteCheck.valid) error(`Invalid site URL: ${siteCheck.reason}`);

  // Validate command-specific arguments BEFORE auth to give clear errors
  const arg4 = process.argv[4];
  if ((command === 'diagnose' || command === 'fix') && !arg4) {
    error(`Usage: ${command} <site-url> <sitemap-url>`);
  }
  if (command === 'inspect' && !arg4) {
    error('Usage: inspect <site-url> <page-url>');
  }

  let token;
  try {
    token = await getGscToken();
  } catch (err) {
    error(`GSC auth failed: ${err.message}`);
  }

  switch (command) {
    case 'diagnose': {
      const sitemapUrl = arg4;

      // Fetch all URLs from sitemap
      let urls;
      try {
        urls = await fetchSitemapUrls(sitemapUrl);
      } catch (err) {
        error(`Failed to fetch sitemap: ${err.message}`);
      }

      if (urls.length === 0) {
        error('No URLs found in sitemap. Verify the sitemap URL is correct and contains <loc> entries.');
      }

      // Rate limit: GSC URL Inspection API quota is 2000/property/day
      // Conservative limit: 20 URLs per run to allow multiple runs safely
      const maxUrls = Math.min(urls.length, 20);
      const inspections = [];
      const diagnoses = [];

      for (let i = 0; i < maxUrls; i++) {
        const inspection = await inspectUrl(siteUrl, urls[i], token);
        inspections.push(inspection);
        diagnoses.push(diagnoseNonIndexed(inspection));

        // 500ms delay between requests to respect rate limits (GSC quota: 2000/property/day)
        if (i < maxUrls - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const indexed = diagnoses.filter(d => d.is_indexed);
      const notIndexed = diagnoses.filter(d => !d.is_indexed);
      const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
      const byReason = {};

      for (const d of notIndexed) {
        bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
        if (!byReason[d.reason]) byReason[d.reason] = [];
        byReason[d.reason].push(d.url);
      }

      output({
        success: true,
        site: siteUrl,
        sitemap: sitemapUrl,
        total_urls_in_sitemap: urls.length,
        urls_inspected: maxUrls,
        urls_remaining: urls.length - maxUrls,
        summary: {
          indexed: indexed.length,
          not_indexed: notIndexed.length,
          index_rate: Math.round((indexed.length / maxUrls) * 100),
        },
        severity_breakdown: bySeverity,
        issues_by_reason: Object.entries(byReason).map(([reason, urls]) => ({
          reason,
          count: urls.length,
          urls: urls.slice(0, 5),
        })),
        non_indexed_details: notIndexed.map(d => ({
          url: d.url,
          reason: d.reason,
          severity: d.severity,
          fix: d.fix,
        })),
        indexed_urls: indexed.map(d => d.url),
        quota_warning: `Used ${maxUrls} of ~2000 daily GSC URL Inspection quota. Run sparingly — quota resets daily.`,
      });
      break;
    }

    case 'inspect': {
      const pageUrl = arg4;
      const pageCheck = validateUrl(pageUrl);
      if (!pageCheck.valid) error(`Invalid page URL: ${pageCheck.reason}`);

      const inspection = await inspectUrl(siteUrl, pageUrl, token);
      const diagnosis = diagnoseNonIndexed(inspection);

      output({
        success: true,
        inspection,
        diagnosis,
      });
      break;
    }

    case 'fix': {
      const sitemapUrl = arg4;

      // Fetch URLs and find non-indexed ones
      let urls;
      try {
        urls = await fetchSitemapUrls(sitemapUrl);
      } catch (err) {
        error(`Failed to fetch sitemap: ${err.message}`);
      }

      // Conservative limit: 20 URLs per run (GSC quota: 2000/property/day)
      const maxUrls = Math.min(urls.length, 20);
      const nonIndexed = [];
      const actions = [];

      for (let i = 0; i < maxUrls; i++) {
        const inspection = await inspectUrl(siteUrl, urls[i], token);
        if (!inspection.is_indexed && !inspection.error) {
          nonIndexed.push(inspection);
          const diagnosis = diagnoseNonIndexed(inspection);
          actions.push({ url: urls[i], reason: diagnosis.reason, fix: diagnosis.fix, severity: diagnosis.severity });
        }
        if (i < maxUrls - 1) await new Promise(r => setTimeout(r, 200));
      }

      // Submit non-indexed URLs to Bing for re-indexing (if API key available)
      const bingKey = process.env.ULTRASHIP_BING_KEY;
      let bingSubmitted = 0;
      let bingErrMsg = '';
      if (bingKey && nonIndexed.length > 0) {
        const bingUrls = nonIndexed
          .filter(i => i.robots_txt_state !== 'DISALLOWED') // Don't submit robots-blocked URLs
          .map(i => i.url)
          .slice(0, 50); // Conservative Bing batch limit (API allows 500/day total)

        if (bingUrls.length > 0) {
          try {
            await new Promise((resolve, reject) => {
              const bodyStr = JSON.stringify({ siteUrl, urlList: bingUrls });
              const req = https.request({
                hostname: 'ssl.bing.com',
                path: `/webmaster/api.svc/json/SubmitUrlBatch?apikey=${encodeURIComponent(bingKey)}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
              }, (res) => {
                let data = '';
                res.on('data', c => { data += c; });
                res.on('end', () => {
                  if (res.statusCode < 300) resolve();
                  else reject(new Error(`Bing HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                });
              });
              req.on('error', reject);
              req.write(bodyStr);
              req.end();
            });
            bingSubmitted = bingUrls.length;
          } catch (bingErr) {
            bingSubmitted = -1; // Indicates failure
            bingErrMsg = bingErr.message || 'Unknown error';
          }
        }
      }

      // Group actions by fix type for efficient remediation
      const fixGroups = {};
      for (const action of actions) {
        const key = action.reason;
        if (!fixGroups[key]) fixGroups[key] = { reason: key, fix: action.fix, severity: action.severity, urls: [] };
        fixGroups[key].urls.push(action.url);
      }

      output({
        success: true,
        site: siteUrl,
        sitemap: sitemapUrl,
        total_inspected: maxUrls,
        non_indexed_count: nonIndexed.length,
        bing_submitted: bingSubmitted >= 0 ? bingSubmitted : 0,
        bing_error: bingSubmitted === -1 ? `Bing URL submission failed: ${bingErrMsg}. Check your ULTRASHIP_BING_KEY is valid.` : undefined,
        fix_plan: Object.values(fixGroups).sort((a, b) => {
          const sev = { critical: 0, high: 1, medium: 2, low: 3 };
          return (sev[a.severity] || 4) - (sev[b.severity] || 4);
        }),
        next_steps: [
          nonIndexed.length > 0 ? 'Fix the issues listed in the fix_plan above — but ONLY fix pages that SHOULD be indexed (not staging, admin, or intentionally hidden pages)' : 'All inspected pages are indexed!',
          'Re-run this command after fixes to verify indexing — wait at least 48 hours for Google to re-crawl',
          'Submit sitemap to GSC: node gsc-client.mjs submit-sitemap <site-url> <sitemap-url>',
          bingSubmitted === -1 ? 'Bing submission failed — verify your API key at bing.com/webmasters'
            : bingKey ? `${bingSubmitted} URLs submitted to Bing for re-indexing`
            : 'Set ULTRASHIP_BING_KEY to also submit to Bing for re-indexing',
        ],
        quota_warning: `Used ${maxUrls} GSC URL Inspection API calls (~2000/property/day). Bing: ${bingSubmitted >= 0 ? bingSubmitted : 0} URLs submitted (~500/day quota). Run sparingly — do NOT resubmit unchanged pages.`,
      });
      break;
    }

    case 'coverage': {
      // Use GSC sitemaps API to get coverage overview
      try {
        const encodedSite = encodeURIComponent(siteUrl);
        const result = await gscRequest('GET', `/webmasters/v3/sites/${encodedSite}/sitemaps`, token);
        const sitemaps = (result.sitemap || []).map(s => ({
          path: s.path,
          type: s.type,
          last_submitted: s.lastSubmitted,
          last_downloaded: s.lastDownloaded,
          is_pending: s.isPending,
          warnings: s.warnings,
          errors: s.errors,
          contents: s.contents?.map(c => ({
            type: c.type,
            submitted: c.submitted,
            indexed: c.indexed,
            index_rate: c.submitted > 0 ? Math.round((c.indexed / c.submitted) * 100) : 0,
          })),
        }));

        let totalSubmitted = 0;
        let totalIndexed = 0;
        for (const s of sitemaps) {
          for (const c of (s.contents || [])) {
            totalSubmitted += c.submitted || 0;
            totalIndexed += c.indexed || 0;
          }
        }

        output({
          success: true,
          site: siteUrl,
          sitemaps,
          coverage_summary: {
            total_submitted: totalSubmitted,
            total_indexed: totalIndexed,
            index_rate: totalSubmitted > 0 ? Math.round((totalIndexed / totalSubmitted) * 100) : 0,
            not_indexed: totalSubmitted - totalIndexed,
          },
          health: totalSubmitted > 0 && (totalIndexed / totalSubmitted) >= 0.9
            ? 'HEALTHY — 90%+ pages indexed'
            : totalSubmitted > 0 && (totalIndexed / totalSubmitted) >= 0.7
            ? 'WARNING — 70-90% pages indexed, investigate non-indexed URLs'
            : 'CRITICAL — less than 70% pages indexed, run diagnose command',
        });
      } catch (err) {
        error(`Coverage query failed: ${err.message}`);
      }
      break;
    }

    case 'compare': {
      const bingKey = process.env.ULTRASHIP_BING_KEY;
      if (!bingKey) {
        error('Bing API key required for cross-engine comparison.\nSet ULTRASHIP_BING_KEY=your-api-key');
      }

      // Get GSC coverage
      let gscSitemaps;
      try {
        const encodedSite = encodeURIComponent(siteUrl);
        const result = await gscRequest('GET', `/webmasters/v3/sites/${encodedSite}/sitemaps`, token);
        gscSitemaps = result.sitemap || [];
      } catch (err) {
        error(`GSC query failed: ${err.message}`);
      }

      // Get Bing sitemaps
      let bingSitemaps;
      try {
        const bingResult = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'ssl.bing.com',
            path: `/webmaster/api.svc/json/GetSitemaps?apikey=${encodeURIComponent(bingKey)}&siteUrl=${encodeURIComponent(siteUrl)}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }, (res) => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => {
              if (res.statusCode < 300) {
                try { resolve(JSON.parse(data)); } catch { resolve({}); }
              } else { reject(new Error(`Bing HTTP ${res.statusCode}`)); }
            });
          });
          req.on('error', reject);
          req.end();
        });
        bingSitemaps = bingResult.d || bingResult || [];
      } catch (err) {
        bingSitemaps = [];
      }

      // Calculate GSC totals
      let gscSubmitted = 0, gscIndexed = 0;
      for (const s of gscSitemaps) {
        for (const c of (s.contents || [])) {
          gscSubmitted += c.submitted || 0;
          gscIndexed += c.indexed || 0;
        }
      }

      // Calculate Bing totals
      let bingSubmitted = 0, bingIndexed = 0;
      for (const s of (Array.isArray(bingSitemaps) ? bingSitemaps : [])) {
        bingSubmitted += s.SubmittedCount || 0;
        bingIndexed += s.IndexedCount || 0;
      }

      output({
        success: true,
        site: siteUrl,
        google: {
          submitted: gscSubmitted,
          indexed: gscIndexed,
          index_rate: gscSubmitted > 0 ? Math.round((gscIndexed / gscSubmitted) * 100) : 0,
          not_indexed: gscSubmitted - gscIndexed,
        },
        bing: {
          submitted: bingSubmitted,
          indexed: bingIndexed,
          index_rate: bingSubmitted > 0 ? Math.round((bingIndexed / bingSubmitted) * 100) : 0,
          not_indexed: bingSubmitted - bingIndexed,
        },
        gap_analysis: {
          google_advantage: gscIndexed - bingIndexed,
          bing_advantage: bingIndexed - gscIndexed,
          recommendation: bingIndexed < gscIndexed
            ? 'Bing has fewer indexed pages than Google. Submit sitemap to Bing and use submit-url-batch for important pages. This also improves ChatGPT Search and DuckDuckGo visibility.'
            : gscIndexed < bingIndexed
            ? 'Google has fewer indexed pages. Focus on GSC — submit sitemap, request indexing for key pages, and improve internal linking.'
            : 'Both engines have similar index coverage. Focus on content quality and backlinks to improve rankings.',
        },
      });
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: diagnose, inspect, fix, coverage, compare`);
  }
}

main();
