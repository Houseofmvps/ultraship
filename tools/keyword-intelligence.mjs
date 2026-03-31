#!/usr/bin/env node
// tools/keyword-intelligence.mjs
// Keyword Intelligence Engine — analyzes GSC + Bing keyword data
// Usage: node tools/keyword-intelligence.mjs <command> <site-url> [options]
// Commands:
//   analyze <site-url> [days]                 — Full keyword analysis (clusters, intent, quick wins)
//   quick-wins <site-url> [days]              — Keywords at position 4-20 (striking distance)
//   cannibalization <site-url> [days]          — Pages competing for same keywords
//   content-gaps <site-url> [days]             — High-impression, low-click keywords (content opportunities)
//   intent-map <site-url> [days]               — Map keywords by search intent
//   trending <site-url> [days]                 — Keywords gaining/losing impressions
//   high-intent <site-url> [days]              — Filter for commercial/transactional intent keywords
//   page-keywords <site-url> [days]            — Keywords grouped by page (topic clusters)
//   content-decay <site-url> [days]            — Pages losing traffic (content freshness issues)
//   difficulty <site-url> [days]               — Keyword difficulty + SERP feature impact analysis
//   anomalies <site-url> [days]               — Low position high CTR + high position low CTR anomalies
//   cross-reference <site-url> [days] --ga4=ID — Join GSC pages with GA4 conversions (the money move)
//
// Options:
//   --brand=term1,term2                        — Filter brand keywords (analysis runs on non-brand only)
//   --ga4=PROPERTY_ID                          — GA4 property for cross-reference command
//
// Auth: Uses GSC credentials (ULTRASHIP_GSC_CREDENTIALS or ULTRASHIP_GSC_ACCESS_TOKEN)
//       Optionally uses Bing (ULTRASHIP_BING_KEY) for cross-engine analysis

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { validateUrl } from './lib/security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function error(message) {
  output({ error: message, success: false });
  process.exit(0);
}

