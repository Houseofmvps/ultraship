#!/usr/bin/env node
// tools/sitemap-generator.mjs
// Usage: node tools/sitemap-generator.mjs <directory> <base-url>

import fs from 'fs';
import path from 'path';
import { findWorkspacePackages } from './lib/monorepo.mjs';

const dir = process.argv[2] || '.';
const baseUrl = (process.argv[3] || 'https://example.com').replace(/\/$/, '');
const absDir = path.resolve(dir);
const today = new Date().toISOString().split('T')[0];

const routes = new Set(['/']);

function shouldSkip(name) {
  return name.startsWith('_') || name === 'api' || name === 'node_modules' || name === '.git';
}

function scanNextApp(appDir, prefix = '') {
  if (!fs.existsSync(appDir)) return;
  const entries = fs.readdirSync(appDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    if (entry.isDirectory()) {
      const segment = entry.name.startsWith('(') ? '' : '/' + entry.name;
      scanNextApp(path.join(appDir, entry.name), prefix + segment);
    } else if (entry.isFile()) {
      const pageFiles = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'];
      if (pageFiles.includes(entry.name)) {
        routes.add(prefix || '/');
      }
    }
  }
}

function scanNextPages(pagesDir, prefix = '') {
  if (!fs.existsSync(pagesDir)) return;
  const entries = fs.readdirSync(pagesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    if (entry.isDirectory()) {
      scanNextPages(path.join(pagesDir, entry.name), prefix + '/' + entry.name);
    } else if (entry.isFile()) {
      const indexFiles = ['index.tsx', 'index.jsx', 'index.ts', 'index.js'];
      const match = entry.name.match(/^(.+)\.(tsx|jsx|ts|js)$/);
      if (match && indexFiles.includes(entry.name)) {
        routes.add(prefix || '/');
      } else if (match && !match[1].startsWith('_')) {
        const slug = match[1];
        if (!slug.startsWith('[') && slug !== '404' && slug !== '500') {
          routes.add(prefix + '/' + slug);
        }
      }
    }
  }
}

function scanStaticHtml(staticDir) {
  if (!fs.existsSync(staticDir)) return;
  const entries = fs.readdirSync(staticDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    if (entry.isDirectory()) {
      scanStaticHtml(path.join(staticDir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const rel = path.relative(staticDir, path.join(staticDir, entry.name));
      const route = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\\/g, '/');
      routes.add(route === '/' ? '/' : route.replace(/\/$/, '') || '/');
    }
  }
}

// Scan all workspace packages in monorepos
const packages = findWorkspacePackages(absDir);
for (const pkgDir of packages) {
  scanNextApp(path.join(pkgDir, 'app'));
  scanNextApp(path.join(pkgDir, 'src', 'app'));
  scanNextPages(path.join(pkgDir, 'pages'));
  scanNextPages(path.join(pkgDir, 'src', 'pages'));

  for (const staticDirName of ['public', 'dist', 'build', 'out']) {
    scanStaticHtml(path.join(pkgDir, staticDirName));
  }
}

const sortedRoutes = Array.from(routes).sort();

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sortedRoutes.map(route => `  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`).join('\n')}
</urlset>`;

const publicDir = path.join(absDir, 'public');
const outDir = fs.existsSync(publicDir) ? publicDir : absDir;
const outPath = path.join(outDir, 'sitemap.xml');

fs.writeFileSync(outPath, xml, 'utf8');

const relPath = path.relative(absDir, outPath);
console.log(JSON.stringify({ path: relPath, urls: sortedRoutes.length, written: true }));
