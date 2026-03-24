#!/usr/bin/env node
// tools/robots-generator.mjs
// Usage: node tools/robots-generator.mjs <directory> <base-url>

import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || '.';
const baseUrl = (process.argv[3] || 'https://example.com').replace(/\/$/, '');
const absDir = path.resolve(dir);

const content = `User-agent: *
Allow: /

# AI Search Bots — Allow for GEO (Generative Engine Optimization)
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

const publicDir = path.join(absDir, 'public');
const outDir = fs.existsSync(publicDir) ? publicDir : absDir;
const outPath = path.join(outDir, 'robots.txt');

fs.writeFileSync(outPath, content, 'utf8');

const relPath = path.relative(absDir, outPath);
console.log(JSON.stringify({ path: relPath, written: true }));
