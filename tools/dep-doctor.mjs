#!/usr/bin/env node
// tools/dep-doctor.mjs
// Detects unused and outdated dependencies
// Usage: node tools/dep-doctor.mjs <project-directory>
// Safe: reads files only for unused detection, no shell execution for that part

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.vue', '.svelte']);

function findCodeFiles(dir) {
  const files = [];
  function walk(d) {
    try {
      for (const entry of readdirSync(d)) {
        if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;
        const p = join(d, entry);
        try {
          const s = statSync(p);
          if (s.isDirectory()) walk(p);
          else if (CODE_EXTS.has(extname(entry).toLowerCase())) files.push(p);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return files;
}

// Dependencies that are used implicitly (config, build tools, type defs)
const IMPLICIT_DEPS = new Set([
  'typescript', '@types/node', '@types/react', '@types/react-dom',
  'eslint', 'prettier', 'vitest', 'jest', 'mocha',
  'tailwindcss', 'autoprefixer', 'postcss',
  'drizzle-kit', 'prisma',
  '@vitejs/plugin-react', 'vite',
  'tsx', 'ts-node', 'nodemon',
  'husky', 'lint-staged', 'commitlint',
  'dotenv', 'cross-env',
]);

// Packages whose import name differs from package name
const IMPORT_ALIASES = {
  'next': ['next', 'next/'],
  '@hono/node-server': ['@hono/node-server'],
  'drizzle-orm': ['drizzle-orm'],
  '@neondatabase/serverless': ['@neondatabase/serverless'],
  'better-auth': ['better-auth'],
  '@anthropic-ai/sdk': ['@anthropic-ai/sdk', 'anthropic'],
  '@clerk/nextjs': ['@clerk/nextjs'],
};

function detectUnusedDeps(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return { unused: [], error: 'No package.json found' };

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const prodDeps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});

  // Read all source files and collect imports
  const codeFiles = findCodeFiles(dir);
  let allCode = '';
  for (const file of codeFiles) {
    try {
      allCode += readFileSync(file, 'utf8') + '\n';
    } catch { /* skip */ }
  }

  // Also check config files at root
  const configFiles = ['vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs',
    'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs',
    'drizzle.config.ts', 'drizzle.config.js', '.eslintrc.js', '.eslintrc.json',
    'tsconfig.json', 'jest.config.js', 'vitest.config.ts'];
  for (const cf of configFiles) {
    const p = join(dir, cf);
    if (existsSync(p)) {
      try { allCode += readFileSync(p, 'utf8') + '\n'; } catch { /* skip */ }
    }
  }

  const unused = [];

  function isUsed(dep) {
    // Implicit deps (build tools, type defs, etc.)
    if (IMPLICIT_DEPS.has(dep)) return true;
    if (dep.startsWith('@types/')) return true;

    // Check aliases
    const aliases = IMPORT_ALIASES[dep] || [dep];
    for (const alias of aliases) {
      if (allCode.includes(`'${alias}'`) || allCode.includes(`"${alias}"`)) return true;
      if (allCode.includes(`'${alias}/`) || allCode.includes(`"${alias}/`)) return true;
      // require() style
      if (allCode.includes(`require('${alias}')`) || allCode.includes(`require("${alias}")`)) return true;
    }

    // Scoped packages — check base import
    if (dep.startsWith('@')) {
      const scope = dep.split('/')[0];
      if (allCode.includes(`'${dep}'`) || allCode.includes(`"${dep}"`)) return true;
      if (allCode.includes(`'${dep}/`) || allCode.includes(`"${dep}/`)) return true;
    }

    // Simple string search as fallback (handles dynamic requires, config references)
    const simpleName = dep.replace(/^@.*\//, '');
    if (allCode.includes(simpleName)) return true;

    return false;
  }

  for (const dep of prodDeps) {
    if (!isUsed(dep)) {
      unused.push({ name: dep, type: 'production', severity: 'high', message: `"${dep}" is in dependencies but not imported anywhere — remove to reduce install size` });
    }
  }

  for (const dep of devDeps) {
    if (!isUsed(dep)) {
      unused.push({ name: dep, type: 'devDependency', severity: 'low', message: `"${dep}" is in devDependencies but not referenced — may be removable` });
    }
  }

  return { unused, total_deps: prodDeps.length, total_dev_deps: devDeps.length };
}

function detectOutdated(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return { outdated: [] };

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const findings = [];

  // Check for pinned versions (no ^ or ~)
  for (const [name, version] of Object.entries(allDeps)) {
    if (typeof version !== 'string') continue;
    const v = version.trim();
    if (v.startsWith('file:') || v.startsWith('link:') || v.startsWith('workspace:') || v === '*' || v === 'latest') continue;

    // Pinned to exact version (no ^ or ~ prefix)
    if (/^\d/.test(v)) {
      findings.push({
        name,
        version: v,
        severity: 'low',
        issue: 'pinned',
        message: `"${name}@${v}" is pinned to exact version — use ^${v} to receive patch updates`,
      });
    }

    // Very old major versions of known packages
    const majorMatch = v.match(/\d+/);
    if (majorMatch) {
      const major = parseInt(majorMatch[0], 10);
      const knownOld = {
        'react': 18, 'next': 14, 'vue': 3, 'express': 4, 'hono': 4,
        'typescript': 5, 'vite': 5, 'tailwindcss': 3, 'eslint': 9,
        'drizzle-orm': 0, 'prisma': 5, 'zod': 3,
      };
      if (knownOld[name] !== undefined && major < knownOld[name] - 1) {
        findings.push({
          name,
          version: v,
          severity: 'medium',
          issue: 'outdated_major',
          message: `"${name}@${v}" is behind by ${knownOld[name] - major}+ major versions — consider upgrading`,
        });
      }
    }
  }

  return { outdated: findings };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    output({ error: 'Usage: node dep-doctor.mjs <project-directory>', success: false });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const unusedResult = detectUnusedDeps(dir);
  const outdatedResult = detectOutdated(dir);

  const allFindings = [...unusedResult.unused, ...outdatedResult.outdated];

  output({
    success: true,
    total_production_deps: unusedResult.total_deps,
    total_dev_deps: unusedResult.total_dev_deps,
    unused_count: unusedResult.unused.length,
    outdated_count: outdatedResult.outdated.length,
    total_findings: allFindings.length,
    unused: unusedResult.unused,
    outdated: outdatedResult.outdated,
  });
}

main();
