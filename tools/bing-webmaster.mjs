#!/usr/bin/env node
// tools/bing-webmaster.mjs
// Bing Webmaster Tools API client
// Usage: node tools/bing-webmaster.mjs <command> [args]
// Commands:
//   submit-sitemap <site-url> <sitemap-url>   — Submit sitemap to Bing
//   list-sitemaps <site-url>                   — List submitted sitemaps
//   submit-url <site-url> <page-url>           — Submit URL for indexing
//   submit-url-batch <site-url> <url1> <url2>  — Submit multiple URLs
//   url-info <site-url> <page-url>             — Get URL traffic info
//   query <site-url> [days]                    — Search keywords (last N days)
//   indexnow <site-url> <url1> <url2> ...     — Instant IndexNow push for changed URLs
//   keyword-research <site-url> <keyword>     — Keyword suggestions from Bing
//   backlinks <site-url>                       — Backlink data (domains, anchor text)
//   site-scan <site-url>                       — Technical SEO scan from Bing
//   url-inspection <site-url> <page-url>      — Crawl/index status from Bing
//
// Auth: Set ULTRASHIP_BING_KEY to your Bing Webmaster API key
//
// Setup guide:
//   1. Go to https://www.bing.com/webmasters
//   2. Add and verify your site
//   3. Go to Settings → API Access → API Key
//   4. Set ULTRASHIP_BING_KEY=your-api-key

import https from 'https';
import { validateUrl } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function error(message) {
  output({ error: message, success: false });
  process.exit(0);
}

