#!/usr/bin/env node
// tools/ga4-client.mjs
// Google Analytics 4 Data API client
// Usage: node tools/ga4-client.mjs <command> [args]
// Commands:
//   overview <property-id> [days]           — Traffic overview (sessions, users, pageviews, bounce rate)
//   top-pages <property-id> [days]          — Top pages by sessions + engagement
//   traffic-sources <property-id> [days]    — Traffic breakdown by source/medium
//   conversions <property-id> [days]        — Conversion events + rates
//   landing-pages <property-id> [days]      — Landing page performance (entry pages)
//   user-journey <property-id> [days]       — User flow: landing → engagement → conversion
//   search-terms <property-id> [days]       — Internal site search terms (if configured)
//   geo <property-id> [days]                — Traffic by country/city
//   devices <property-id> [days]            — Device category breakdown (desktop/mobile/tablet)
//   realtime <property-id>                  — Real-time active users
//   ai-traffic <property-id> [days]         — AI search referral traffic (ChatGPT, Perplexity, Copilot, Gemini)
//   organic <property-id> [days]            — Organic search overview with key event rates
//
// Options:
//   --organic                               — Filter to organic search only (works with top-pages, landing-pages)
//
// Auth: Set ULTRASHIP_GA4_CREDENTIALS to path of service account JSON key file
//       OR set ULTRASHIP_GA4_ACCESS_TOKEN to a valid OAuth2 access token
//
// Setup guide:
//   1. Go to Google Cloud Console → APIs & Services → Enable "Google Analytics Data API"
//   2. Create a Service Account → Download JSON key
//   3. In GA4 Admin → Property Access Management → Add service account email as Viewer
//   4. Set ULTRASHIP_GA4_CREDENTIALS=/path/to/key.json
//   5. Find your Property ID in GA4 Admin → Property Settings (numeric ID like 123456789)

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
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'analyticsdata.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    if (bodyStr) {
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
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function dateRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function parseRows(result, dimNames, metricNames) {
  if (!result.rows) return [];
  return result.rows.map(row => {
    const obj = {};
    (row.dimensionValues || []).forEach((v, i) => {
      obj[dimNames[i]] = v.value;
    });
    (row.metricValues || []).forEach((v, i) => {
      const val = parseFloat(v.value);
      obj[metricNames[i]] = Number.isInteger(val) ? val : Math.round(val * 100) / 100;
    });
    return obj;
  });
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    error('Usage: node ga4-client.mjs <command> [args]\nCommands: overview, top-pages, traffic-sources, conversions, landing-pages, user-journey, search-terms, geo, devices, realtime, ai-traffic, organic\nOptions: --organic (filter to organic search only)');
  }

  // Get access token
  let token = process.env.ULTRASHIP_GA4_ACCESS_TOKEN;
  if (!token) {
    const keyPath = process.env.ULTRASHIP_GA4_CREDENTIALS;
    if (!keyPath) {
      error('No GA4 credentials configured.\n\nSetup:\n1. Enable Google Analytics Data API in Google Cloud Console\n2. Create Service Account and download JSON key\n3. In GA4 Admin → Property Access Management → Add service account email as Viewer\n4. Set ULTRASHIP_GA4_CREDENTIALS=/path/to/key.json\n5. Find Property ID in GA4 Admin → Property Settings (numeric, e.g., 123456789)');
    }
    try {
      token = await getAccessToken(keyPath);
    } catch (err) {
      error(`Auth failed: ${err.message}`);
    }
  }

  const propertyId = process.argv[3];
  if (!propertyId) {
    error('Property ID required. Find it in GA4 Admin → Property Settings (numeric ID like 123456789)');
  }
  if (!/^\d+$/.test(propertyId)) {
    error(`Invalid Property ID "${propertyId}". Must be numeric (e.g., 123456789). Find it in GA4 Admin → Property Settings.`);
  }
  const days = parseInt(process.argv[4] || '28', 10);
  const range = dateRange(days);
  const propPath = `v1beta/properties/${propertyId}`;

  switch (command) {
    case 'overview': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagedSessions' },
            { name: 'engagementRate' },
            { name: 'keyEvents' },
          ],
        });
        const row = result.rows?.[0];
        const metrics = row?.metricValues || [];
        const names = ['sessions', 'total_users', 'new_users', 'pageviews', 'avg_session_duration_sec', 'bounce_rate', 'engaged_sessions', 'engagement_rate', 'key_events'];
        const rateMetrics = new Set(['bounce_rate', 'engagement_rate']);
        const overview = {};
        metrics.forEach((v, i) => {
          const val = parseFloat(v.value);
          if (rateMetrics.has(names[i])) {
            overview[names[i]] = Math.round(val * 10000) / 100; // decimal to percentage
          } else {
            overview[names[i]] = Math.round(val * 100) / 100; // 2 decimal places
          }
        });

        // Get comparison period (previous period ends 1 day before current starts)
        const prevEnd = new Date(new Date(range.startDate).getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - days * 86400000);
        const prevResult = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [
            { startDate: range.startDate, endDate: range.endDate },
            { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'keyEvents' },
          ],
        });
        const trends = {};
        if (prevResult.rows?.length >= 2) {
          const current = prevResult.rows[0].metricValues.map(v => parseFloat(v.value));
          const previous = prevResult.rows[1].metricValues.map(v => parseFloat(v.value));
          const trendNames = ['sessions', 'users', 'pageviews', 'key_events'];
          trendNames.forEach((name, i) => {
            if (previous[i] > 0) {
              trends[name + '_change_pct'] = Math.round(((current[i] - previous[i]) / previous[i]) * 10000) / 100;
            }
          });
        }

        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          overview,
          trends_vs_previous_period: trends,
        });
      } catch (err) {
        error(`Overview query failed: ${err.message}`);
      }
      break;
    }

    case 'top-pages': {
      try {
        const tpReq = {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'userEngagementDuration' },
            { name: 'keyEvents' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 50,
        };
        if (process.argv.includes('--organic')) {
          tpReq.dimensionFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
        }
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, tpReq);
        const pages = parseRows(result,
          ['page_path'],
          ['sessions', 'pageviews', 'avg_session_duration_sec', 'bounce_rate', 'engagement_rate', 'engagement_duration_sec', 'key_events']
        );
        for (const p of pages) {
          p.key_event_rate = p.sessions > 0 ? Math.round((p.key_events / p.sessions) * 10000) / 100 : 0;
          p.avg_engagement_time_sec = p.sessions > 0 ? Math.round((p.engagement_duration_sec / p.sessions) * 10) / 10 : 0;
        }
        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          filter: process.argv.includes('--organic') ? 'organic_search_only' : 'all_traffic',
          total_pages: pages.length,
          top_pages: pages,
        });
      } catch (err) {
        error(`Top pages query failed: ${err.message}`);
      }
      break;
    }

    case 'traffic-sources': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'engagementRate' },
            { name: 'keyEvents' },
            { name: 'bounceRate' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 30,
        });
        const sources = parseRows(result,
          ['source', 'medium'],
          ['sessions', 'users', 'engagement_rate', 'key_events', 'bounce_rate']
        );
        output({ success: true, property_id: propertyId, period: `${range.startDate} to ${range.endDate}`, traffic_sources: sources });
      } catch (err) {
        error(`Traffic sources query failed: ${err.message}`);
      }
      break;
    }

    case 'conversions':
    case 'key-events': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'eventName' }],
          metrics: [
            { name: 'eventCount' },
            { name: 'totalUsers' },
            { name: 'eventCountPerUser' },
          ],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 30,
        });
        const events = parseRows(result,
          ['event_name'],
          ['event_count', 'users', 'events_per_user']
        );
        output({ success: true, property_id: propertyId, period: `${range.startDate} to ${range.endDate}`, conversion_events: events });
      } catch (err) {
        error(`Conversions query failed: ${err.message}`);
      }
      break;
    }

    case 'landing-pages': {
      try {
        const lpReq = {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'landingPage' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'engagementRate' },
            { name: 'userEngagementDuration' },
            { name: 'keyEvents' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 50,
        };
        // --organic flag: filter to organic search traffic only
        if (process.argv.includes('--organic')) {
          lpReq.dimensionFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
        }
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, lpReq);
        const pages = parseRows(result,
          ['landing_page'],
          ['sessions', 'users', 'bounce_rate', 'avg_session_duration_sec', 'engagement_rate', 'engagement_duration_sec', 'key_events']
        );
        // Calculate key event rate per session for each page
        for (const p of pages) {
          p.key_event_rate = p.sessions > 0 ? Math.round((p.key_events / p.sessions) * 10000) / 100 : 0;
          p.avg_engagement_time_sec = p.sessions > 0 ? Math.round((p.engagement_duration_sec / p.sessions) * 10) / 10 : 0;
        }
        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          filter: process.argv.includes('--organic') ? 'organic_search_only' : 'all_traffic',
          landing_pages: pages,
        });
      } catch (err) {
        error(`Landing pages query failed: ${err.message}`);
      }
      break;
    }

    case 'user-journey': {
      try {
        // Page path with engagement metrics to understand user flow
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'sessionDefaultChannelGroup' }],
          metrics: [
            { name: 'sessions' },
            { name: 'engagedSessions' },
            { name: 'keyEvents' },
            { name: 'userEngagementDuration' },
          ],
          orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }],
          limit: 50,
        });
        const journeys = parseRows(result,
          ['page_path', 'channel'],
          ['sessions', 'engaged_sessions', 'key_events', 'engagement_duration_sec']
        );

        // Separate high-converting vs high-bounce paths
        const highConverting = journeys.filter(j => j.key_events > 0).slice(0, 20);
        const highEngagement = journeys.sort((a, b) => (b.engaged_sessions / (b.sessions || 1)) - (a.engaged_sessions / (a.sessions || 1))).slice(0, 20);

        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          high_converting_paths: highConverting,
          high_engagement_paths: highEngagement,
          insight: 'High-converting paths show where users complete goals. High-engagement paths show sticky content. Cross-reference to find conversion optimization opportunities.',
        });
      } catch (err) {
        error(`User journey query failed: ${err.message}`);
      }
      break;
    }

    case 'search-terms': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'searchTerm' }],
          metrics: [
            { name: 'eventCount' },
            { name: 'totalUsers' },
          ],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 50,
        });
        const terms = parseRows(result, ['search_term'], ['searches', 'users']);
        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          search_terms: terms,
          insight: 'Internal search terms reveal what users cannot find via navigation. Create content or improve UX for top searched terms.',
        });
      } catch (err) {
        error(`Search terms query failed: ${err.message}`);
      }
      break;
    }

    case 'geo': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'country' }, { name: 'city' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'engagementRate' },
            { name: 'keyEvents' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 30,
        });
        const locations = parseRows(result,
          ['country', 'city'],
          ['sessions', 'users', 'engagement_rate', 'key_events']
        );
        output({ success: true, property_id: propertyId, period: `${range.startDate} to ${range.endDate}`, locations });
      } catch (err) {
        error(`Geo query failed: ${err.message}`);
      }
      break;
    }

    case 'devices': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'keyEvents' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        });
        const devices = parseRows(result,
          ['device'],
          ['sessions', 'users', 'bounce_rate', 'avg_session_duration_sec', 'key_events']
        );
        output({ success: true, property_id: propertyId, period: `${range.startDate} to ${range.endDate}`, devices });
      } catch (err) {
        error(`Devices query failed: ${err.message}`);
      }
      break;
    }

    case 'realtime': {
      try {
        const result = await apiRequest('POST', `/${propPath}:runRealtimeReport`, token, {
          dimensions: [{ name: 'unifiedScreenName' }],
          metrics: [{ name: 'activeUsers' }],
          limit: 20,
        });
        const pages = parseRows(result, ['page'], ['active_users']);
        const totalActive = pages.reduce((sum, p) => sum + p.active_users, 0);
        output({
          success: true,
          property_id: propertyId,
          total_active_users: totalActive,
          active_pages: pages,
        });
      } catch (err) {
        error(`Realtime query failed: ${err.message}`);
      }
      break;
    }

    case 'ai-traffic': {
      // Track AI search referral traffic: ChatGPT, Perplexity, Bing Copilot, Claude
      try {
        const aiSources = [
          { source: 'chatgpt.com', label: 'ChatGPT Search' },
          { source: 'perplexity.ai', label: 'Perplexity' },
          { source: 'copilot.microsoft.com', label: 'Microsoft Copilot' },
          { source: 'bing.com', label: 'Bing (includes Bing AI)' },
          { source: 'gemini.google.com', label: 'Google Gemini' },
          { source: 'claude.ai', label: 'Claude' },
          { source: 'you.com', label: 'You.com' },
        ];

        // Get all traffic sources
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'sessionSource' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'engagementRate' },
            { name: 'averageSessionDuration' },
            { name: 'keyEvents' },
            { name: 'screenPageViews' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 500,
        });

        const allSources = parseRows(result, ['source'], ['sessions', 'users', 'engagement_rate', 'avg_session_duration_sec', 'key_events', 'pageviews']);
        const totalSessions = allSources.reduce((s, r) => s + r.sessions, 0);

        // Match AI sources
        const aiTraffic = [];
        for (const ai of aiSources) {
          const match = allSources.find(r => r.source && r.source.includes(ai.source.split('.')[0]));
          if (match) {
            aiTraffic.push({
              source: ai.label,
              source_domain: match.source,
              sessions: match.sessions,
              users: match.users,
              engagement_rate: match.engagement_rate,
              avg_session_duration_sec: match.avg_session_duration_sec,
              key_events: match.key_events,
              key_event_rate: match.sessions > 0 ? Math.round((match.key_events / match.sessions) * 10000) / 100 : 0,
              pct_of_total: totalSessions > 0 ? Math.round((match.sessions / totalSessions) * 10000) / 100 : 0,
            });
          }
        }

        // Also get landing pages for AI sources
        const aiSourceFilter = aiTraffic.map(a => a.source_domain);
        let aiLandingPages = [];
        if (aiSourceFilter.length > 0) {
          const lpResult = await apiRequest('POST', `/${propPath}:runReport`, token, {
            dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
            dimensions: [{ name: 'landingPage' }, { name: 'sessionSource' }],
            metrics: [
              { name: 'sessions' },
              { name: 'keyEvents' },
            ],
            dimensionFilter: {
              orGroup: {
                expressions: aiSourceFilter.map(src => ({
                  filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: src.split('.')[0] } },
                })),
              },
            },
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 30,
          });
          aiLandingPages = parseRows(lpResult, ['landing_page', 'source'], ['sessions', 'key_events']);
        }

        const totalAiSessions = aiTraffic.reduce((s, a) => s + a.sessions, 0);
        const totalAiKeyEvents = aiTraffic.reduce((s, a) => s + a.key_events, 0);

        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          total_sessions: totalSessions,
          total_ai_sessions: totalAiSessions,
          ai_traffic_pct: totalSessions > 0 ? Math.round((totalAiSessions / totalSessions) * 10000) / 100 : 0,
          ai_sources: aiTraffic.sort((a, b) => b.sessions - a.sessions),
          ai_landing_pages: aiLandingPages.slice(0, 20),
          total_ai_key_events: totalAiKeyEvents,
          ai_key_event_rate: totalAiSessions > 0 ? Math.round((totalAiKeyEvents / totalAiSessions) * 10000) / 100 : 0,
          insight: aiTraffic.length > 0
            ? `${aiTraffic.length} AI sources detected. ${totalAiSessions} sessions (${totalSessions > 0 ? Math.round((totalAiSessions / totalSessions) * 100) : 0}% of total). Track utm_source=chatgpt.com in GA4 for precise ChatGPT attribution.`
            : 'No AI search traffic detected yet. Ensure AI bots (OAI-SearchBot, PerplexityBot) are allowed in robots.txt. Build citation-ready content.',
          setup_tip: 'For precise ChatGPT tracking: OpenAI sends utm_source=chatgpt.com. Create a GA4 custom segment for source contains "chatgpt" to track AI search ROI.',
        });
      } catch (err) {
        error(`AI traffic query failed: ${err.message}`);
      }
      break;
    }

    case 'organic': {
      // Organic search overview — the elite operator's primary view
      try {
        const organicFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
        const result = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensionFilter: organicFilter,
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'engagementRate' },
            { name: 'averageSessionDuration' },
            { name: 'keyEvents' },
          ],
        });

        const row = result.rows?.[0];
        const metrics = row?.metricValues || [];
        const names = ['sessions', 'users', 'pageviews', 'bounce_rate', 'engagement_rate', 'avg_session_duration_sec', 'key_events'];
        const rateMetrics = new Set(['bounce_rate', 'engagement_rate']);
        const organic = {};
        metrics.forEach((v, i) => {
          const val = parseFloat(v.value);
          organic[names[i]] = rateMetrics.has(names[i]) ? Math.round(val * 10000) / 100 : Math.round(val * 100) / 100;
        });
        organic.key_event_rate = organic.sessions > 0 ? Math.round((organic.key_events / organic.sessions) * 10000) / 100 : 0;

        // Top organic landing pages
        const lpResult = await apiRequest('POST', `/${propPath}:runReport`, token, {
          dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
          dimensions: [{ name: 'landingPage' }],
          dimensionFilter: organicFilter,
          metrics: [
            { name: 'sessions' },
            { name: 'keyEvents' },
            { name: 'engagementRate' },
            { name: 'bounceRate' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 30,
        });
        const pages = parseRows(lpResult, ['landing_page'], ['sessions', 'key_events', 'engagement_rate', 'bounce_rate']);
        for (const p of pages) {
          p.key_event_rate = p.sessions > 0 ? Math.round((p.key_events / p.sessions) * 10000) / 100 : 0;
        }

        output({
          success: true,
          property_id: propertyId,
          period: `${range.startDate} to ${range.endDate}`,
          organic_overview: organic,
          top_organic_landing_pages: pages,
          insight: 'Organic overview shows ONLY search traffic. Cross-reference with GSC: high GA4 key-event-rate pages with low GSC impressions are your #1 scale opportunity.',
        });
      } catch (err) {
        error(`Organic query failed: ${err.message}`);
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: overview, top-pages, traffic-sources, conversions, landing-pages, user-journey, search-terms, geo, devices, realtime, ai-traffic, organic`);
  }
}

main();
