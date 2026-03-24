#!/usr/bin/env node
// tools/robots-generator.mjs
// Usage: node tools/robots-generator.mjs <directory> <base-url>

import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || '.';
const baseUrl = (process.argv[3] || 'https://example.com').replace(/\/$/, '');
const absDir = path.resolve(dir);

const content = `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;

const publicDir = path.join(absDir, 'public');
const outDir = fs.existsSync(publicDir) ? publicDir : absDir;
const outPath = path.join(outDir, 'robots.txt');

fs.writeFileSync(outPath, content, 'utf8');

const relPath = path.relative(absDir, outPath);
console.log(JSON.stringify({ path: relPath, written: true }));