// Run GSC query with specific dimensions
function runGscQuery(siteUrl, days) {
  const gscPath = path.join(__dirname, 'gsc-client.mjs');
  // We need to call GSC API directly since gsc-client only supports 'query' dimension
  // Re-use the auth pattern from gsc-client
  try {
    const result = execFileSync('node', [gscPath, 'query', siteUrl, String(days)], {
      encoding: 'utf8',
      timeout: 30000,
      env: process.env,
    });
    return JSON.parse(result);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Run GA4 query via ga4-client tool
function runGa4Query(command, propertyId, days, extraArgs = []) {
  const ga4Path = path.join(__dirname, 'ga4-client.mjs');
  try {
    const args = [ga4Path, command, propertyId, String(days), ...extraArgs];
    const result = execFileSync('node', args, {
      encoding: 'utf8',
      timeout: 30000,
      env: process.env,
    });
    return JSON.parse(result);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Get GSC access token from service account
async function getGscToken() {
  let token = process.env.ULTRASHIP_GSC_ACCESS_TOKEN;
  if (token) return token;

  const keyPath = process.env.ULTRASHIP_GSC_CREDENTIALS;
  if (!keyPath) return null;

  let key;
  try {
    key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  } catch {
    return null;
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

// Extended GSC query with page + query dimensions (direct API call)
async function queryGscExtended(siteUrl, days, dims = ['query', 'page'], rowLimit = 1000) {
  const token = await getGscToken();
  if (!token) {
    return { success: false, error: 'No GSC credentials. Set ULTRASHIP_GSC_CREDENTIALS or ULTRASHIP_GSC_ACCESS_TOKEN.' };
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const fmt = d => d.toISOString().split('T')[0];

  const requestBody = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: dims,
    rowLimit,
  };

  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(requestBody);
    const req = https.request({
      hostname: 'searchconsole.googleapis.com',
      path: `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const rows = (parsed.rows || []).map(r => ({
              query: r.keys[0],
              page: dims.includes('page') ? r.keys[dims.indexOf('page')] : undefined,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: Math.round(r.ctr * 10000) / 100,
              position: Math.round(r.position * 10) / 10,
            }));
            resolve({ success: true, rows, period: `${fmt(startDate)} to ${fmt(endDate)}` });
          } catch { resolve({ success: false, error: 'Failed to parse response' }); }
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(bodyStr);
    req.end();
  });
}

// Extended GSC query with custom date range (for trend comparison)
async function queryGscExtendedRange(siteUrl, daysAgo, daysUntil, dims = ['query'], rowLimit = 500) {
  const token = await getGscToken();
  if (!token) {
    return { success: false, error: 'No GSC credentials.' };
  }
  const endDate = new Date(Date.now() - daysUntil * 86400000);
  const startDate = new Date(Date.now() - daysAgo * 86400000);
  const fmt = d => d.toISOString().split('T')[0];

  const requestBody = { startDate: fmt(startDate), endDate: fmt(endDate), dimensions: dims, rowLimit };

  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(requestBody);
    const req = https.request({
      hostname: 'searchconsole.googleapis.com',
      path: `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const rows = (parsed.rows || []).map(r => ({
              query: r.keys[0],
              clicks: r.clicks, impressions: r.impressions,
              ctr: Math.round(r.ctr * 10000) / 100,
              position: Math.round(r.position * 10) / 10,
            }));
            resolve({ success: true, rows, period: `${fmt(startDate)} to ${fmt(endDate)}` });
          } catch { resolve({ success: false, error: 'Failed to parse response' }); }
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(bodyStr);
    req.end();
  });
}

// Classify search intent
function classifyIntent(query) {
  const q = query.toLowerCase();

  // 1. Informational FIRST — question patterns override everything
  // "how to buy X" is informational, "what does pricing mean" is informational
  if (/^(how|what|why|when|where|who|is|are|can|do|does|should|will|which)\b/.test(q)) {
    // Exception: "which is best/better" or question + comparison = commercial
    if (/\b(best|better|top|vs|versus|compare|worth|alternative|alternatives|pros|cons)\b/.test(q)) return 'commercial';
    return 'informational';
  }

  // 2. Transactional intent (ready to buy/act)
  const transactional = /\b(buy|purchase|order|subscribe|sign up|signup|register|download|install|get started|pricing|price|cost|deal|discount|coupon|free trial|free plan|free tier|trial|demo|quote|cheap|affordable|budget|upgrade|checkout|promo)\b/;
  if (transactional.test(q)) return 'transactional';

  // 3. Commercial investigation (comparing options)
  const commercial = /\b(best|top|review|compare|comparison|vs|versus|alternative|alternatives|recommended|rating|rated|worth|pros|cons|better|cheapest)\b/;
  if (commercial.test(q)) return 'commercial';

  // 4. Navigational (looking for specific site/brand — narrow patterns only)
  // Removed: "app", "website", "site", "account", "dashboard" — too many false positives
  const navigational = /\b(login|log in|signin|sign in|official site|official website|my account|my dashboard)\b/;
  if (navigational.test(q)) return 'navigational';

  // 5. Informational (learning/researching)
  const informational = /\b(guide|tutorial|learn|example|examples|explain|definition|meaning|tips|ideas|beginner|introduction|intro|step by step|difference between)\b/;
  if (informational.test(q)) return 'informational';

  return 'informational'; // default
}

// Cluster keywords by 2-gram semantic similarity (how real SEO experts do it)
function clusterKeywords(rows) {
  const stopwords = new Set(['the', 'and', 'for', 'with', 'how', 'what', 'why', 'when', 'where', 'who', 'is', 'are', 'can', 'do', 'does', 'this', 'that', 'from', 'your', 'you', 'not', 'has', 'have', 'was', 'were', 'been', 'will', 'would', 'could', 'should', 'best', 'top', 'free', 'cheap', 'online', 'review', 'good', 'new']);

  // Step 1: Extract 2-grams from each query for semantic matching
  function getSignificantNgrams(query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const ngrams = [];
    // 2-grams from ORIGINAL word order (not stopword-filtered) to preserve adjacency
    // e.g., "best saas tools for churn" → "saas tools", "tools churn" is wrong; "best saas", "saas tools" is correct
    for (let i = 0; i < words.length - 1; i++) {
      // Skip 2-grams where BOTH words are stopwords
      if (stopwords.has(words[i]) && stopwords.has(words[i + 1])) continue;
      // Skip 2-grams where either word is a stopword (only keep significant pairs)
      if (stopwords.has(words[i]) || stopwords.has(words[i + 1])) continue;
      ngrams.push(`${words[i]} ${words[i + 1]}`);
    }
    // Also add single significant words as fallback
    const significant = words.filter(w => !stopwords.has(w));
    for (const w of significant) ngrams.push(w);
    return ngrams;
  }

  // Step 2: Count ngram frequency across all queries to find dominant topics
  const ngramFreq = {};
  for (const row of rows) {
    const ngrams = getSignificantNgrams(row.query);
    const seen = new Set();
    for (const ng of ngrams) {
      if (!seen.has(ng)) {
        ngramFreq[ng] = (ngramFreq[ng] || 0) + 1;
        seen.add(ng);
      }
    }
  }

  // Step 3: Rank ngrams — prefer 2-grams with high frequency (these are your topic clusters)
  const rankedNgrams = Object.entries(ngramFreq)
    .filter(([ng, count]) => count >= 2) // Must appear in 2+ queries
    .sort((a, b) => {
      // Prefer 2-grams over 1-grams, then by frequency
      const aWords = a[0].split(' ').length;
      const bWords = b[0].split(' ').length;
      if (aWords !== bWords) return bWords - aWords;
      return b[1] - a[1];
    });

  // Step 4: Assign each keyword to its best matching cluster
  const clusters = {};
  const assigned = new Set();

  for (const [topic] of rankedNgrams) {
    const matching = rows.filter((row, idx) => {
      if (assigned.has(idx)) return false;
      return row.query.toLowerCase().includes(topic);
    });
    if (matching.length >= 2) {
      clusters[topic] = { topic, keywords: matching, total_clicks: 0, total_impressions: 0 };
      for (const m of matching) {
        const idx = rows.indexOf(m);
        assigned.add(idx);
        clusters[topic].total_clicks += m.clicks;
        clusters[topic].total_impressions += m.impressions;
      }
    }
  }

  // Step 5: Assign unmatched keywords by first significant word
  for (let i = 0; i < rows.length; i++) {
    if (assigned.has(i)) continue;
    const row = rows[i];
    const words = row.query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
    const key = words[0] || 'other';
    if (!clusters[key]) {
      clusters[key] = { topic: key, keywords: [], total_clicks: 0, total_impressions: 0 };
    }
    clusters[key].keywords.push(row);
    clusters[key].total_clicks += row.clicks;
    clusters[key].total_impressions += row.impressions;
  }

  // Step 6: Calculate metrics and score topical authority
  for (const cluster of Object.values(clusters)) {
    const positions = cluster.keywords.map(k => k.position);
    cluster.avg_position = Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10;
    cluster.keyword_count = cluster.keywords.length;
    // Topical authority score: more keywords + better avg position = stronger authority
    // Position weight is primary (70%) — ranking deep pages with many keywords isn't authority
    const positionScore = Math.max(0, 100 - (cluster.avg_position * 4));
    const depthScore = Math.min(100, cluster.keyword_count * 8);
    cluster.topical_authority = Math.round((positionScore * 0.7 + depthScore * 0.3));
    cluster.authority_level = cluster.topical_authority >= 70 ? 'strong' : cluster.topical_authority >= 40 ? 'emerging' : 'weak';
    // Dominant intent for the cluster
    const intents = cluster.keywords.map(k => classifyIntent(k.query));
    const intentCounts = {};
    for (const i of intents) intentCounts[i] = (intentCounts[i] || 0) + 1;
    cluster.dominant_intent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0][0];
    // Keep top 5 keywords
    cluster.top_keywords = cluster.keywords
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map(k => ({ query: k.query, clicks: k.clicks, impressions: k.impressions, position: k.position, intent: classifyIntent(k.query) }));
    delete cluster.keywords;
  }

  return Object.values(clusters).sort((a, b) => b.total_impressions - a.total_impressions);
}

// Estimate keyword difficulty based on position distribution and CTR
function estimateKeywordDifficulty(row) {
  // Expected CTR by position (Google organic click curves from industry data)
  const expectedCtr = [0, 31.7, 24.7, 18.6, 13.6, 9.5, 6.2, 4.2, 3.1, 2.4, 1.9];
  const roundedPos = Math.round(row.position);
  // For positions 11+, estimate CTR decay: ~1.9% at 10, dropping ~0.15% per position
  const expected = roundedPos >= 1 && roundedPos <= 10
    ? expectedCtr[roundedPos]
    : Math.max(0.1, 1.9 - (roundedPos - 10) * 0.15);
  const actualCtr = row.ctr;

  // If actual CTR is much lower than expected for position → SERP features stealing clicks
  // Only meaningful for positions 1-20 (beyond that, CTR is too low for reliable comparison)
  const serpFeatureImpact = expected > 0 && roundedPos <= 20
    ? Math.max(0, Math.round(((expected - actualCtr) / expected) * 100))
    : 0;

  // Difficulty estimation based on current position
  let difficulty;
  if (row.position <= 3) difficulty = 'easy-to-defend';
  else if (row.position <= 5) difficulty = 'low';
  else if (row.position <= 10) difficulty = 'medium';
  else if (row.position <= 20) difficulty = 'high';
  else difficulty = 'very-high';

  // Potential monthly clicks if you reach position 1
  const potentialClicks = Math.round(row.impressions * (expectedCtr[1] / 100));

  return {
    difficulty,
    serp_feature_impact_pct: serpFeatureImpact,
    potential_clicks_at_pos1: potentialClicks,
    current_ctr: row.ctr,
    expected_ctr_for_position: expected,
    ctr_gap: Math.round((expected - actualCtr) * 100) / 100,
  };
}

// Detect content decay — pages losing traffic over time
function detectContentDecay(recentRows, olderRows) {
  const recentByPage = {};
  for (const r of recentRows) {
    if (!r.page) continue;
    if (!recentByPage[r.page]) recentByPage[r.page] = { clicks: 0, impressions: 0, keywords: 0 };
    recentByPage[r.page].clicks += r.clicks;
    recentByPage[r.page].impressions += r.impressions;
    recentByPage[r.page].keywords++;
  }

  const olderByPage = {};
  for (const r of olderRows) {
    if (!r.page) continue;
    if (!olderByPage[r.page]) olderByPage[r.page] = { clicks: 0, impressions: 0, keywords: 0 };
    olderByPage[r.page].clicks += r.clicks;
    olderByPage[r.page].impressions += r.impressions;
    olderByPage[r.page].keywords++;
  }

  const decaying = [];
  for (const [page, older] of Object.entries(olderByPage)) {
    const recent = recentByPage[page] || { clicks: 0, impressions: 0 };
    if (older.clicks > 15) { // Only flag pages that had meaningful traffic (15+ clicks avoids noise from low-volume pages)
      const clickChange = older.clicks > 0 ? ((recent.clicks - older.clicks) / older.clicks) * 100 : 0;
      const impChange = older.impressions > 0 ? ((recent.impressions - older.impressions) / older.impressions) * 100 : 0;
      if (clickChange < -20) { // More than 20% traffic loss
        decaying.push({
          page,
          older_clicks: older.clicks,
          recent_clicks: recent.clicks,
          click_change_pct: Math.round(clickChange),
          impression_change_pct: Math.round(impChange),
          severity: clickChange < -50 ? 'critical' : clickChange < -30 ? 'high' : 'medium',
          action: impChange < -20
            ? 'Content is losing visibility. Refresh with updated data, add new sections, improve depth.'
            : impChange > 20
            ? 'Impressions GROWING but clicks dropping — CTR problem. Rewrite title tag and meta description. Check if SERP features are stealing clicks.'
            : 'Impressions stable but clicks dropping. Rewrite title tag and meta description for better CTR.',
        });
      }
    }
  }

  return decaying.sort((a, b) => a.click_change_pct - b.click_change_pct);
}

async function main() {
  const command = process.argv[2];
  const siteUrl = process.argv[3];
  const days = parseInt(process.argv[4] || '28', 10);

  if (!command) {
    error('Usage: node keyword-intelligence.mjs <command> <site-url> [days] [--brand=term1,term2]\nCommands: analyze, quick-wins, cannibalization, content-gaps, intent-map, trending, high-intent, page-keywords, content-decay, difficulty, anomalies, cross-reference');
  }

  if (!siteUrl) {
    error('Site URL required. Example: node keyword-intelligence.mjs analyze https://example.com 28');
  }

  const siteCheck = validateUrl(siteUrl);
  if (!siteCheck.valid) error(`Invalid site URL: ${siteCheck.reason}`);

  // Fetch GSC data
  const gscData = await queryGscExtended(siteUrl, days, ['query', 'page'], 1000);
  if (!gscData.success) {
    // Fallback to basic GSC query
    const basic = runGscQuery(siteUrl, days);
    if (!basic.success) {
      error(`Failed to fetch keyword data: ${gscData.error || basic.error}`);
    }
    // Use basic data (no page dimension available)
    gscData.rows = (basic.top_queries || []).map(q => ({ ...q, page: undefined }));
    gscData.period = basic.period;
    gscData.success = true;
    gscData.fallback = true;
  }

  const allRows = gscData.rows || [];
  if (allRows.length === 0) {
    error('No keyword data found. Site may be too new or have no search impressions yet.');
  }

  // Brand filtering: --brand=term1,term2 splits queries into brand vs non-brand
  const brandArg = process.argv.find(a => a.startsWith('--brand='));
  const brandTerms = brandArg ? brandArg.replace('--brand=', '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  const isBrandQuery = (q) => brandTerms.length > 0 && brandTerms.some(t => q.toLowerCase().includes(t));

  // Default: analyze non-brand only (where real SEO value is). Include brand summary.
  const rows = brandTerms.length > 0 ? allRows.filter(r => !isBrandQuery(r.query)) : allRows;
  const brandRows = brandTerms.length > 0 ? allRows.filter(r => isBrandQuery(r.query)) : [];
  const brandSummary = brandTerms.length > 0 ? {
    brand_terms: brandTerms,
    brand_keywords: brandRows.length,
    brand_clicks: brandRows.reduce((s, r) => s + r.clicks, 0),
    brand_impressions: brandRows.reduce((s, r) => s + r.impressions, 0),
    non_brand_keywords: rows.length,
    non_brand_clicks: rows.reduce((s, r) => s + r.clicks, 0),
    non_brand_impressions: rows.reduce((s, r) => s + r.impressions, 0),
    non_brand_pct: allRows.length > 0 ? Math.round((rows.length / allRows.length) * 100) : 0,
  } : undefined;

  // Warn for commands that need page data when using fallback
  if (gscData.fallback && (command === 'cannibalization' || command === 'page-keywords' || command === 'content-decay')) {
    output({
      success: false,
      error: `The "${command}" command requires page-level data from GSC extended query, which failed. Configure ULTRASHIP_GSC_CREDENTIALS with a service account key for full access.`,
    });
    process.exit(0);
  }

  switch (command) {
    case 'analyze': {
      // Full analysis: clusters, intent breakdown, quick wins, gaps
      const intentBreakdown = { transactional: 0, commercial: 0, informational: 0, navigational: 0 };
      const intentKeywords = { transactional: [], commercial: [], informational: [], navigational: [] };

      for (const row of rows) {
        const intent = classifyIntent(row.query);
        intentBreakdown[intent]++;
        intentKeywords[intent].push(row);
      }

      const quickWins = rows
        .filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= 5)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20);

      const contentGaps = rows
        .filter(r => r.impressions >= 20 && r.ctr < 3)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15);

      const topPerformers = rows
        .filter(r => r.position <= 3 && r.clicks > 0)
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      const clusters = clusterKeywords(rows);

      const highIntent = rows
        .filter(r => ['transactional', 'commercial'].includes(classifyIntent(r.query)))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15);

      // Difficulty analysis on top keywords
      const difficultyBreakdown = { 'easy-to-defend': 0, low: 0, medium: 0, high: 0, 'very-high': 0 };
      const topWithDifficulty = rows
        .filter(r => r.impressions >= 5)
        .map(r => {
          const diff = estimateKeywordDifficulty(r);
          difficultyBreakdown[diff.difficulty]++;
          return { ...r, ...diff, intent: classifyIntent(r.query) };
        });

      // SERP feature impact (keywords where features steal clicks)
      const serpImpacted = topWithDifficulty
        .filter(k => k.serp_feature_impact_pct > 30)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

      // Revenue potential estimate
      const revenuePotential = highIntent.reduce((sum, r) => {
        const diff = estimateKeywordDifficulty(r);
        return sum + diff.potential_clicks_at_pos1;
      }, 0);

      // Topical authority summary
      const strongTopics = clusters.filter(c => c.authority_level === 'strong');
      const weakTopics = clusters.filter(c => c.authority_level === 'weak');

      const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
      const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

      // Position band distribution (the KPIs an elite operator watches weekly)
      const top3 = rows.filter(r => r.position <= 3).length;
      const pos4to10 = rows.filter(r => r.position > 3 && r.position <= 10).length;
      const pos11to20 = rows.filter(r => r.position > 10 && r.position <= 20).length;
      const pos21plus = rows.filter(r => r.position > 20).length;
      const total = rows.length;
      const positionBands = {
        'positions_1_3': { count: top3, pct: Math.round((top3 / total) * 100) },
        'positions_4_10': { count: pos4to10, pct: Math.round((pos4to10 / total) * 100) },
        'positions_11_20': { count: pos11to20, pct: Math.round((pos11to20 / total) * 100) },
        'positions_21_plus': { count: pos21plus, pct: Math.round((pos21plus / total) * 100) },
      };

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        total_keywords: rows.length,
        brand_filter: brandSummary,
        summary: {
          total_clicks: totalClicks,
          total_impressions: totalImpressions,
          avg_position: Math.round((rows.reduce((s, r) => s + r.position, 0) / rows.length) * 10) / 10,
          avg_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
          keywords_in_top_3: top3,
          keywords_in_top_10: top3 + pos4to10,
          revenue_keywords: highIntent.length,
          estimated_monthly_traffic_potential: revenuePotential,
        },
        position_bands: positionBands,
        difficulty_breakdown: difficultyBreakdown,
        topical_authority: {
          strong_topics: strongTopics.length,
          weak_topics: weakTopics.length,
          strongest: strongTopics.slice(0, 5).map(c => ({ topic: c.topic, authority: c.topical_authority, keywords: c.keyword_count })),
          weakest_needing_content: weakTopics.slice(0, 5).map(c => ({ topic: c.topic, authority: c.topical_authority, keywords: c.keyword_count })),
        },
        serp_features_stealing_clicks: serpImpacted.slice(0, 10).map(k => ({
          query: k.query, position: k.position, expected_ctr: k.expected_ctr_for_position, actual_ctr: k.ctr, stolen_pct: k.serp_feature_impact_pct,
        })),
        intent_breakdown: intentBreakdown,
        topic_clusters: clusters.slice(0, 15),
        quick_wins: quickWins,
        content_gaps: contentGaps,
        top_performers: topPerformers,
        high_intent_keywords: highIntent,
        strategic_insights: generateInsights(rows, quickWins, contentGaps, intentBreakdown, topPerformers),
      });
      break;
    }

    case 'quick-wins': {
      const wins = rows
        .filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= 5)
        .sort((a, b) => {
          // Score: higher impressions + closer to page 1 = higher priority
          const scoreA = a.impressions * (1 / a.position);
          const scoreB = b.impressions * (1 / b.position);
          return scoreB - scoreA;
        })
        .slice(0, 30)
        .map(r => ({
          ...r,
          intent: classifyIntent(r.query),
          effort: r.position <= 10 ? 'low' : r.position <= 15 ? 'medium' : 'high',
          potential_clicks: Math.round(r.impressions * 0.15), // est. CTR at position 3
        }));

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        quick_wins: wins,
        insight: `${wins.length} keywords at striking distance (positions 4-20). Focus on low-effort wins first — these could reach page 1 with content optimization and internal linking.`,
      });
      break;
    }

    case 'cannibalization': {
      // Find queries where multiple pages compete
      const queryPages = {};
      for (const row of rows) {
        if (!row.page) continue;
        if (!queryPages[row.query]) queryPages[row.query] = [];
        queryPages[row.query].push({ page: row.page, clicks: row.clicks, impressions: row.impressions, position: row.position });
      }

      const cannibalized = Object.entries(queryPages)
        .filter(([, pages]) => pages.length > 1)
        .map(([query, pages]) => ({
          query,
          pages: pages.sort((a, b) => a.position - b.position),
          severity: pages.length >= 3 ? 'high' : 'medium',
          recommendation: `Consolidate content into ${pages[0].page} (best position: ${pages[0].position}) and redirect/canonical the others.`,
        }))
        .sort((a, b) => b.pages.length - a.pages.length)
        .slice(0, 20);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        total_cannibalized: cannibalized.length,
        cannibalized_keywords: cannibalized,
        insight: cannibalized.length > 0
          ? `${cannibalized.length} keywords have multiple pages competing. This dilutes ranking power. Consolidate content and use canonical tags.`
          : 'No keyword cannibalization detected. Good — each keyword maps to a single page.',
      });
      break;
    }

    case 'content-gaps': {
      const gaps = rows
        .filter(r => r.impressions >= 20 && r.ctr < 3)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 30)
        .map(r => ({
          ...r,
          intent: classifyIntent(r.query),
          gap_type: r.position > 20 ? 'no_ranking_content' : r.position > 10 ? 'weak_content' : 'poor_snippet',
          action: r.position > 20
            ? 'Create new dedicated page for this keyword'
            : r.position > 10
            ? 'Expand and optimize existing content'
            : 'Improve title tag and meta description for better CTR',
        }));

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        content_gaps: gaps,
        insight: `${gaps.length} keywords have high impressions but low CTR. These represent content opportunities — users see your site but don't click.`,
      });
      break;
    }

    case 'intent-map': {
      const intentMap = { transactional: [], commercial: [], informational: [], navigational: [] };
      for (const row of rows) {
        const intent = classifyIntent(row.query);
        intentMap[intent].push({ query: row.query, clicks: row.clicks, impressions: row.impressions, position: row.position, page: row.page });
      }

      // Capture true counts before slicing
      const counts = {};
      for (const [intent, kws] of Object.entries(intentMap)) {
        counts[intent] = kws.length;
      }

      // Sort each intent by impressions and limit to top 20
      for (const intent of Object.keys(intentMap)) {
        intentMap[intent] = intentMap[intent]
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 20);
      }

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        intent_distribution: counts,
        intent_keywords: intentMap,
        strategy: {
          transactional: 'Create landing pages with clear CTAs, pricing, and conversion elements. These users are ready to act.',
          commercial: 'Create comparison pages, reviews, and "best of" lists. These users are evaluating options.',
          informational: 'Create guides, tutorials, and educational content. Build authority and capture top-of-funnel traffic.',
          navigational: 'Ensure your brand pages rank #1. Fix any branded keyword cannibalization.',
        },
      });
      break;
    }

    case 'trending': {
      // Compare two non-overlapping periods to find trending keywords
      const halfDays = Math.floor(days / 2);
      const recentData = await queryGscExtended(siteUrl, halfDays, ['query'], 500);
      // Older period: from halfDays ago to days ago (non-overlapping)
      const olderData = await queryGscExtendedRange(siteUrl, days, halfDays, ['query'], 500);

      if (!recentData.success || !olderData.success) {
        error('Cannot fetch comparison data for trend analysis.');
      }

      const recentMap = {};
      for (const r of recentData.rows) recentMap[r.query] = r;
      const olderMap = {};
      for (const r of olderData.rows) olderMap[r.query] = r;

      const trending = [];
      for (const [query, recent] of Object.entries(recentMap)) {
        const older = olderMap[query];
        if (older && older.impressions > 0) {
          const change = ((recent.impressions - older.impressions) / older.impressions) * 100;
          trending.push({
            query,
            recent_impressions: recent.impressions,
            older_impressions: older.impressions,
            impression_change_pct: Math.round(change),
            recent_position: recent.position,
            older_position: older.position,
            position_change: Math.round((older.position - recent.position) * 10) / 10,
            direction: change > 20 ? 'rising' : change < -20 ? 'falling' : 'stable',
          });
        }
      }

      const rising = trending.filter(t => t.direction === 'rising').sort((a, b) => b.impression_change_pct - a.impression_change_pct).slice(0, 15);
      const falling = trending.filter(t => t.direction === 'falling').sort((a, b) => a.impression_change_pct - b.impression_change_pct).slice(0, 15);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        rising_keywords: rising,
        falling_keywords: falling,
        insight: `${rising.length} keywords rising, ${falling.length} falling. Double down on rising keywords. Investigate falling keywords for content freshness issues.`,
      });
      break;
    }

    case 'high-intent': {
      const highIntent = rows
        .filter(r => {
          const intent = classifyIntent(r.query);
          return intent === 'transactional' || intent === 'commercial';
        })
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 30)
        .map(r => ({
          ...r,
          intent: classifyIntent(r.query),
          revenue_potential: r.position <= 3 ? 'capturing' : r.position <= 10 ? 'high' : r.position <= 20 ? 'medium' : 'low',
          action: r.position <= 3
            ? 'Defend position — keep content fresh and build backlinks'
            : r.position <= 10
            ? 'Optimize content + meta tags to reach top 3'
            : 'Create dedicated landing page with conversion elements',
        }));

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        high_intent_keywords: highIntent,
        insight: `${highIntent.length} high-intent keywords found. These drive revenue — prioritize them over informational keywords.`,
      });
      break;
    }

    case 'page-keywords': {
      const pageMap = {};
      for (const row of rows) {
        const page = row.page || '(unknown)';
        if (!pageMap[page]) pageMap[page] = { page, keywords: [], total_clicks: 0, total_impressions: 0 };
        pageMap[page].keywords.push({ query: row.query, clicks: row.clicks, impressions: row.impressions, position: row.position, intent: classifyIntent(row.query) });
        pageMap[page].total_clicks += row.clicks;
        pageMap[page].total_impressions += row.impressions;
      }

      const pages = Object.values(pageMap)
        .map(p => {
          p.keyword_count = p.keywords.length;
          p.primary_intent = getMajorityIntent(p.keywords);
          p.avg_position = Math.round((p.keywords.reduce((s, k) => s + k.position, 0) / p.keywords.length) * 10) / 10;
          p.top_keywords = p.keywords.sort((a, b) => b.impressions - a.impressions).slice(0, 5);
          delete p.keywords;
          return p;
        })
        .sort((a, b) => b.total_impressions - a.total_impressions)
        .slice(0, 30);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        pages,
        insight: 'Each page should target a primary keyword cluster. Pages with mixed intents may need to be split into focused pages.',
      });
      break;
    }

    case 'content-decay': {
      // Detect pages losing traffic — the silent killer of organic growth
      const recentData = await queryGscExtended(siteUrl, Math.floor(days / 2), ['query', 'page'], 1000);
      const olderData = await queryGscExtendedRange(siteUrl, days, Math.floor(days / 2), ['query', 'page'], 1000);

      if (!recentData.success || !olderData.success) {
        error('Cannot fetch comparison data for content decay analysis. Ensure GSC credentials are configured.');
      }

      const decaying = detectContentDecay(recentData.rows || [], olderData.rows || []);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        decaying_pages: decaying.slice(0, 20),
        total_decaying: decaying.length,
        critical_count: decaying.filter(d => d.severity === 'critical').length,
        insight: decaying.length > 0
          ? `${decaying.length} pages are losing traffic. ${decaying.filter(d => d.severity === 'critical').length} are critical (>50% traffic loss). These pages need immediate content refresh.`
          : 'No significant content decay detected. Your content is holding its traffic well.',
        strategy: {
          critical: 'Complete content overhaul: rewrite with current data, expand depth, add new sections, update dates/stats. Target within 1 week.',
          high: 'Content refresh: update statistics, add new examples, improve structure. Target within 2 weeks.',
          medium: 'Monitor and optimize: improve meta tags, add internal links, update any outdated references.',
        },
      });
      break;
    }

    case 'difficulty': {
      // Keyword difficulty + SERP feature impact analysis
      const analyzed = rows
        .filter(r => r.impressions >= 5)
        .map(r => {
          const diff = estimateKeywordDifficulty(r);
          return {
            query: r.query,
            position: r.position,
            impressions: r.impressions,
            clicks: r.clicks,
            ctr: r.ctr,
            intent: classifyIntent(r.query),
            ...diff,
          };
        })
        .sort((a, b) => b.potential_clicks_at_pos1 - a.potential_clicks_at_pos1);

      // Find keywords where SERP features are stealing clicks
      const serpImpacted = analyzed.filter(k => k.serp_feature_impact_pct > 30).slice(0, 15);

      // Easiest to win (already ranking, low difficulty, high potential)
      const easiestWins = analyzed
        .filter(k => k.difficulty === 'low' || k.difficulty === 'medium')
        .sort((a, b) => b.potential_clicks_at_pos1 - a.potential_clicks_at_pos1)
        .slice(0, 15);

      // Highest ROI opportunities
      const highRoi = analyzed
        .filter(k => (k.intent === 'transactional' || k.intent === 'commercial') && k.potential_clicks_at_pos1 > 10)
        .sort((a, b) => b.potential_clicks_at_pos1 - a.potential_clicks_at_pos1)
        .slice(0, 15);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        total_analyzed: analyzed.length,
        difficulty_breakdown: {
          'easy-to-defend': analyzed.filter(k => k.difficulty === 'easy-to-defend').length,
          low: analyzed.filter(k => k.difficulty === 'low').length,
          medium: analyzed.filter(k => k.difficulty === 'medium').length,
          high: analyzed.filter(k => k.difficulty === 'high').length,
          'very-high': analyzed.filter(k => k.difficulty === 'very-high').length,
        },
        serp_feature_impacted: serpImpacted,
        easiest_wins: easiestWins,
        highest_roi: highRoi,
        top_opportunities: analyzed.slice(0, 20),
        insights: [
          serpImpacted.length > 5
            ? { priority: 'high', insight: `${serpImpacted.length} keywords have SERP features (featured snippets, PAA, carousels) stealing >30% of expected clicks. Target these with structured data, FAQ schema, and direct-answer content format.` }
            : null,
          easiestWins.length > 0
            ? { priority: 'high', insight: `${easiestWins.length} keywords are low-medium difficulty with high potential. These are your fastest path to traffic growth.`, action: 'Optimize content depth, title tags, and internal links for these keywords.' }
            : null,
          highRoi.length > 0
            ? { priority: 'critical', insight: `${highRoi.length} high-intent keywords (transactional/commercial) have untapped potential. Each could drive revenue if you reach position 1.`, action: 'Create dedicated landing pages with conversion elements for each keyword.' }
            : null,
        ].filter(Boolean),
      });
      break;
    }

    case 'cross-reference': {
      // The expert's "money move": join GSC page data with GA4 conversion data
      // Finds: pages converting but underexposed, pages with traffic but no conversions
      const ga4PropertyId = process.argv.find(a => a.startsWith('--ga4='));
      if (!ga4PropertyId) {
        error('cross-reference requires GA4 Property ID.\nUsage: node keyword-intelligence.mjs cross-reference <site-url> [days] --ga4=PROPERTY_ID');
      }
      const propId = ga4PropertyId.replace('--ga4=', '');

      // Get GA4 organic landing page data
      const ga4Data = runGa4Query('landing-pages', propId, days, ['--organic']);
      if (!ga4Data.success) {
        error(`GA4 query failed: ${ga4Data.error}. Ensure ULTRASHIP_GA4_CREDENTIALS is configured.`);
      }

      // Build GA4 page map (normalize paths)
      const ga4Pages = {};
      for (const p of (ga4Data.landing_pages || [])) {
        const path = p.landing_page?.replace(/\/$/, '') || '';
        ga4Pages[path] = p;
      }

      // Build GSC page map
      const gscPages = {};
      for (const r of rows) {
        if (!r.page) continue;
        try {
          const url = new URL(r.page);
          const path = url.pathname.replace(/\/$/, '');
          if (!gscPages[path]) gscPages[path] = { clicks: 0, impressions: 0, keywords: 0, best_position: 100, top_query: '' };
          gscPages[path].clicks += r.clicks;
          gscPages[path].impressions += r.impressions;
          gscPages[path].keywords++;
          if (r.position < gscPages[path].best_position) {
            gscPages[path].best_position = r.position;
            gscPages[path].top_query = r.query;
          }
        } catch { /* skip invalid URLs */ }
      }

      // Cross-reference: 4 buckets from the expert
      const convertingButUnderexposed = []; // High GA4 conversions + low GSC traffic
      const rankingButNotConverting = []; // Good GSC traffic + low GA4 key events
      const scalablePages = []; // Good GSC + good GA4 = invest more
      const ctrProblems = []; // High GSC impressions + low GA4 sessions

      const allPaths = new Set([...Object.keys(ga4Pages), ...Object.keys(gscPages)]);
      for (const path of allPaths) {
        const ga4 = ga4Pages[path];
        const gsc = gscPages[path];
        if (!ga4 && !gsc) continue;

        const entry = {
          page: path,
          gsc_clicks: gsc?.clicks || 0,
          gsc_impressions: gsc?.impressions || 0,
          gsc_best_position: gsc?.best_position || null,
          gsc_keywords: gsc?.keywords || 0,
          gsc_top_query: gsc?.top_query || null,
          ga4_sessions: ga4?.sessions || 0,
          ga4_key_events: ga4?.key_events || 0,
          ga4_key_event_rate: ga4?.key_event_rate || 0,
          ga4_engagement_rate: ga4?.engagement_rate || 0,
          ga4_bounce_rate: ga4?.bounce_rate || 0,
        };

        // Converting but underexposed: has conversions, low search visibility
        if ((ga4?.key_events || 0) > 0 && (gsc?.impressions || 0) < 500) {
          convertingButUnderexposed.push({ ...entry, action: 'PRIORITY SCALE: This page converts but has low search exposure. Optimize for more keywords, build internal links, create supporting content.' });
        }
        // Ranking but not converting: good traffic, no conversions
        if ((gsc?.clicks || 0) > 10 && (ga4?.key_events || 0) === 0 && (ga4?.sessions || 0) > 5) {
          rankingButNotConverting.push({ ...entry, action: 'FIX FUNNEL: Good traffic but zero conversions. Add CTAs, improve offer clarity, check intent match.' });
        }
        // Scalable: both good
        if ((gsc?.clicks || 0) > 10 && (ga4?.key_events || 0) > 0) {
          scalablePages.push({ ...entry, action: 'DOUBLE DOWN: Traffic + conversions proven. Expand keyword coverage, add supporting content, build backlinks.' });
        }
        // CTR problem: high impressions, low sessions
        if ((gsc?.impressions || 0) > 200 && (ga4?.sessions || 0) < (gsc?.clicks || 0) * 0.5) {
          ctrProblems.push({ ...entry, action: 'CTR GAP: Impressions exist but sessions don\'t follow. Rewrite title/meta, check intent, verify page loads properly.' });
        }
      }

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        brand_filter: brandSummary,
        ga4_property: propId,
        converting_but_underexposed: convertingButUnderexposed.sort((a, b) => b.ga4_key_events - a.ga4_key_events).slice(0, 15),
        ranking_but_not_converting: rankingButNotConverting.sort((a, b) => b.gsc_clicks - a.gsc_clicks).slice(0, 15),
        scalable_pages: scalablePages.sort((a, b) => b.ga4_key_events - a.ga4_key_events).slice(0, 15),
        ctr_problems: ctrProblems.sort((a, b) => b.gsc_impressions - a.gsc_impressions).slice(0, 10),
        insight: `Cross-referenced ${Object.keys(gscPages).length} GSC pages with ${Object.keys(ga4Pages).length} GA4 pages. `
          + `${convertingButUnderexposed.length} pages convert but need more traffic (highest ROI). `
          + `${rankingButNotConverting.length} pages have traffic but no conversions (funnel problem). `
          + `${scalablePages.length} pages are proven winners (scale aggressively).`,
      });
      break;
    }

    case 'anomalies': {
      // "Low position, high CTR" — Google flags these as strong opportunities
      // These pages already resonate with users despite poor rankings
      const expectedCtr = [0, 31.7, 24.7, 18.6, 13.6, 9.5, 6.2, 4.2, 3.1, 2.4, 1.9];
      const anomalies = rows
        .filter(r => r.impressions >= 10 && r.clicks >= 2)
        .map(r => {
          const pos = Math.min(Math.round(r.position), 10);
          const expected = pos >= 1 && pos <= 10 ? expectedCtr[pos] : Math.max(0.1, 1.9 - (pos - 10) * 0.15);
          const ctrRatio = expected > 0 ? r.ctr / expected : 0;
          return { ...r, expected_ctr: expected, ctr_ratio: Math.round(ctrRatio * 100) / 100, intent: classifyIntent(r.query) };
        })
        .filter(r => r.ctr_ratio > 1.3) // CTR is 30%+ above expected for position = anomaly
        .sort((a, b) => b.ctr_ratio - a.ctr_ratio);

      // "High position, low CTR" — pages ranking well but users not clicking (poor snippet)
      const underperformers = rows
        .filter(r => r.impressions >= 20 && r.position <= 10)
        .map(r => {
          const pos = Math.min(Math.round(r.position), 10);
          const expected = pos >= 1 ? expectedCtr[pos] : 1.9;
          const ctrRatio = expected > 0 ? r.ctr / expected : 0;
          return { ...r, expected_ctr: expected, ctr_ratio: Math.round(ctrRatio * 100) / 100, intent: classifyIntent(r.query) };
        })
        .filter(r => r.ctr_ratio < 0.5) // CTR is <50% of expected = underperformer
        .sort((a, b) => a.ctr_ratio - b.ctr_ratio);

      output({
        success: true,
        site: siteUrl,
        period: gscData.period,
        brand_filter: brandSummary,
        high_ctr_anomalies: anomalies.slice(0, 20).map(r => ({
          query: r.query, page: r.page, position: r.position, ctr: r.ctr,
          expected_ctr: r.expected_ctr, ctr_ratio: r.ctr_ratio, impressions: r.impressions,
          clicks: r.clicks, intent: r.intent,
          action: r.position > 10
            ? 'PRIORITY INVEST: Google already considers this highly relevant. Push to page 1 with content optimization and internal links.'
            : 'DEFEND & EXPAND: Outperforming expectations. Create supporting content to build a topic cluster.',
        })),
        low_ctr_underperformers: underperformers.slice(0, 20).map(r => ({
          query: r.query, page: r.page, position: r.position, ctr: r.ctr,
          expected_ctr: r.expected_ctr, ctr_ratio: r.ctr_ratio, impressions: r.impressions,
          intent: r.intent,
          action: 'Rewrite title tag and meta description. Check if SERP features are stealing clicks. Verify search intent match.',
        })),
        insight: `${anomalies.length} keywords have CTR 30%+ above expected (Google sees high relevance). ${underperformers.length} keywords are underperforming despite good positions (snippet problem).`,
        strategy: 'High-CTR anomalies at low positions are your #1 investment targets — Google already trusts the page, you just need to push it higher. Low-CTR underperformers at good positions need snippet optimization, not content changes.',
      });
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: analyze, quick-wins, cannibalization, content-gaps, intent-map, trending, high-intent, page-keywords, content-decay, difficulty, anomalies, cross-reference`);
  }
}

function getMajorityIntent(keywords) {
  const counts = { transactional: 0, commercial: 0, informational: 0, navigational: 0 };
  for (const k of keywords) counts[k.intent]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function generateInsights(rows, quickWins, contentGaps, intentBreakdown, topPerformers) {
  const insights = [];
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

  if (quickWins.length > 10) {
    insights.push({
      priority: 'high',
      insight: `${quickWins.length} keywords at striking distance (positions 4-20). Optimizing these could add ~${quickWins.reduce((s, r) => s + Math.round(r.impressions * 0.12), 0)} monthly clicks.`,
      action: 'Improve content depth, add internal links, and optimize title tags for these keywords.',
    });
  }

  if (contentGaps.length > 5) {
    const gapImpressions = contentGaps.reduce((s, r) => s + r.impressions, 0);
    insights.push({
      priority: 'high',
      insight: `${contentGaps.length} keywords with ${gapImpressions} impressions but <3% CTR. Content exists but isn't compelling enough to click.`,
      action: 'Rewrite meta descriptions and title tags. Add FAQ schema. Make content directly answer the search query.',
    });
  }

  if (intentBreakdown.transactional + intentBreakdown.commercial < intentBreakdown.informational * 0.2) {
    insights.push({
      priority: 'medium',
      insight: 'Your keyword profile is heavily informational. You may be attracting visitors who never convert.',
      action: 'Create commercial/transactional content: pricing pages, comparison posts, case studies, and product landing pages.',
    });
  }

  if (topPerformers.length < 3) {
    insights.push({
      priority: 'high',
      insight: `Only ${topPerformers.length} keywords in top 3 positions. Most organic traffic goes to positions 1-3.`,
      action: 'Focus all efforts on pushing your best-performing keywords from positions 4-10 into the top 3.',
    });
  }

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  if (avgCtr < 2) {
    insights.push({
      priority: 'high',
      insight: `Average CTR is ${Math.round(avgCtr * 100) / 100}% — well below healthy benchmarks (3-5%). Your pages appear in results but users don't click.`,
      action: 'Audit title tags and meta descriptions. Add structured data for rich snippets. Ensure content matches search intent.',
    });
  }

  return insights;
}

main();
