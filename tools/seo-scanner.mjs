#!/usr/bin/env node
import { Parser } from 'htmlparser2';
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build']);

function findHtmlFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...findHtmlFiles(path.join(dir, entry.name)));
      }
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function parseHtmlFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const state = {
    hasTitle: false,
    hasMetaDescription: false,
    hasViewport: false,
    hasCharset: false,
    hasOgTitle: false,
    hasOgDescription: false,
    hasOgImage: false,
    hasOgUrl: false,
    hasTwitterCard: false,
    hasTwitterImage: false,
    hasCanonical: false,
    h1Count: 0,
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
    jsonLdScripts: 0,
    jsonLdContent: [],
    inScript: false,
    scriptType: '',
    scriptContent: '',
    inTitle: false,
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

          if (nameAttr === 'description' && content) state.hasMetaDescription = true;
          if (nameAttr === 'viewport') state.hasViewport = true;
          if (charset || httpEquiv === 'content-type') state.hasCharset = true;
          if (propAttr === 'og:title' && content) state.hasOgTitle = true;
          if (propAttr === 'og:description' && content) state.hasOgDescription = true;
          if (propAttr === 'og:image' && content) state.hasOgImage = true;
          if (propAttr === 'og:url' && content) state.hasOgUrl = true;
          if (nameAttr === 'twitter:card' && content) state.hasTwitterCard = true;
          if (nameAttr === 'twitter:image' && content) state.hasTwitterImage = true;
        }

        if (tag === 'link') {
          const rel = (attrs.rel || '').toLowerCase();
          if (rel === 'canonical' && attrs.href) state.hasCanonical = true;
        }

        // Heading tracking
        const headingMatch = tag.match(/^h([1-6])$/);
        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          state.headingLevels.push(level);
          if (level === 1) state.h1Count++;
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
        }
      },

      ontext(text) {
        if (state.inTitle && text.trim()) {
          state.hasTitle = true;
        }
        if (state.inH2) {
          state.currentH2Text += text;
        }
        if (state.inScript && state.scriptType === 'application/ld+json') {
          state.scriptContent += text;
        }
      },

      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === 'title') {
          state.inTitle = false;
        }
        if (tag === 'h2' && state.inH2) {
          state.h2Texts.push(state.currentH2Text.trim());
          state.inH2 = false;
          state.currentH2Text = '';
        }
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

  // Find all HTML files
  const htmlFiles = findHtmlFiles(absRoot);

  // Per-file SEO checks
  for (const filePath of htmlFiles) {
    const state = parseHtmlFile(filePath);
    if (!state) continue;

    const relFile = path.relative(absRoot, filePath);

    if (!state.hasTitle) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-title', message: 'No <title> tag found' });
    }
    if (!state.hasMetaDescription) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-meta-description', message: 'No <meta name="description"> found' });
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

  // Project-level checks
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
      const hasGptBot = robotsLower.includes('gptbot');
      const hasPerplexityBot = robotsLower.includes('perplexitybot');

      // Check if AI bots are explicitly blocked
      const gptBotBlocked = /user-agent:\s*gptbot[\s\S]*?disallow:\s*\//im.test(robotsContent);
      const perplexityBlocked = /user-agent:\s*perplexitybot[\s\S]*?disallow:\s*\//im.test(robotsContent);

      if (!hasGptBot && !hasPerplexityBot) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'medium', category: 'geo', rule: 'no-ai-bot-rules', message: 'No AI bot rules in robots.txt — explicitly allow GPTBot/PerplexityBot for GEO visibility' });
      }
      if (gptBotBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'high', category: 'geo', rule: 'gptbot-blocked', message: 'GPTBot is blocked in robots.txt — ChatGPT cannot cite your content' });
      }
      if (perplexityBlocked) {
        findings.push({ file: 'robots.txt', line: 0, severity: 'high', category: 'geo', rule: 'perplexitybot-blocked', message: 'PerplexityBot is blocked in robots.txt — Perplexity cannot cite your content' });
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

  // Scoring
  const severityDeductions = { critical: 20, high: 10, medium: 5, low: 2, info: 0 };
  const scores = { seo: 100, geo: 100, aeo: 100 };

  for (const finding of findings) {
    const deduction = severityDeductions[finding.severity] ?? 0;
    if (finding.category in scores) {
      scores[finding.category] = Math.max(0, scores[finding.category] - deduction);
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
