#!/usr/bin/env node
// tools/gsc-client.mjs
// Google Search Console API client
// Usage: node tools/gsc-client.mjs <command> [args]
// Commands:
//   submit-sitemap <site-url> <sitemap-url>   — Submit sitemap to GSC
//   list-sitemaps <site-url>                   — List submitted sitemaps
//   inspect-url <site-url> <page-url>          — Inspect URL indexing status
//   query <site-url> [days]                    — Search analytics (last N days, default 28)
//
// Auth: Set ULTRASHIP_GSC_CREDENTIALS to path of service account JSON key file
//       OR set ULTRASHIP_GSC_ACCESS_TOKEN to a valid OAuth2 access token
//
// Setup guide:
//   1. Go to Google Cloud Console → APIs & Services → Enable "Search Console API"
//   2. Create a Service Account → Download JSON key
//   3. Add the service account email as a user in GSC (Settings → Users)
//   4. Set ULTRASHIP_GSC_CREDENTIALS=/path/to/key.json

import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { validateUrl } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function error(message) {
  output({ error: message, success: false });
  process.exit(0);
}

// Get access token from service account JSON key
async function getAccessToken(keyPath) {
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

function apiRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'searchconsole.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    error('Usage: node gsc-client.mjs <command> [args]\nCommands: submit-sitemap, list-sitemaps, inspect-url, query');
  }

  // Get access token
  let token = process.env.ULTRASHIP_GSC_ACCESS_TOKEN;
  if (!token) {
    const keyPath = process.env.ULTRASHIP_GSC_CREDENTIALS;
    if (!keyPath) {
      error('No GSC credentials configured.\n\nSetup:\n1. Enable Search Console API in Google Cloud Console\n2. Create Service Account and download JSON key\n3. Add service account email as user in GSC\n4. Set ULTRASHIP_GSC_CREDENTIALS=/path/to/key.json');
    }
    try {
      token = await getAccessToken(keyPath);
    } catch (err) {
      error(`Auth failed: ${err.message}`);
    }
  }

  const siteUrl = process.argv[3];

  // Validate user-provided URLs
  if (siteUrl) {
    const check = validateUrl(siteUrl);
    if (!check.valid) error(`Invalid site URL: ${check.reason}`);
  }

  switch (command) {
    case 'submit-sitemap': {
      const sitemapUrl = process.argv[4];
      if (!siteUrl || !sitemapUrl) error('Usage: submit-sitemap <site-url> <sitemap-url>');
      const encodedSite = encodeURIComponent(siteUrl);
      const encodedSitemap = encodeURIComponent(sitemapUrl);
      try {
        await apiRequest('PUT', `/webmasters/v3/sites/${encodedSite}/sitemaps/${encodedSitemap}`, token);
        output({ success: true, message: `Sitemap ${sitemapUrl} submitted to GSC for ${siteUrl}`, sitemap: sitemapUrl, site: siteUrl });
      } catch (err) {
        error(`Failed to submit sitemap: ${err.message}`);
      }
      break;
    }

    case 'list-sitemaps': {
      if (!siteUrl) error('Usage: list-sitemaps <site-url>');
      const encodedSite = encodeURIComponent(siteUrl);
      try {
        const result = await apiRequest('GET', `/webmasters/v3/sites/${encodedSite}/sitemaps`, token);
        const sitemaps = (result.sitemap || []).map(s => ({
          path: s.path,
          last_submitted: s.lastSubmitted,
          last_downloaded: s.lastDownloaded,
          is_pending: s.isPending,
          warnings: s.warnings,
          errors: s.errors,
          contents: s.contents?.map(c => ({ type: c.type, submitted: c.submitted, indexed: c.indexed })),
        }));
        output({ success: true, site: siteUrl, sitemaps });
      } catch (err) {
        error(`Failed to list sitemaps: ${err.message}`);
      }
      break;
    }

    case 'inspect-url': {
      const pageUrl = process.argv[4];
      if (!siteUrl || !pageUrl) error('Usage: inspect-url <site-url> <page-url>');
      const pageCheck = validateUrl(pageUrl);
      if (!pageCheck.valid) error(`Invalid page URL: ${pageCheck.reason}`);
      try {
        const result = await apiRequest('POST', '/v1/urlInspection/index:inspect', token, {
          inspectionUrl: pageUrl,
          siteUrl: siteUrl,
        });
        const inspection = result.inspectionResult || {};
        const indexStatus = inspection.indexStatusResult || {};
        const mobileUsability = inspection.mobileUsabilityResult || {};
        const richResults = inspection.richResultsResult || {};

        output({
          success: true,
          url: pageUrl,
          site: siteUrl,
          index_status: {
            verdict: indexStatus.verdict,
            coverage_state: indexStatus.coverageState,
            crawled_as: indexStatus.crawledAs,
            indexing_state: indexStatus.indexingState,
            last_crawl_time: indexStatus.lastCrawlTime,
            page_fetch_state: indexStatus.pageFetchState,
            robots_txt_state: indexStatus.robotsTxtState,
            referring_urls: indexStatus.referringUrls,
          },
          mobile_usability: {
            verdict: mobileUsability.verdict,
            issues: mobileUsability.issues?.map(i => ({ type: i.issueType, message: i.message, severity: i.severity })),
          },
          rich_results: {
            verdict: richResults.verdict,
            detected_items: richResults.detectedItems?.map(i => ({ type: i.richResultType, items_count: i.items?.length })),
          },
        });
      } catch (err) {
        error(`URL inspection failed: ${err.message}`);
      }
      break;
    }

    case 'query': {
      if (!siteUrl) error('Usage: query <site-url> [days]');
      const days = parseInt(process.argv[4] || '28', 10);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 86400000);
      const fmt = d => d.toISOString().split('T')[0];

      try {
        const result = await apiRequest('POST', `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, token, {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['query'],
          rowLimit: 25,
        });

        const rows = (result.rows || []).map(r => ({
          query: r.keys[0],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: Math.round(r.ctr * 10000) / 100,
          position: Math.round(r.position * 10) / 10,
        }));

        output({
          success: true,
          site: siteUrl,
          period: `${fmt(startDate)} to ${fmt(endDate)}`,
          total_rows: rows.length,
          top_queries: rows,
        });
      } catch (err) {
        error(`Search analytics query failed: ${err.message}`);
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: submit-sitemap, list-sitemaps, inspect-url, query`);
  }
}

main();
