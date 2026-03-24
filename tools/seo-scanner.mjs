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
    hasCanonical: false,
    h1Count: 0,
    imagesWithoutAlt: 0,
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
        }

        if (tag === 'link') {
          const rel = (attrs.rel || '').toLowerCase();
          if (rel === 'canonical' && attrs.href) state.hasCanonical = true;
        }

        if (tag === 'h1') {
          state.h1Count++;
        }

        if (tag === 'img') {
          const alt = attrs.alt;
          if (alt === undefined || alt === null) {
            state.imagesWithoutAlt++;
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
        if (state.inScript && state.scriptType === 'application/ld+json') {
          state.scriptContent += text;
        }
      },

      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === 'title') {
          state.inTitle = false;
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
    if (!state.hasCanonical) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-canonical', message: 'No <link rel="canonical"> found' });
    }
    if (state.h1Count === 0) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'seo', rule: 'missing-h1', message: 'No <h1> tag found' });
    } else if (state.h1Count > 1) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'multiple-h1', message: `${state.h1Count} <h1> tags found — should be exactly 1` });
    }
    if (state.imagesWithoutAlt > 0) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'images-missing-alt', message: `${state.imagesWithoutAlt} image(s) missing alt text` });
    }
    if (state.jsonLdScripts === 0) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'seo', rule: 'missing-json-ld', message: 'No JSON-LD structured data found' });
    }

    // GEO: JSON-LD presence
    if (state.jsonLdScripts === 0) {
      findings.push({ file: relFile, line: 0, severity: 'high', category: 'geo', rule: 'missing-structured-data', message: 'No JSON-LD structured data — poor GEO signal' });
    }

    // AEO: FAQPage schema
    const allJsonLd = state.jsonLdContent.join(' ');
    const hasFaqPage = allJsonLd.includes('FAQPage');
    const hasSpeakable = allJsonLd.includes('speakable') || allJsonLd.includes('SpeakableSpecification');

    if (!hasFaqPage) {
      findings.push({ file: relFile, line: 0, severity: 'medium', category: 'aeo', rule: 'missing-faqpage-schema', message: 'No FAQPage schema found in JSON-LD' });
    }
    if (!hasSpeakable) {
      findings.push({ file: relFile, line: 0, severity: 'low', category: 'aeo', rule: 'missing-speakable-schema', message: 'No speakable schema found in JSON-LD' });
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
