#!/usr/bin/env node
// tools/og-validator.mjs
// Validates Open Graph tags and checks OG image dimensions
// Usage: node tools/og-validator.mjs <project-directory>
// Safe: uses native https/http modules only, no shell execution

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import https from 'https';
import http from 'http';
import { validateUrl, checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const ALWAYS_SKIP = new Set(['node_modules', '.git', '.next', 'coverage', '.cache']);
const MAYBE_SKIP = new Set(['dist', 'build']);

function dirHasHtml(dirPath) {
  try {
    for (const entry of readdirSync(dirPath)) {
      const p = join(dirPath, entry);
      try {
        const s = statSync(p);
        if (s.isFile() && (entry.endsWith('.html') || entry.endsWith('.htm'))) return true;
        if (s.isDirectory() && !entry.startsWith('.') && dirHasHtml(p)) return true;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return false;
}

function findHtmlFiles(dir) {
  const includeOverrides = new Set();
  for (const name of MAYBE_SKIP) {
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory() && dirHasHtml(p)) includeOverrides.add(name);
    } catch { /* skip */ }
  }

  const files = [];
  function walk(d) {
    try {
      for (const entry of readdirSync(d)) {
        if (entry.startsWith('.') || ALWAYS_SKIP.has(entry)) continue;
        if (MAYBE_SKIP.has(entry) && !includeOverrides.has(entry)) continue;
        const p = join(d, entry);
        try {
          const s = statSync(p);
          if (s.isDirectory()) walk(p);
          else if (entry.endsWith('.html') || entry.endsWith('.htm')) files.push(p);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return files;
}

function extractOgTags(html) {
  const tags = {};
  const metaRegex = /<meta\s+[^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*/gi;
  const metaRegex2 = /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*/gi;

  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    tags[match[1].toLowerCase()] = match[2];
  }
  while ((match = metaRegex2.exec(html)) !== null) {
    tags[match[2].toLowerCase()] = match[1];
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) tags['_title'] = titleMatch[1].trim();

  return tags;
}

function checkImageUrl(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl || imageUrl.startsWith('/') || imageUrl.startsWith('./')) {
      resolve({ reachable: null, reason: 'relative_path', url: imageUrl });
      return;
    }

    // Validate URL to prevent SSRF
    const urlCheck = validateUrl(imageUrl);
    if (!urlCheck.valid) {
      resolve({ reachable: false, reason: urlCheck.reason, url: imageUrl });
      return;
    }

    const mod = imageUrl.startsWith('https') ? https : http;
    const req = mod.request(imageUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
      const contentType = res.headers['content-type'] || '';
      const contentLength = parseInt(res.headers['content-length'] || '0', 10);
      resolve({
        reachable: res.statusCode >= 200 && res.statusCode < 400,
        status: res.statusCode,
        content_type: contentType,
        is_image: contentType.startsWith('image/'),
        size_kb: contentLength ? Math.round(contentLength / 1024) : null,
        url: imageUrl,
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ reachable: false, reason: 'timeout', url: imageUrl }); });
    req.on('error', (err) => { resolve({ reachable: false, reason: err.message, url: imageUrl }); });
    req.end();
  });
}

async function validatePage(filePath, relPath, html) {
  const tags = extractOgTags(html);
  const findings = [];

  const required = {
    'og:title': 'Page title for social sharing',
    'og:description': 'Page description for social sharing',
    'og:image': 'Preview image for social sharing (1200x630 recommended)',
    'og:url': 'Canonical URL for this page',
    'og:type': 'Content type (website, article, product)',
  };

  for (const [tag, desc] of Object.entries(required)) {
    if (!tags[tag]) {
      findings.push({
        tag,
        status: 'missing',
        severity: tag === 'og:image' ? 'high' : 'medium',
        message: `Missing ${tag} — ${desc}`,
      });
    }
  }

  if (!tags['twitter:card']) {
    findings.push({ tag: 'twitter:card', status: 'missing', severity: 'medium', message: 'Missing twitter:card — add summary_large_image for best preview' });
  }
  if (!tags['twitter:image'] && !tags['og:image']) {
    findings.push({ tag: 'twitter:image', status: 'missing', severity: 'medium', message: 'No twitter:image or og:image — Twitter/X previews will have no image' });
  }

  const ogTitle = tags['og:title'] || tags['_title'] || '';
  if (ogTitle && ogTitle.length > 60) {
    findings.push({ tag: 'og:title', status: 'too_long', severity: 'low', message: `og:title is ${ogTitle.length} chars (max 60 recommended): "${ogTitle.slice(0, 70)}..."` });
  }

  const ogDesc = tags['og:description'] || '';
  if (ogDesc && ogDesc.length > 200) {
    findings.push({ tag: 'og:description', status: 'too_long', severity: 'low', message: `og:description is ${ogDesc.length} chars (max 200 recommended)` });
  }

  let imageCheck = null;
  const imageUrl = tags['og:image'] || tags['twitter:image'];
  if (imageUrl) {
    imageCheck = await checkImageUrl(imageUrl);
    if (imageCheck.reachable === false) {
      findings.push({ tag: 'og:image', status: 'broken', severity: 'critical', message: `OG image URL is not reachable: ${imageUrl}` });
    } else if (imageCheck.reachable && !imageCheck.is_image) {
      findings.push({ tag: 'og:image', status: 'not_image', severity: 'high', message: `OG image URL does not return an image content type: ${imageCheck.content_type}` });
    } else if (imageCheck.size_kb && imageCheck.size_kb > 500) {
      findings.push({ tag: 'og:image', status: 'too_large', severity: 'medium', message: `OG image is ${imageCheck.size_kb}KB — keep under 500KB for fast loading` });
    }
  }

  return {
    file: relPath,
    tags_found: Object.keys(tags).filter(k => !k.startsWith('_')),
    og_title: tags['og:title'] || null,
    og_description: tags['og:description'] ? tags['og:description'].slice(0, 100) : null,
    og_image: imageUrl || null,
    og_image_check: imageCheck,
    findings,
    score: Math.max(0, 100 - findings.reduce((sum, f) => {
      return sum + (f.severity === 'critical' ? 20 : f.severity === 'high' ? 10 : f.severity === 'medium' ? 5 : 2);
    }, 0)),
  };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    output({ error: 'Usage: node og-validator.mjs <project-directory>', success: false });
    process.exit(0);
  }

  if (!existsSync(target)) {
    output({ error: `Path not found: ${target}`, success: false });
    process.exit(0);
  }

  const htmlFiles = findHtmlFiles(target);
  if (htmlFiles.length === 0) {
    output({ success: true, warning: 'No HTML files found', pages: [] });
    process.exit(0);
  }

  const pages = [];
  for (const file of htmlFiles) {
    const sizeCheck = checkFileSize(file, statSync);
    if (!sizeCheck.ok) continue; // Skip files that are too large or unreadable
    const html = readFileSync(file, 'utf8');
    const relPath = relative(target, file);
    const result = await validatePage(file, relPath, html);
    pages.push(result);
  }

  const totalFindings = pages.reduce((sum, p) => sum + p.findings.length, 0);
  const avgScore = Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length);

  output({
    success: true,
    pages_checked: pages.length,
    total_findings: totalFindings,
    average_score: avgScore,
    social_ready: totalFindings === 0,
    pages,
  });
}

main();
