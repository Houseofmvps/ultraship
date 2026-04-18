#!/usr/bin/env node
import { Parser } from './lib/html-parser.mjs';
import fs from 'fs';
import path from 'path';
import { checkFileSize } from './lib/security.mjs';

const ALWAYS_SKIP = new Set(['node_modules', '.git', '.next']);
// dist/ and build/ are skipped UNLESS they contain HTML files (pre-rendered sites)
const MAYBE_SKIP = new Set(['dist', 'build']);

function dirHasHtml(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && /\.html?$/i.test(e.name)) return true;
      if (e.isDirectory() && !ALWAYS_SKIP.has(e.name)) {
        if (dirHasHtml(path.join(dirPath, e.name))) return true;
      }
    }
  } catch { /* skip */ }
  return false;
}

function findHtmlFiles(dir, skipOverrides) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      if (MAYBE_SKIP.has(entry.name) && !(skipOverrides && skipOverrides.has(entry.name))) continue;
      results.push(...findHtmlFiles(path.join(dir, entry.name), skipOverrides));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function parseHtmlFile(filePath) {
  // Check file size before reading to prevent OOM on huge files
  const sizeCheck = checkFileSize(filePath, fs.statSync);
  if (!sizeCheck.ok) return null;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const state = {
    hasTitle: false,
    titleText: '',
    hasMetaDescription: false,
    metaDescriptionText: '',
    hasViewport: false,
    hasCharset: false,
    hasOgTitle: false,
    hasOgDescription: false,
    hasOgImage: false,
    ogImageUrl: '',
    hasOgUrl: false,
    hasTwitterCard: false,
    hasTwitterImage: false,
    hasCanonical: false,
    canonicalUrl: '',
    hasNoindex: false,
    hasHreflang: false,
    hasAnalytics: false,
    analyticsProvider: null,
    h1Count: 0,
    h1Text: '',
    headingLevels: [],
    imagesWithoutAlt: 0,
    imagesWithoutDimensions: 0,
    hasMain: false,
    hasNav: false,
    hasFooter: false,
    hasArticle: false,
    h2Texts: [],
    inH2: false,
    currentH2Text: '',
    inH1: false,
    currentH1Text: '',
    internalLinks: [],
    externalLinks: [],
    brokenLinkCandidates: [],
    jsonLdScripts: 0,
    jsonLdContent: [],
    inScript: false,
    scriptType: '',
    scriptContent: '',
    inTitle: false,
    bodyTextLength: 0,
    inBody: false,
    inStyle: false,
    wordCount: 0,
    hasNosnippet: false,
    maxSnippetValue: null,
    hasDataNosnippet: false,
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const tag = name.toLowerCase();

        if (tag === 'title') {
          state.inTitle = true;
        }

        if (tag === 'meta') {
          const nameAttr = (attrs.name || '').toLowerCase();
          const propAttr = (attrs.property || '').toLowerCase();
          const httpEquiv = (attrs['http-equiv'] || '').toLowerCase();
          const content = attrs.content || '';
          const charset = attrs.charset || '';

          if (nameAttr === 'description' && content) { state.hasMetaDescription = true; state.metaDescriptionText = content; }
          if (nameAttr === 'viewport') state.hasViewport = true;
          if (nameAttr === 'robots' && content.toLowerCase().includes('noindex')) state.hasNoindex = true;
          if (nameAttr === 'googlebot' && content.toLowerCase().includes('noindex')) state.hasNoindex = true;
          // Snippet restriction detection — limits AI feature eligibility
          const contentLc = content.toLowerCase();
          if ((nameAttr === 'robots' || nameAttr === 'googlebot') && contentLc.includes('nosnippet')) state.hasNosnippet = true;
          if ((nameAttr === 'robots' || nameAttr === 'googlebot')) {
            const msMatch = contentLc.match(/max-snippet\s*:\s*(-?\d+)/);
            if (msMatch) state.maxSnippetValue = parseInt(msMatch[1], 10);
          }
          if (charset || httpEquiv === 'content-type') state.hasCharset = true;
          if (propAttr === 'og:title' && content) state.hasOgTitle = true;
          if (propAttr === 'og:description' && content) state.hasOgDescription = true;
          if (propAttr === 'og:image' && content) { state.hasOgImage = true; state.ogImageUrl = content; }
          if (propAttr === 'og:url' && content) state.hasOgUrl = true;
          if (nameAttr === 'twitter:card' && content) state.hasTwitterCard = true;
          if (nameAttr === 'twitter:image' && content) state.hasTwitterImage = true;
        }

        if (tag === 'link') {
          const rel = (attrs.rel || '').toLowerCase();
          if (rel === 'canonical' && attrs.href) { state.hasCanonical = true; state.canonicalUrl = attrs.href; }
          if (rel === 'alternate' && attrs.hreflang) state.hasHreflang = true;
        }

        // data-nosnippet attribute on any element
        if (attrs['data-nosnippet'] !== undefined) state.hasDataNosnippet = true;

        if (tag === 'body') state.inBody = true;
        if (tag === 'style') state.inStyle = true;

        // Track internal/external links
        if (tag === 'a' && attrs.href) {
          const href = attrs.href;
          if (href.startsWith('http://') || href.startsWith('https://')) {
            state.externalLinks.push(href);
          } else if (href.startsWith('/') || href.startsWith('./') || (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'))) {
            state.internalLinks.push(href);
          }
        }

        // Heading tracking
        const headingMatch = tag.match(/^h([1-6])$/);
        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          state.headingLevels.push(level);
          if (level === 1) { state.h1Count++; state.inH1 = true; state.currentH1Text = ''; }
          if (level === 2) {
            state.inH2 = true;
            state.currentH2Text = '';
          }
        }

        // Semantic HTML landmarks
        if (tag === 'main') state.hasMain = true;
        if (tag === 'nav') state.hasNav = true;
        if (tag === 'footer') state.hasFooter = true;
        if (tag === 'article') state.hasArticle = true;

        if (tag === 'img') {
          const alt = attrs.alt;
          if (alt === undefined || alt === null) {
            state.imagesWithoutAlt++;
          }
          if (!attrs.width || !attrs.height) {
            state.imagesWithoutDimensions++;
          }
        }

        if (tag === 'script') {
          state.inScript = true;
          state.scriptType = (attrs.type || '').toLowerCase();
          state.scriptContent = '';
          // Detect analytics from script src
          const src = (attrs.src || '').toLowerCase();
          if (src.includes('googletagmanager.com') || src.includes('gtag/js') || src.includes('google-analytics.com')) {
            state.hasAnalytics = true; state.analyticsProvider = 'google-analytics';
          } else if (src.includes('plausible.io')) {
            state.hasAnalytics = true; state.analyticsProvider = 'plausible';
          } else if (src.includes('posthog')) {
            state.hasAnalytics = true; state.analyticsProvider = 'posthog';
          } else if (src.includes('amplitude')) {
            state.hasAnalytics = true; state.analyticsProvider = 'amplitude';
          } else if (src.includes('mixpanel')) {
            state.hasAnalytics = true; state.analyticsProvider = 'mixpanel';
          } else if (src.includes('segment')) {
            state.hasAnalytics = true; state.analyticsProvider = 'segment';
          } else if (src.includes('hotjar')) {
            state.hasAnalytics = true; state.analyticsProvider = 'hotjar';
          } else if (src.includes('clarity.ms') || src.includes('clarity.microsoft')) {
            state.hasAnalytics = true; state.analyticsProvider = 'microsoft-clarity';
          } else if (src.includes('fathom')) {
            state.hasAnalytics = true; state.analyticsProvider = 'fathom';
          } else if (src.includes('umami')) {
            state.hasAnalytics = true; state.analyticsProvider = 'umami';
          }
        }
      },

      ontext(text) {
        if (state.inTitle && text.trim()) {
          state.hasTitle = true;
          state.titleText += text;
        }
        if (state.inH1) {
          state.currentH1Text += text;
        }
        if (state.inH2) {
          state.currentH2Text += text;
        }
        if (state.inBody && !state.inScript && !state.inStyle && text.trim()) {
          const words = text.trim().split(/\s+/).filter(w => w.length > 0);
          state.wordCount += words.length;
        }
        if (state.inScript && state.scriptType === 'application/ld+json') {
          state.scriptContent += text;
        }
        // Detect inline analytics scripts
        if (state.inScript && !state.hasAnalytics && text.length > 10) {
          const t = text.toLowerCase();
          if (t.includes('gtag(') || t.includes('ga(') || t.includes('_gaq')) {
            state.hasAnalytics = true; state.analyticsProvider = 'google-analytics';
          } else if (t.includes('plausible')) {
            state.hasAnalytics = true; state.analyticsProvider = 'plausible';
          } else if (t.includes('posthog.init')) {
            state.hasAnalytics = true; state.analyticsProvider = 'posthog';
          } else if (t.includes('mixpanel.init')) {
            state.hasAnalytics = true; state.analyticsProvider = 'mixpanel';
          }
        }
      },

      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === 'title') {
          state.inTitle = false;
        }
        if (tag === 'h1' && state.inH1) {
          state.h1Text = state.currentH1Text.trim();
          state.inH1 = false;
          state.currentH1Text = '';
        }
        if (tag === 'h2' && state.inH2) {
          state.h2Texts.push(state.currentH2Text.trim());
          state.inH2 = false;
          state.currentH2Text = '';
        }
        if (tag === 'body') state.inBody = false;
        if (tag === 'style') state.inStyle = false;
        if (tag === 'script') {
          if (state.scriptType === 'application/ld+json' && state.scriptContent.trim()) {
            state.jsonLdScripts++;
            state.jsonLdContent.push(state.scriptContent.trim());
          }
          state.inScript = false;
          state.scriptType = '';
          state.scriptContent = '';
        }
      },
    },
    { decodeEntities: true }
  );

  try {
    parser.write(content);
    parser.end();
  } catch {
    return null;
  }

  return state;
}