function apiRequest(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ssl.bing.com',
      path: `/webmaster/api.svc/json/${path}?apikey=${encodeURIComponent(apiKey)}`,
      method,
      headers: { 'Content-Type': 'application/json' },
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
            reject(new Error(err.Message || err.ErrorMessage || `HTTP ${res.statusCode}`));
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
    error('Usage: node bing-webmaster.mjs <command> [args]\nCommands: submit-sitemap, list-sitemaps, submit-url, submit-url-batch, url-info, query, indexnow, keyword-research, backlinks, site-scan, url-inspection');
  }

  const apiKey = process.env.ULTRASHIP_BING_KEY || process.env.CLAUDE_PLUGIN_OPTION_BING_KEY;
  if (!apiKey) {
    error('No Bing API key configured.\n\nSetup:\n1. Go to https://www.bing.com/webmasters\n2. Add and verify your site\n3. Go to Settings → API Access → API Key\n4. Set ULTRASHIP_BING_KEY=your-api-key\n\nOr configure via plugin settings: /plugin configure ultraship');
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
      try {
        await apiRequest('PUT', `SubmitSitemap`, apiKey, {
          siteUrl,
          feedPath: sitemapUrl,
        });
        output({ success: true, message: `Sitemap ${sitemapUrl} submitted to Bing for ${siteUrl}`, sitemap: sitemapUrl, site: siteUrl });
      } catch (err) {
        error(`Failed to submit sitemap: ${err.message}`);
      }
      break;
    }

    case 'list-sitemaps': {
      if (!siteUrl) error('Usage: list-sitemaps <site-url>');
      try {
        const result = await apiRequest('GET', `GetSitemaps&siteUrl=${encodeURIComponent(siteUrl)}`, apiKey);
        const sitemaps = (result.d || result || []).map(s => ({
          url: s.Url || s.FeedPath,
          last_crawled: s.LastCrawledDate,
          status: s.Status,
          submitted_count: s.SubmittedCount,
          indexed_count: s.IndexedCount,
          errors: s.ErrorCount,
          warnings: s.WarningCount,
        }));
        output({ success: true, site: siteUrl, sitemaps });
      } catch (err) {
        error(`Failed to list sitemaps: ${err.message}`);
      }
      break;
    }

    case 'submit-url': {
      const pageUrl = process.argv[4];
      if (!siteUrl || !pageUrl) error('Usage: submit-url <site-url> <page-url>');
      const pageCheck = validateUrl(pageUrl);
      if (!pageCheck.valid) error(`Invalid page URL: ${pageCheck.reason}`);
      try {
        await apiRequest('PUT', `SubmitUrl`, apiKey, {
          siteUrl,
          url: pageUrl,
        });
        output({ success: true, message: `URL ${pageUrl} submitted to Bing for indexing`, url: pageUrl, site: siteUrl, quota_note: 'Bing allows ~10 single URL submissions per day. Use submit-url-batch for multiple URLs.' });
      } catch (err) {
        error(`Failed to submit URL: ${err.message}`);
      }
      break;
    }

    case 'submit-url-batch': {
      const urls = process.argv.slice(4);
      if (!siteUrl || urls.length === 0) error('Usage: submit-url-batch <site-url> <url1> <url2> ...');
      for (const u of urls) {
        const batchCheck = validateUrl(u);
        if (!batchCheck.valid) error(`Invalid URL "${u}": ${batchCheck.reason}`);
      }
      try {
        await apiRequest('PUT', `SubmitUrlBatch`, apiKey, {
          siteUrl,
          urlList: urls,
        });
        output({ success: true, message: `${urls.length} URLs submitted to Bing for indexing`, urls, site: siteUrl, quota_note: 'Bing allows ~500 batch URL submissions per day total. Do NOT resubmit unchanged pages.' });
      } catch (err) {
        error(`Failed to submit URL batch: ${err.message}`);
      }
      break;
    }

    case 'url-info': {
      const pageUrl = process.argv[4];
      if (!siteUrl || !pageUrl) error('Usage: url-info <site-url> <page-url>');
      const urlCheck = validateUrl(pageUrl);
      if (!urlCheck.valid) error(`Invalid page URL: ${urlCheck.reason}`);
      try {
        const result = await apiRequest('GET', `GetUrlTrafficInfo&siteUrl=${encodeURIComponent(siteUrl)}&url=${encodeURIComponent(pageUrl)}`, apiKey);
        output({
          success: true,
          url: pageUrl,
          site: siteUrl,
          traffic_info: result.d || result,
        });
      } catch (err) {
        error(`Failed to get URL info: ${err.message}`);
      }
      break;
    }

    case 'query': {
      if (!siteUrl) error('Usage: query <site-url> [days]');
      try {
        const result = await apiRequest('GET', `GetQueryStats&siteUrl=${encodeURIComponent(siteUrl)}`, apiKey);
        const stats = (result.d || result || []).slice(0, 25).map(s => ({
          query: s.Query,
          impressions: s.Impressions,
          clicks: s.Clicks,
          ctr: s.ClickThroughRate,
          position: s.AvgClickPosition,
          date: s.Date,
        }));
        output({ success: true, site: siteUrl, top_queries: stats });
      } catch (err) {
        error(`Failed to get query stats: ${err.message}`);
      }
      break;
    }

    case 'indexnow': {
      // IndexNow: instant notification of URL changes to Bing, Yandex, and partners
      const urls = process.argv.slice(4);
      if (!siteUrl || urls.length === 0) error('Usage: indexnow <site-url> <url1> <url2> ...');
      for (const u of urls) {
        const urlCheck = validateUrl(u);
        if (!urlCheck.valid) error(`Invalid URL "${u}": ${urlCheck.reason}`);
      }
      try {
        let host;
        try { host = new URL(siteUrl).hostname; } catch { error('Invalid site URL'); }
        // IndexNow API — conservative limit to prevent abuse flags
        // Only submit URLs with SUBSTANTIAL content changes (not cosmetic fixes)
        if (urls.length > 100) {
          error(`Too many URLs (${urls.length}). IndexNow should be used for changed pages only, not bulk discovery. Limit to 100 URLs per run. Use submit-sitemap for bulk indexing.`);
        }
        const bodyStr = JSON.stringify({
          host,
          key: apiKey,
          keyLocation: `https://${host}/${apiKey}.txt`,
          urlList: urls,
        });
        await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'api.indexnow.org',
            path: '/IndexNow',
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(bodyStr) },
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
              else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            });
          });
          req.on('error', reject);
          req.write(bodyStr);
          req.end();
        });
        output({
          success: true,
          message: `${urls.length} URLs pushed via IndexNow — Bing, Yandex, and partners notified`,
          urls_submitted: urls.length,
          urls,
          note: 'IndexNow notifies Bing instantly. For it to work, place a key file at https://yourdomain.com/{apikey}.txt containing your API key.',
          best_practice: 'Only use IndexNow for pages with SUBSTANTIAL content changes. Do NOT resubmit unchanged pages — this wastes the signal and can trigger abuse detection.',
        });
      } catch (err) {
        error(`IndexNow push failed: ${err.message}`);
      }
      break;
    }

    case 'keyword-research': {
      const keyword = process.argv[4];
      if (!siteUrl || !keyword) error('Usage: keyword-research <site-url> <keyword>');
      try {
        const result = await apiRequest('GET', `GetKeywordResearch&q=${encodeURIComponent(keyword)}&siteUrl=${encodeURIComponent(siteUrl)}&country=us&language=en`, apiKey);
        const suggestions = (result.d || result || []).map(s => ({
          keyword: s.Query || s.Keyword,
          impressions: s.Impressions,
          clicks: s.Clicks,
          broad_impressions: s.BroadImpressions,
        }));
        output({
          success: true,
          site: siteUrl,
          seed_keyword: keyword,
          suggestions: suggestions.slice(0, 50),
          insight: `${suggestions.length} keyword suggestions from Bing. Cross-reference with GSC data to find gaps — keywords Bing suggests that you don't rank for are expansion opportunities.`,
        });
      } catch (err) {
        error(`Keyword research failed: ${err.message}. Note: This endpoint may require specific Bing API tier access.`);
      }
      break;
    }

    case 'backlinks': {
      if (!siteUrl) error('Usage: backlinks <site-url>');
      try {
        const result = await apiRequest('GET', `GetLinkCounts&siteUrl=${encodeURIComponent(siteUrl)}`, apiKey);
        const data = result.d || result || {};

        // Also try to get sample backlinks
        let sampleLinks = [];
        try {
          const linksResult = await apiRequest('GET', `GetUrlLinks&siteUrl=${encodeURIComponent(siteUrl)}&offset=0&count=50`, apiKey);
          sampleLinks = (linksResult.d || linksResult || []).map(l => ({
            source_url: l.SourceUrl || l.Url,
            anchor_text: l.AnchorText,
            target_url: l.TargetUrl,
          }));
        } catch { /* sample links optional */ }

        output({
          success: true,
          site: siteUrl,
          link_counts: data,
          sample_backlinks: sampleLinks.slice(0, 30),
          insight: 'Compare backlink count with competitors (use /compete). Pages with few backlinks but good content are backlink acquisition targets.',
        });
      } catch (err) {
        error(`Backlinks query failed: ${err.message}. Note: This endpoint may require specific Bing API tier access.`);
      }
      break;
    }

    case 'site-scan': {
      if (!siteUrl) error('Usage: site-scan <site-url>');
      try {
        const result = await apiRequest('GET', `GetScanDetails&siteUrl=${encodeURIComponent(siteUrl)}`, apiKey);
        const scanData = result.d || result || {};
        output({
          success: true,
          site: siteUrl,
          scan: scanData,
          insight: 'Bing Site Scan shows technical issues from Bing\'s perspective. Fix critical issues first — they may differ from Google\'s view.',
        });
      } catch (err) {
        error(`Site scan failed: ${err.message}. Note: You may need to initiate a scan first via Bing Webmaster Tools dashboard.`);
      }
      break;
    }

    case 'url-inspection': {
      const pageUrl = process.argv[4];
      if (!siteUrl || !pageUrl) error('Usage: url-inspection <site-url> <page-url>');
      const inspCheck = validateUrl(pageUrl);
      if (!inspCheck.valid) error(`Invalid page URL: ${inspCheck.reason}`);
      try {
        const result = await apiRequest('GET', `GetUrlInfo&siteUrl=${encodeURIComponent(siteUrl)}&url=${encodeURIComponent(pageUrl)}`, apiKey);
        const info = result.d || result || {};
        output({
          success: true,
          url: pageUrl,
          site: siteUrl,
          inspection: {
            http_code: info.HttpCode,
            discovered_date: info.DiscoveredDate,
            last_crawled: info.LastCrawledDate,
            last_seen: info.LastSeenDate,
            cache_date: info.CacheDate,
            index_status: info.IsPage !== undefined ? (info.IsPage ? 'indexed' : 'not_indexed') : 'unknown',
            raw: info,
          },
          insight: 'Compare with GSC URL Inspection. If Bing indexes but Google doesn\'t (or vice versa), investigate crawl barriers specific to each engine.',
        });
      } catch (err) {
        error(`URL inspection failed: ${err.message}`);
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: submit-sitemap, list-sitemaps, submit-url, submit-url-batch, url-info, query, indexnow, keyword-research, backlinks, site-scan, url-inspection`);
  }
}

main();
