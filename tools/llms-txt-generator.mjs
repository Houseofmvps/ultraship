#!/usr/bin/env node
// tools/llms-txt-generator.mjs
// Usage: node tools/llms-txt-generator.mjs <directory>

import fs from 'fs';
import path from 'path';
import { findWorkspacePackages } from './lib/monorepo.mjs';

const dir = process.argv[2] || '.';
const absDir = path.resolve(dir);

// Read package.json from root and all workspace packages
let pkgName = 'Unknown Project';
let pkgDescription = '';
let pkgDeps = new Set();

const packages = findWorkspacePackages(absDir);
for (const pkgDir of packages) {
  const pkgPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // Use root package for name/description
    if (pkgDir === absDir) {
      pkgName = pkg.name || pkgName;
      pkgDescription = pkg.description || pkgDescription;
    }
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const d of Object.keys(allDeps)) pkgDeps.add(d);
  } catch {}
}
pkgDeps = Array.from(pkgDeps);

// Read README.md
let readmeText = '';
for (const readmeName of ['README.md', 'readme.md', 'Readme.md']) {
  const readmePath = path.join(absDir, readmeName);
  if (fs.existsSync(readmePath)) {
    readmeText = fs.readFileSync(readmePath, 'utf8');
    break;
  }
}

// Build llms.txt (concise)
const depLines = pkgDeps.length > 0 ? pkgDeps.map(d => `- ${d}`).join('\n') : '- (none)';

const sections = ['name', 'description', 'stack'].filter((_, i) => {
  if (i === 0) return true; // name always
  if (i === 1) return pkgDescription.length > 0;
  if (i === 2) return pkgDeps.length > 0;
  return false;
});

const llmsTxt = `# ${pkgName}

${pkgDescription || ''}

## Stack
${depLines}
`.trim() + '\n';

// Build llms-full.txt (detailed, includes first 2000 chars of README)
const readmeSnippet = readmeText ? readmeText.slice(0, 2000) : '';
const llmsFullTxt = `# ${pkgName}

${pkgDescription || ''}

## Stack
${depLines}

## Overview
${readmeSnippet || '(No README found)'}
`.trim() + '\n';

// Determine output directory
const publicDir = path.join(absDir, 'public');
const outDir = fs.existsSync(publicDir) ? publicDir : absDir;

const llmsPath = path.join(outDir, 'llms.txt');
const llmsFullPath = path.join(outDir, 'llms-full.txt');

fs.writeFileSync(llmsPath, llmsTxt, 'utf8');
fs.writeFileSync(llmsFullPath, llmsFullTxt, 'utf8');

const relPath = path.relative(absDir, llmsPath);
const relFullPath = path.relative(absDir, llmsFullPath);

// Count non-empty sections in llms.txt
const sectionCount = sections.length;

console.log(JSON.stringify({ path: relPath, full_path: relFullPath, sections: sectionCount, written: true }));
