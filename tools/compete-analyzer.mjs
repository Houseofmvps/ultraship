#!/usr/bin/env node
// tools/compete-analyzer.mjs
// Competitive X-Ray — compares your site vs a competitor on tech stack, performance, SEO, and security
// Usage: node tools/compete-analyzer.mjs <your-url> <competitor-url> [--full]
// Safe: HTTP GET requests only, no shell execution, all URLs validated

import https from 'https';
import http from 'http';
import { validateUrl, createResponseAccumulator } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// HTTP fetch with redirect following
// ---------------------------------------------------------------------------
function fetchUrl(url, timeoutMs = 10000, maxRedirects = 3) {
  return new Promise((resolve) => {
    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) {
      resolve({ success: false, url, error: urlCheck.reason });
      return;
    }
    const startTime = Date.now();
    const isHttps = url.startsWith('https://');
    const mod = isHttps ? https : http;

    const req = mod.request(url, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'Ultraship/1.0' } }, (res) => {
      const responseTime = Date.now() - startTime;

      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        let redir = res.headers.location;
        if (redir.startsWith('/')) { try { const u = new URL(url); redir = `${u.protocol}//${u.host}${redir}`; } catch {} }
        res.resume();
        resolve(fetchUrl(redir, timeoutMs, maxRedirects - 1));
        return;
      }

      const acc = createResponseAccumulator();
      res.on('data', (chunk) => acc.onData(chunk));
      res.on('end', () => {
        resolve({
          success: true, url, statusCode: res.statusCode, responseTime, headers: res.headers,
          body: acc.getBody(), contentLength: acc.getTotalSize(),
        });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ success: false, url, error: 'Timeout (10s)' }); });
    req.on('error', (err) => { resolve({ success: false, url, error: err.message }); });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tech stack detection
// ---------------------------------------------------------------------------
function detectTechStack(headers, body) {
  const stack = { server: null, framework: null, analytics: [], css: null, hosting: null, payment: null };

  // Server / hosting from headers
  stack.server = headers['server'] || null;
  if (headers['x-vercel-id']) stack.hosting = 'Vercel';
  else if (headers['x-nf-request-id']) stack.hosting = 'Netlify';
  else if (headers['cf-ray']) stack.hosting = 'Cloudflare';
  else if (headers['x-amz-request-id'] || headers['x-amz-cf-id']) stack.hosting = 'AWS';
  else if (headers['x-railway-request-id'] || (headers['server'] && /railway/i.test(headers['server']))) stack.hosting = 'Railway';
  else if (headers['x-powered-by'] && /heroku/i.test(headers['x-powered-by'])) stack.hosting = 'Heroku';
  if (headers['x-powered-by']) stack.server = (stack.server ? stack.server + ' / ' : '') + headers['x-powered-by'];

  // Framework from HTML
  if (/__NEXT_DATA__/.test(body)) stack.framework = 'Next.js';
  else if (/__NUXT__/.test(body) || /data-n-head/.test(body)) stack.framework = 'Nuxt';
  else if (/data-reactroot|__react/.test(body) || /_react/.test(body)) stack.framework = 'React';
  else if (/data-v-[a-f0-9]|__VUE__/.test(body)) stack.framework = 'Vue';
  else if (/svelte|__svelte/.test(body)) stack.framework = 'Svelte';
  else if (/ng-version|ng-app/.test(body)) stack.framework = 'Angular';
  else if (/data-astro/.test(body)) stack.framework = 'Astro';
  else if (/window\.__remixContext/.test(body)) stack.framework = 'Remix';

  // Analytics
  if (/gtag|google-analytics|GA-|G-\w/.test(body)) stack.analytics.push('Google Analytics');
  if (/plausible/i.test(body)) stack.analytics.push('Plausible');
  if (/posthog/i.test(body)) stack.analytics.push('PostHog');
  if (/mixpanel/i.test(body)) stack.analytics.push('Mixpanel');
  if (/segment\.com|analytics\.js/i.test(body)) stack.analytics.push('Segment');
  if (/amplitude/i.test(body)) stack.analytics.push('Amplitude');
  if (/hotjar/i.test(body)) stack.analytics.push('Hotjar');
  if (/clarity\.ms/i.test(body)) stack.analytics.push('Microsoft Clarity');

  // CSS framework
  if (/tailwind|tw-/.test(body) || /class="[^"]*\b(flex|grid|px-|py-|bg-|text-)\b/.test(body)) stack.css = 'Tailwind CSS';
  else if (/bootstrap/i.test(body) || /class="[^"]*\b(container|row|col-)\b/.test(body)) stack.css = 'Bootstrap';
  else if (/chakra/i.test(body)) stack.css = 'Chakra UI';

  // Payment
  if (/js\.stripe\.com|stripe/i.test(body)) stack.payment = 'Stripe';
  else if (/paddle/i.test(body)) stack.payment = 'Paddle';
  else if (/lemonsqueezy/i.test(body)) stack.payment = 'LemonSqueezy';

  return stack;
}

