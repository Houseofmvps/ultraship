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
//
// Auth: Set ULTRASHIP_BING_KEY to your Bing Webmaster API key
//
// Setup guide:
//   1. Go to https://www.bing.com/webmasters
//   2. Add and verify your site
//   3. Go to Settings → API Access → API Key
//   4. Set ULTRASHIP_BING_KEY=your-api-key

import https from 'https';

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
    error('Usage: node bing-webmaster.mjs <command> [args]\nCommands: submit-sitemap, list-sitemaps, submit-url, submit-url-batch, url-info, query');
  }

  const apiKey = process.env.ULTRASHIP_BING_KEY;
  if (!apiKey) {
    error('No Bing API key configured.\n\nSetup:\n1. Go to https://www.bing.com/webmasters\n2. Add and verify your site\n3. Go to Settings → API Access → API Key\n4. Set ULTRASHIP_BING_KEY=your-api-key');
  }

  const siteUrl = process.argv[3];

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
      try {
        await apiRequest('PUT', `SubmitUrl`, apiKey, {
          siteUrl,
          url: pageUrl,
        });
        output({ success: true, message: `URL ${pageUrl} submitted to Bing for indexing`, url: pageUrl, site: siteUrl });
      } catch (err) {
        error(`Failed to submit URL: ${err.message}`);
      }
      break;
    }

    case 'submit-url-batch': {
      const urls = process.argv.slice(4);
      if (!siteUrl || urls.length === 0) error('Usage: submit-url-batch <site-url> <url1> <url2> ...');
      try {
        await apiRequest('PUT', `SubmitUrlBatch`, apiKey, {
          siteUrl,
          urlList: urls,
        });
        output({ success: true, message: `${urls.length} URLs submitted to Bing for indexing`, urls, site: siteUrl });
      } catch (err) {
        error(`Failed to submit URL batch: ${err.message}`);
      }
      break;
    }

    case 'url-info': {
      const pageUrl = process.argv[4];
      if (!siteUrl || !pageUrl) error('Usage: url-info <site-url> <page-url>');
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

    default:
      error(`Unknown command: ${command}\nAvailable: submit-sitemap, list-sitemaps, submit-url, submit-url-batch, url-info, query`);
  }
}

main();