function checkFileExists(candidates) {
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.F_OK);
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

function scanDirectory(rootDir) {
  const findings = [];
  const absRoot = path.resolve(rootDir);

  // Check if dist/ or build/ contain HTML (pre-rendered sites should be scanned)
  const includeOutputDirs = new Set();
  for (const name of MAYBE_SKIP) {
    const candidate = path.join(absRoot, name);
    try {
      if (fs.statSync(candidate).isDirectory() && dirHasHtml(candidate)) {
        includeOutputDirs.add(name);
      }
    } catch { /* doesn't exist */ }
  }

  // Find all HTML files
  let htmlFiles = findHtmlFiles(absRoot, includeOutputDirs);

  // Deduplicate: when both root and dist/build versions exist, keep only dist/build
  // e.g. if both "index.html" and "dist/index.html" exist, drop "index.html"
  const outputDirPrefixes = ['dist/', 'build/'];
  const distBuildFiles = new Set();
  for (const f of htmlFiles) {
    const rel = path.relative(absRoot, f).replace(/\\/g, '/');
    for (const prefix of outputDirPrefixes) {
      if (rel.startsWith(prefix)) {
        distBuildFiles.add(rel.slice(prefix.length)); // e.g. "index.html", "blog/index.html"
      }
    }
  }
  if (distBuildFiles.size > 0) {
    htmlFiles = htmlFiles.filter(f => {
      const rel = path.relative(absRoot, f).replace(/\\/g, '/');
      // If this file is NOT in dist/build, check if a dist/build version exists
      const inOutputDir = outputDirPrefixes.some(p => rel.startsWith(p));
      if (!inOutputDir && distBuildFiles.has(rel)) {
        return false; // drop root version, keep dist/build version
      }
      return true;
    });
  }

  // Detect backend-only project: has backend framework deps + zero HTML files
  if (htmlFiles.length === 0) {
    const pkgPath = path.join(absRoot, 'package.json');
    let isBackendOnly = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const backendFrameworks = ['hono', 'express', 'fastify', 'koa', 'nest', '@nestjs/core'];
      isBackendOnly = backendFrameworks.some(fw => fw in allDeps);
    } catch { /* no package.json or parse error */ }

    if (isBackendOnly) {
      return {
        files_scanned: 0,
        findings: [],
        scores: { seo: null, geo: null, aeo: null },
        skipped: true,
        reason: 'Backend-only project detected (no HTML files). SEO audit not applicable.',
      };
    }
  }

  // Parse all files first for cross-page analysis
  const pageData = [];
  for (const filePath of htmlFiles) {
    const state = parseHtmlFile(filePath);
    if (!state) continue;
    const relFile = path.relative(absRoot, filePath);
    pageData.push({ relFile, state });
  }

  // Cross-page duplicate detection
  const titleMap = new Map();
  const descMap = new Map();
  for (const { relFile, state } of pageData) {
    if (state.titleText.trim()) {
      const t = state.titleText.trim().toLowerCase();
      if (!titleMap.has(t)) titleMap.set(t, []);
      titleMap.get(t).push(relFile);
    }
    if (state.metaDescriptionText.trim()) {
      const d = state.metaDescriptionText.trim().toLowerCase();
      if (!descMap.has(d)) descMap.set(d, []);
      descMap.get(d).push(relFile);
    }
  }

  // Flag duplicate titles/descriptions (only when multiple pages exist)
  if (pageData.length > 1) {
    for (const [title, files] of titleMap) {
      if (files.length > 1) {
        for (const f of files) {
          findings.push({ file: f, line: 0, severity: 'high', category: 'seo', rule: 'duplicate-title', message: `Duplicate <title> shared with ${files.length - 1} other page(s) — each page needs a unique title` });
        }
      }
    }
    for (const [desc, files] of descMap) {
      if (files.length > 1) {
        for (const f of files) {
          findings.push({ file: f, line: 0, severity: 'high', category: 'seo', rule: 'duplicate-meta-description', message: `Duplicate meta description shared with ${files.length - 1} other page(s) — each page needs unique description` });
        }
      }
    }
  }

  // Cross-page canonical conflict detection
  if (pageData.length > 1) {
    const canonicalMap = new Map(); // canonical URL → [files pointing to it]
    for (const { relFile, state } of pageData) {
      if (state.canonicalUrl) {
        const c = state.canonicalUrl.trim().toLowerCase().replace(/\/$/, '');
        if (!canonicalMap.has(c)) canonicalMap.set(c, []);
        canonicalMap.get(c).push(relFile);
      }
    }
    // Multiple different pages pointing to the same canonical = potential conflict
    for (const [, files] of canonicalMap) {
      if (files.length > 1) {
        for (const f of files) {
          findings.push({ file: f, line: 0, severity: 'high', category: 'seo', rule: 'canonical-conflict', message: `${files.length} pages share the same canonical URL — search engines may ignore the wrong pages` });
        }
      }
    }
    // Page whose canonical points to a different page (self-referencing check)
    for (const { relFile, state } of pageData) {
      if (state.canonicalUrl) {
        const canonical = state.canonicalUrl.trim().toLowerCase();
        const selfPath = '/' + relFile.replace(/\\/g, '/');
        // If canonical doesn't contain the file's own path, it might be pointing elsewhere
        if (!canonical.endsWith(selfPath) && !canonical.endsWith(selfPath.replace(/\.html?$/, '')) && !canonical.endsWith(selfPath.replace(/\/index\.html?$/, '/'))) {
          // Only flag if it's a relative/absolute path pointing to another local file
          const isExternal = canonical.startsWith('http');
          if (!isExternal) {
            findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'canonical-points-elsewhere', message: `Canonical URL "${state.canonicalUrl}" points to a different page — this page may be de-indexed` });
          }
        }
      }
    }
  }

  // Collect all internal link targets for orphan page detection
  const allInternalTargets = new Set();
  for (const { state } of pageData) {
    for (const link of state.internalLinks) {
      allInternalTargets.add(link.replace(/\/$/, '').replace(/^\.\//, '/'));
    }
  }

  // Per-file SEO checks
  for (const { relFile, state } of pageData) {

    // Critical: noindex blocks ALL search engines and AI bots
    if (state.hasNoindex) {
      findings.push({ file: relFile, line: 0, severity: 'critical', category: 'seo', rule: 'has-noindex', message: 'Page has <meta name="robots" content="noindex"> — invisible to ALL search engines and AI bots' });
      findings.push({ file: relFile, line: 0, severity: 'critical', category: 'geo', rule: 'noindex-blocks-ai', message: 'noindex blocks AI crawlers (GPTBot, PerplexityBot, Claude-Web) — page cannot be cited in AI answers. If noindex is intentional (staging, admin, private pages), this is expected.' });
    }

    // Snippet restrictions — Google says more restrictive preview controls can limit AI feature eligibility
    if (state.hasNosnippet) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'has-nosnippet', message: 'Page has nosnippet directive — prevents Google from showing text snippets, AI Overviews, and featured snippets. If intentional (legal, privacy, or competitive reasons), ignore this finding.' });
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'nosnippet-blocks-ai', message: 'nosnippet blocks AI citation — AI search engines cannot extract or cite this page. If nosnippet is intentional, this is expected behavior.' });
    }
    if (state.maxSnippetValue !== null && state.maxSnippetValue >= 0 && state.maxSnippetValue < 160) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'restrictive-max-snippet', message: `max-snippet:${state.maxSnippetValue} limits snippet length and AI feature eligibility. Set to -1 (unlimited) for maximum visibility, or keep if restricting snippets is intentional.` });
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'geo', rule: 'max-snippet-limits-ai', message: `max-snippet:${state.maxSnippetValue} restricts how much content AI engines can extract. If intentional (e.g., protecting premium content), ignore this finding.` });
    }
    if (state.hasDataNosnippet) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'geo', rule: 'data-nosnippet-found', message: 'data-nosnippet attribute found — marked sections will be excluded from search snippets and AI citations. Verify this is intentional.' });
    }

    if (!state.hasTitle) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-title', message: 'No <title> tag found' });
    } else {
      const titleLen = state.titleText.trim().length;
      if (titleLen > 60) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'title-too-long', message: `Title is ${titleLen} chars (max 60) — will be truncated in search results` });
      } else if (titleLen < 20) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'title-too-short', message: `Title is only ${titleLen} chars — too short, missing keywords and context` });
      }
    }
    if (!state.hasMetaDescription) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-meta-description', message: 'No <meta name="description"> found' });
    } else {
      const descLen = state.metaDescriptionText.trim().length;
      if (descLen > 160) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'meta-description-too-long', message: `Meta description is ${descLen} chars (max 160) — will be truncated in SERPs` });
      } else if (descLen < 70) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'meta-description-too-short', message: `Meta description is only ${descLen} chars — aim for 140-160 for best CTR` });
      }
    }
    if (!state.hasViewport) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-viewport', message: 'No <meta name="viewport"> found' });
    }
    if (!state.hasCharset) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-charset', message: 'No charset declaration found' });
    }
    if (!state.hasOgTitle) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-og-title', message: 'No <meta property="og:title"> found' });
    }
    if (!state.hasOgDescription) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-og-description', message: 'No <meta property="og:description"> found' });
    }
    if (!state.hasOgImage) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-og-image', message: 'No <meta property="og:image"> found' });
    }
    if (!state.hasOgUrl) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'seo', rule: 'missing-og-url', message: 'No <meta property="og:url"> found' });
    }
    if (!state.hasTwitterCard) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'seo', rule: 'missing-twitter-card', message: 'No <meta name="twitter:card"> found' });
    }
    if (!state.hasTwitterImage) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'seo', rule: 'missing-twitter-image', message: 'No <meta name="twitter:image"> found — social previews will lack images' });
    }
    if (!state.hasCanonical) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-canonical', message: 'No <link rel="canonical"> found' });
    }
    if (state.h1Count === 0) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-h1', message: 'No <h1> tag found' });
    } else if (state.h1Count > 1) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'multiple-h1', message: `${state.h1Count} <h1> tags found — should be exactly 1` });
    }
    // Check for skipped heading levels (H1 → H3 without H2)
    for (let i = 1; i < state.headingLevels.length; i++) {
      if (state.headingLevels[i] - state.headingLevels[i - 1] > 1) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'skipped-heading-level', message: `Heading level skipped: H${state.headingLevels[i - 1]} → H${state.headingLevels[i]} — hurts content hierarchy` });
        break;
      }
    }
    if (state.imagesWithoutAlt > 0) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'images-missing-alt', message: `${state.imagesWithoutAlt} image(s) missing alt text` });
    }
    if (state.imagesWithoutDimensions > 0) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'images-missing-dimensions', message: `${state.imagesWithoutDimensions} image(s) missing width/height — causes CLS (layout shift)` });
    }
    // Semantic HTML checks
    if (!state.hasMain) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-main-landmark', message: 'No <main> element — hurts accessibility and AI content extraction' });
    }
    if (!state.hasNav) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'seo', rule: 'missing-nav-landmark', message: 'No <nav> element — use semantic navigation for crawlers' });
    }
    if (!state.hasFooter) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'seo', rule: 'missing-footer-landmark', message: 'No <footer> element found' });
    }
    if (state.jsonLdScripts === 0) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-json-ld', message: 'No JSON-LD structured data found' });
    }

    // Thin content detection (pages with <300 words rank poorly)
    if (state.wordCount > 0 && state.wordCount < 300) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'thin-content', message: `Only ${state.wordCount} words on page — thin content ranks poorly (aim for 300+ words)` });
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'thin-content-ai', message: `Only ${state.wordCount} words — AI engines need substantial content to extract and cite` });
    }

    // Internal link analysis
    if (state.internalLinks.length === 0 && pageData.length > 1) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'no-internal-links', message: 'Page has zero internal links — crawlers cannot discover other pages from here' });
    }

    // Orphan page detection (no other page links to this one)
    if (pageData.length > 1) {
      // Strip build output prefixes (dist/, build/) so paths match link targets
      let normalizedFile = relFile.replace(/\\/g, '/');
      normalizedFile = normalizedFile.replace(/^(dist|build)\//, '');
      normalizedFile = '/' + normalizedFile.replace(/index\.html?$/, '').replace(/\.html?$/, '');
      const isLinkedTo = allInternalTargets.has(normalizedFile) ||
        allInternalTargets.has(normalizedFile.replace(/\/$/, '')) ||
        allInternalTargets.has(normalizedFile + '/');
      // Don't flag the main index page as orphan
      const isIndex = relFile === 'index.html' || relFile === 'index.htm' ||
        relFile === 'dist/index.html' || relFile === 'build/index.html';
      if (!isLinkedTo && !isIndex) {
        findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'orphan-page', message: 'Orphan page — no internal links point here, invisible to crawlers' });
      }
    }

    // Hreflang check (only flag if multiple languages detected but no hreflang)
    // We track if ANY page has hreflang; absence is only an issue for international sites
    // For now, just track presence — will use in project-level check below

    // GEO: JSON-LD presence and quality
    if (state.jsonLdScripts === 0) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'geo', rule: 'missing-structured-data', message: 'No JSON-LD structured data — AI engines cannot extract structured facts' });
    }

    const allJsonLd = state.jsonLdContent.join(' ');

    // GEO: Organization schema (critical for brand recognition by AI)
    const hasOrganization = allJsonLd.includes('Organization');
    if (!hasOrganization) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'missing-organization-schema', message: 'No Organization schema — AI engines need this to identify your brand' });
    }

    // GEO: Author/Person schema (E-E-A-T signal for AI trust)
    const hasAuthorSchema = allJsonLd.includes('Person') || allJsonLd.includes('author');
    if (!hasAuthorSchema) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'missing-author-schema', message: 'No Author/Person schema — AI engines use this for E-E-A-T credibility signals' });
    }

    // GEO: Semantic HTML for AI content extraction
    if (!state.hasMain) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'missing-main-for-ai', message: 'No <main> element — AI crawlers use this to identify primary content' });
    }

    // GEO: Question-based H2 headers (AI engines favor "What is", "How does", "Why" patterns)
    if (state.h2Texts.length > 0) {
      const questionPattern = /^(what|how|why|when|where|who|which|can|does|is|are|do|should|will)\b/i;
      const questionH2s = state.h2Texts.filter(t => questionPattern.test(t));
      const questionRatio = questionH2s.length / state.h2Texts.length;
      if (questionRatio === 0) {
        findings.push({ file: relFile, line: 0, severity: 'medium', category: 'geo', rule: 'no-question-headers', message: 'No question-based H2 headers — AI engines favor "What is", "How does", "Why" patterns for citation' });
      } else if (questionRatio < 0.3 && state.h2Texts.length >= 3) {
        findings.push({ file: relFile, line: 0, severity: 'low', category: 'geo', rule: 'few-question-headers', message: `Only ${questionH2s.length}/${state.h2Texts.length} H2s use question format — add more for AI answer eligibility` });
      }
    }

    // AEO: FAQPage schema
    const hasFaqPage = allJsonLd.includes('FAQPage');
    const hasSpeakable = allJsonLd.includes('speakable') || allJsonLd.includes('SpeakableSpecification');
    const hasHowTo = allJsonLd.includes('HowTo');
    const hasArticle = allJsonLd.includes('Article') || allJsonLd.includes('BlogPosting') || allJsonLd.includes('NewsArticle');

    // Analytics tracking check
    if (!state.hasAnalytics) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'no-analytics', message: 'No analytics tracking detected (GA4, Plausible, PostHog, etc.) — you cannot measure traffic or conversions' });
    }

    if (!hasFaqPage) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'aeo', rule: 'missing-faqpage-schema', message: 'No FAQPage schema — missed opportunity for featured snippets and voice answers' });
    }
    if (!hasSpeakable) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'aeo', rule: 'missing-speakable-schema', message: 'No speakable schema — voice assistants cannot identify readable content' });
    }
    if (!hasHowTo && !hasArticle) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'aeo', rule: 'missing-content-schema', message: 'No HowTo/Article/BlogPosting schema — add for rich result eligibility' });
    }
  }

  // Project-level checks (only when HTML files exist — backend projects don't need these)
  if (htmlFiles.length > 0) {
  const robotsCandidates = [
    path.join(absRoot, 'robots.txt'),
    path.join(absRoot, 'public', 'robots.txt'),
  ];
  const sitemapCandidates = [
    path.join(absRoot, 'sitemap.xml'),
    path.join(absRoot, 'public', 'sitemap.xml'),
  ];
  const llmsCandidates = [
    path.join(absRoot, 'llms.txt'),
    path.join(absRoot, 'public', 'llms.txt'),
  ];
  const faviconCandidates = [
    path.join(absRoot, 'favicon.ico'),
    path.join(absRoot, 'public', 'favicon.ico'),
  ];

  if (!checkFileExists(robotsCandidates)) {
    findings.push({ file: 'robots.txt', line: 0, severity: 'high', category: 'seo', rule: 'missing-robots-txt', message: 'No robots.txt found in root or public/' });
    findings.push({ file: 'robots.txt', line: 0, severity: 'high', category: 'geo', rule: 'missing-robots-ai-access', message: 'No robots.txt — cannot verify AI bot access (GPTBot, PerplexityBot, Claude-Web)' });
  } else {
    // Check robots.txt content for AI bot access
    let robotsContent = '';
    for (const candidate of robotsCandidates) {
      try {
        robotsContent = fs.readFileSync(candidate, 'utf8');
        break;
      } catch { /* continue */ }
    }
    if (robotsContent) {
      const robotsLower = robotsContent.toLowerCase();

      // Check which AI bots are mentioned
      const hasGptBot = robotsLower.includes('gptbot');
      const hasPerplexityBot = robotsLower.includes('perplexitybot');
      const hasClaudeWeb = robotsLower.includes('claude-web') || robotsLower.includes('claudebot');
      const hasGoogleExtended = robotsLower.includes('google-extended');
      const hasCCBot = robotsLower.includes('ccbot');

      // Check if AI bots are explicitly blocked
      const botBlockPattern = (botName) => new RegExp(`user-agent:\\s*${botName}[\\s\\S]*?disallow:\\s*\\/`, 'im');
      const gptBotBlocked = botBlockPattern('gptbot').test(robotsContent);
      const perplexityBlocked = botBlockPattern('perplexitybot').test(robotsContent);
      const claudeWebBlocked = botBlockPattern('claude-web|claudebot').test(robotsContent);
      const googleExtBlocked = botBlockPattern('google-extended').test(robotsContent);

      // No AI bot rules at all
      if (!hasGptBot && !hasPerplexityBot && !hasClaudeWeb && !hasGoogleExtended) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'no-ai-bot-rules', message: 'No AI bot rules in robots.txt — explicitly allow GPTBot, PerplexityBot, Claude-Web for AI search visibility' });
      }

      // Individual bot blocks
      if (gptBotBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'gptbot-blocked', message: 'GPTBot is blocked — ChatGPT Search cannot cite your content. Verify this aligns with your content licensing and privacy policy.' });
      }
      if (perplexityBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'perplexitybot-blocked', message: 'PerplexityBot is blocked — Perplexity cannot cite your content. If this is a deliberate content protection decision, ignore this finding.' });
      }
      if (claudeWebBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'claudeweb-blocked', message: 'Claude-Web/ClaudeBot is blocked — Anthropic AI cannot cite your content. If this is a deliberate content protection decision, ignore this finding.' });
      }
      if (googleExtBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'google-extended-blocked', message: 'Google-Extended is blocked — content excluded from Google AI Overviews and Gemini. This may be intentional to prevent AI training while keeping regular search.' });
      }

      // Check if sitemap is referenced in robots.txt
      if (!robotsLower.includes('sitemap:')) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'seo', rule: 'robots-missing-sitemap-ref', message: 'robots.txt has no Sitemap: directive — AI bots use this to discover all pages' });
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'robots-no-sitemap-for-ai', message: 'No Sitemap: in robots.txt — AI crawlers may miss pages without explicit sitemap reference' });
      }

      // Informational: CCBot status
      if (hasCCBot) {
        const ccBotBlocked = botBlockPattern('ccbot').test(robotsContent);
        if (ccBotBlocked) {
          findings.push({ file: 'robots.txt', line: 0, severity: 'low', category: 'geo', rule: 'ccbot-blocked', message: 'CCBot is blocked — Common Crawl data (used by many AI training sets) excluded. This is fine if intentional.' });
        }
      }
    }
  }
  if (!checkFileExists(sitemapCandidates)) {
    findings.push({ file: 'sitemap.xml', line: 0, severity: 'high', category: 'seo', rule: 'missing-sitemap', message: 'No sitemap.xml found in root or public/' });
  }
  if (!checkFileExists(faviconCandidates)) {
    findings.push({ file: 'favicon.ico', line: 0, severity: 'medium', category: 'seo', rule: 'missing-favicon', message: 'No favicon.ico found in root or public/' });
  }

  const hasLlms = checkFileExists(llmsCandidates);
  if (!hasLlms) {
    findings.push({ file: 'llms.txt', line: 0, severity: 'medium', category: 'geo', rule: 'missing-llms-txt', message: 'No llms.txt found — AI crawlers cannot understand site structure' });
    findings.push({ file: 'llms.txt', line: 0, severity: 'high', category: 'aeo', rule: 'missing-llms-txt-aeo', message: 'No llms.txt found — required for AEO (Answer Engine Optimization)' });
  }
  } // end project-level checks (htmlFiles.length > 0)

  // Scoring: null when no HTML files found, calculated otherwise
  let scores;
  if (htmlFiles.length === 0) {
    scores = { seo: null, geo: null, aeo: null };
  } else {
    const severityDeductions = { critical: 20, high: 10, medium: 5, low: 2, info: 0 };
    scores = { seo: 100, geo: 100, aeo: 100 };

    for (const finding of findings) {
      const deduction = severityDeductions[finding.severity] ?? 0;
      if (finding.category in scores) {
        scores[finding.category] = Math.max(0, scores[finding.category] - deduction);
      }
    }
  }

  return {
    files_scanned: htmlFiles.length,
    findings,
    scores,
  };
}

const rootDir = process.argv[2] || '.';
const result = scanDirectory(rootDir);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