// ---------------------------------------------------------------------------
// SEO analysis from HTML
// ---------------------------------------------------------------------------
function analyzeSEO(body) {
  const seo = {
    title: null, title_length: 0, meta_description: false, meta_desc_length: 0,
    og_tags: { title: false, description: false, image: false },
    h1_count: 0, has_robots_txt: false, has_sitemap: false,
  };
  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) { seo.title = titleMatch[1].trim(); seo.title_length = seo.title.length; }

  const descMatch = body.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || body.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) { seo.meta_description = true; seo.meta_desc_length = descMatch[1].length; }

  if (/<meta[^>]*property=["']og:title["']/i.test(body)) seo.og_tags.title = true;
  if (/<meta[^>]*property=["']og:description["']/i.test(body)) seo.og_tags.description = true;
  if (/<meta[^>]*property=["']og:image["']/i.test(body)) seo.og_tags.image = true;

  const h1Matches = body.match(/<h1[\s>]/gi);
  seo.h1_count = h1Matches ? h1Matches.length : 0;

  return seo;
}

function scoreSEO(seo) {
  let score = 0;
  if (seo.title) score++;
  if (seo.title_length >= 30 && seo.title_length <= 60) score++;
  if (seo.meta_description) score++;
  if (seo.meta_desc_length >= 120 && seo.meta_desc_length <= 160) score++;
  if (seo.og_tags.title) score++;
  if (seo.og_tags.description) score++;
  if (seo.og_tags.image) score++;
  if (seo.h1_count === 1) score++;
  if (seo.has_robots_txt) score++;
  if (seo.has_sitemap) score++;
  return score;
}

// ---------------------------------------------------------------------------
// Security headers analysis
// ---------------------------------------------------------------------------
function analyzeSecurityHeaders(headers) {
  const checked = ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  const present = checked.filter(h => !!headers[h]);
  const missing = checked.filter(h => !headers[h]);
  return { present, missing, score: present.length };
}

// ---------------------------------------------------------------------------
// Comparison card (ASCII art)
// ---------------------------------------------------------------------------
function generateCard(yourSite, competitor, comparison) {
  const w = 56;
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const ctr = (s, n) => { const p = Math.max(0, n - s.length); const l = Math.floor(p / 2); return ' '.repeat(l) + s + ' '.repeat(p - l); };
  const win = (who) => who === 'you' ? ' ✓' : who === 'competitor' ? ' ✗' : ' =';

  const lines = [];
  lines.push('╔' + '═'.repeat(w) + '╗');
  lines.push('║' + ctr('ULTRASHIP COMPETITIVE X-RAY', w) + '║');
  lines.push('╠' + '═'.repeat(w) + '╣');
  lines.push('║' + ctr(`${yourSite.url}  vs  ${competitor.url}`, w) + '║');
  lines.push('╠' + '═'.repeat(w / 2) + '╤' + '═'.repeat(w - Math.floor(w / 2)) + '╣');
  lines.push('║' + pad(' CATEGORY', w / 2) + '│' + pad(' RESULT', w - Math.floor(w / 2)) + '║');
  lines.push('╟' + '─'.repeat(w / 2) + '┼' + '─'.repeat(w - Math.floor(w / 2)) + '╢');

  lines.push('║' + pad(` Speed${win(comparison.faster)}`, w / 2) + '│' + pad(` ${comparison.speed_detail}`, w - Math.floor(w / 2)) + '║');
  lines.push('║' + pad(` SEO${win(comparison.better_seo)}`, w / 2) + '│' + pad(` You: ${comparison.seo_score_you}/10  Them: ${comparison.seo_score_competitor}/10`, w - Math.floor(w / 2)) + '║');
  lines.push('║' + pad(` Security${win(comparison.better_security)}`, w / 2) + '│' + pad(` You: ${comparison.security_score_you}/6  Them: ${comparison.security_score_competitor}/6`, w - Math.floor(w / 2)) + '║');
  lines.push('║' + pad(` HTTPS`, w / 2) + '│' + pad(` You: ${yourSite.https ? 'Yes' : 'No'}  Them: ${competitor.https ? 'Yes' : 'No'}`, w - Math.floor(w / 2)) + '║');

  lines.push('╠' + '═'.repeat(w) + '╣');
  lines.push('║' + ctr(comparison.verdict, w) + '║');
  lines.push('╚' + '═'.repeat(w) + '╝');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter(a => !a.startsWith('--'));

  if (positional.length < 2) {
    output({ error: 'Usage: node compete-analyzer.mjs <your-url> <competitor-url> [--full]', success: false });
    process.exit(0);
  }

  let yourUrl = positional[0];
  let competitorUrl = positional[1];

  // Ensure protocol
  if (!/^https?:\/\//i.test(yourUrl)) yourUrl = 'https://' + yourUrl;
  if (!/^https?:\/\//i.test(competitorUrl)) competitorUrl = 'https://' + competitorUrl;

  // Fetch main pages + robots.txt + sitemap.xml for both (8 requests in parallel)
  const yourBase = new URL(yourUrl);
  const compBase = new URL(competitorUrl);

  const [yourPage, compPage, yourRobots, compRobots, yourSitemap, compSitemap] = await Promise.all([
    fetchUrl(yourUrl),
    fetchUrl(competitorUrl),
    fetchUrl(`${yourBase.protocol}//${yourBase.host}/robots.txt`),
    fetchUrl(`${compBase.protocol}//${compBase.host}/robots.txt`),
    fetchUrl(`${yourBase.protocol}//${yourBase.host}/sitemap.xml`),
    fetchUrl(`${compBase.protocol}//${compBase.host}/sitemap.xml`),
  ]);

  // Analyze your site
  const yourTech = yourPage.success ? detectTechStack(yourPage.headers, yourPage.body) : { server: null, framework: null, analytics: [], css: null, hosting: null, payment: null };
  const yourSEO = yourPage.success ? analyzeSEO(yourPage.body) : { title: null, title_length: 0, meta_description: false, meta_desc_length: 0, og_tags: { title: false, description: false, image: false }, h1_count: 0, has_robots_txt: false, has_sitemap: false };
  yourSEO.has_robots_txt = yourRobots.success && yourRobots.statusCode === 200 && yourRobots.body.length > 10;
  yourSEO.has_sitemap = yourSitemap.success && yourSitemap.statusCode === 200 && /urlset|sitemapindex/i.test(yourSitemap.body);
  const yourSecurity = yourPage.success ? analyzeSecurityHeaders(yourPage.headers) : { present: [], missing: [], score: 0 };

  // Analyze competitor
  const compTech = compPage.success ? detectTechStack(compPage.headers, compPage.body) : { server: null, framework: null, analytics: [], css: null, hosting: null, payment: null };
  const compSEO = compPage.success ? analyzeSEO(compPage.body) : { title: null, title_length: 0, meta_description: false, meta_desc_length: 0, og_tags: { title: false, description: false, image: false }, h1_count: 0, has_robots_txt: false, has_sitemap: false };
  compSEO.has_robots_txt = compRobots.success && compRobots.statusCode === 200 && compRobots.body.length > 10;
  compSEO.has_sitemap = compSitemap.success && compSitemap.statusCode === 200 && /urlset|sitemapindex/i.test(compSitemap.body);
  const compSecurity = compPage.success ? analyzeSecurityHeaders(compPage.headers) : { present: [], missing: [], score: 0 };

  // Score SEO
  const yourSEOScore = scoreSEO(yourSEO);
  const compSEOScore = scoreSEO(compSEO);

  // Build comparison
  const yourTime = yourPage.success ? yourPage.responseTime : 99999;
  const compTime = compPage.success ? compPage.responseTime : 99999;
  const faster = yourTime < compTime ? 'you' : compTime < yourTime ? 'competitor' : 'tie';
  const betterSEO = yourSEOScore > compSEOScore ? 'you' : compSEOScore > yourSEOScore ? 'competitor' : 'tie';
  const betterSecurity = yourSecurity.score > compSecurity.score ? 'you' : compSecurity.score > yourSecurity.score ? 'competitor' : 'tie';

  // Advantages
  const yourAdvantages = [];
  const compAdvantages = [];
  if (faster === 'you') yourAdvantages.push(`Faster response (${yourTime}ms vs ${compTime}ms)`);
  else if (faster === 'competitor') compAdvantages.push(`Faster response (${compTime}ms vs ${yourTime}ms)`);
  if (betterSEO === 'you') yourAdvantages.push(`Better SEO score (${yourSEOScore}/10 vs ${compSEOScore}/10)`);
  else if (betterSEO === 'competitor') compAdvantages.push(`Better SEO score (${compSEOScore}/10 vs ${yourSEOScore}/10)`);
  if (betterSecurity === 'you') yourAdvantages.push(`More security headers (${yourSecurity.score}/6 vs ${compSecurity.score}/6)`);
  else if (betterSecurity === 'competitor') compAdvantages.push(`More security headers (${compSecurity.score}/6 vs ${yourSecurity.score}/6)`);

  // Detailed advantages
  if (yourSEO.has_sitemap && !compSEO.has_sitemap) yourAdvantages.push('Has sitemap.xml');
  if (!yourSEO.has_sitemap && compSEO.has_sitemap) compAdvantages.push('Has sitemap.xml');
  if (yourSEO.has_robots_txt && !compSEO.has_robots_txt) yourAdvantages.push('Has robots.txt');
  if (!yourSEO.has_robots_txt && compSEO.has_robots_txt) compAdvantages.push('Has robots.txt');
  if (yourSEO.og_tags.image && !compSEO.og_tags.image) yourAdvantages.push('Has OG image');
  if (!yourSEO.og_tags.image && compSEO.og_tags.image) compAdvantages.push('Has OG image');
  if (yourSEO.meta_description && !compSEO.meta_description) yourAdvantages.push('Has meta description');
  if (!yourSEO.meta_description && compSEO.meta_description) compAdvantages.push('Has meta description');
  if (yourUrl.startsWith('https://') && !competitorUrl.startsWith('https://')) yourAdvantages.push('Using HTTPS');
  if (!yourUrl.startsWith('https://') && competitorUrl.startsWith('https://')) compAdvantages.push('Using HTTPS');

  // Tech overlap
  const yourTechSet = [yourTech.framework, yourTech.css, yourTech.hosting, yourTech.payment, ...yourTech.analytics].filter(Boolean);
  const compTechSet = [compTech.framework, compTech.css, compTech.hosting, compTech.payment, ...compTech.analytics].filter(Boolean);
  const techOverlap = yourTechSet.filter(t => compTechSet.includes(t));

  // Verdict
  let wins = 0;
  if (yourPage.success && compPage.success) {
    if (faster === 'you') wins++; else if (faster === 'competitor') wins--;
    if (betterSEO === 'you') wins++; else if (betterSEO === 'competitor') wins--;
    if (betterSecurity === 'you') wins++; else if (betterSecurity === 'competitor') wins--;
  }
  const verdict = wins > 0 ? `You lead on ${yourAdvantages.length} areas` : wins < 0 ? `Competitor leads on ${compAdvantages.length} areas` : 'Even match — differentiate on product';

  const comparison = {
    faster, speed_diff_ms: Math.abs(yourTime - compTime),
    speed_detail: `${yourTime}ms vs ${compTime}ms`,
    better_seo: betterSEO, seo_score_you: yourSEOScore, seo_score_competitor: compSEOScore,
    better_security: betterSecurity, security_score_you: yourSecurity.score, security_score_competitor: compSecurity.score,
    tech_overlap: techOverlap,
    your_advantages: yourAdvantages, competitor_advantages: compAdvantages,
    verdict,
  };

  const card = generateCard(
    { url: yourBase.host, https: yourUrl.startsWith('https://') },
    { url: compBase.host, https: competitorUrl.startsWith('https://') },
    comparison
  );

  output({
    success: true,
    your_site: {
      url: yourUrl,
      response_time_ms: yourPage.success ? yourPage.responseTime : null,
      status_code: yourPage.success ? yourPage.statusCode : null,
      tech_stack: yourTech,
      seo: yourSEO,
      security: { https: yourUrl.startsWith('https://'), headers_present: yourSecurity.score, headers_missing: yourSecurity.missing },
      content_length: yourPage.success ? yourPage.contentLength : null,
    },
    competitor: {
      url: competitorUrl,
      response_time_ms: compPage.success ? compPage.responseTime : null,
      status_code: compPage.success ? compPage.statusCode : null,
      tech_stack: compTech,
      seo: compSEO,
      security: { https: competitorUrl.startsWith('https://'), headers_present: compSecurity.score, headers_missing: compSecurity.missing },
      content_length: compPage.success ? compPage.contentLength : null,
    },
    comparison,
    comparison_card: card,
  });
}

main();
