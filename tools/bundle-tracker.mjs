#!/usr/bin/env node
// tools/bundle-tracker.mjs
// Tracks bundle size and warns on unexpected growth
// Usage: node tools/bundle-tracker.mjs <project-directory> [--save]
// Safe: reads files and optionally writes report, no shell execution

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, relative, extname } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function getFileSize(filePath) {
  return statSync(filePath).size;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024 * 10) / 10}KB`;
  return `${Math.round(bytes / (1024 * 1024) * 10) / 10}MB`;
}

function findBuildOutput(dir) {
  // Detect build output directory
  const candidates = ['dist', 'build', '.next', 'out', '.output', '.vercel/output'];
  for (const d of candidates) {
    const p = join(dir, d);
    if (existsSync(p) && statSync(p).isDirectory()) return { dir: d, path: p };
  }
  return null;
}

function walkFiles(dir, extensions) {
  const files = [];
  function walk(d) {
    try {
      for (const entry of readdirSync(d)) {
        if (entry.startsWith('.')) continue;
        const p = join(d, entry);
        try {
          const s = statSync(p);
          if (s.isDirectory()) walk(p);
          else if (extensions.includes(extname(entry).toLowerCase())) {
            files.push({ path: p, size: s.size });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return files;
}

function analyzeDependencies(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});

  // Check for known heavy dependencies
  const heavyDeps = {
    'moment': { size: '300KB+', alternative: 'dayjs (2KB)' },
    'lodash': { size: '70KB+', alternative: 'lodash-es or individual imports' },
    'jquery': { size: '90KB+', alternative: 'native DOM APIs' },
    'axios': { size: '30KB+', alternative: 'native fetch' },
    'underscore': { size: '30KB+', alternative: 'native Array methods' },
    'core-js': { size: '150KB+', alternative: 'targeted polyfills only' },
    'date-fns': { size: '75KB+ (full)', alternative: 'import only needed functions' },
    'validator': { size: '50KB+', alternative: 'zod or individual checks' },
    'bluebird': { size: '80KB+', alternative: 'native Promises' },
    'request': { size: '50KB+', alternative: 'native fetch or undici' },
  };

  const warnings = [];
  for (const dep of deps) {
    if (heavyDeps[dep]) {
      warnings.push({
        dependency: dep,
        estimated_size: heavyDeps[dep].size,
        alternative: heavyDeps[dep].alternative,
        severity: 'medium',
      });
    }
  }

  return {
    production_deps: deps.length,
    dev_deps: devDeps.length,
    heavy_deps: warnings,
  };
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const shouldSave = args.includes('--save');

  if (!dir) {
    output({ error: 'Usage: node bundle-tracker.mjs <project-directory> [--save]', success: false });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const buildOutput = findBuildOutput(dir);
  const depAnalysis = analyzeDependencies(dir);
  const findings = [];

  let bundleAnalysis = null;

  if (buildOutput) {
    const jsFiles = walkFiles(buildOutput.path, ['.js', '.mjs', '.cjs']);
    const cssFiles = walkFiles(buildOutput.path, ['.css']);
    const imageFiles = walkFiles(buildOutput.path, ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);
    const allFiles = walkFiles(buildOutput.path, ['.js', '.mjs', '.cjs', '.css', '.html', '.htm', '.json', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);

    const totalJsSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
    const totalCssSize = cssFiles.reduce((sum, f) => sum + f.size, 0);
    const totalImageSize = imageFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

    // Find largest JS files
    const largestJs = jsFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(f => ({ file: relative(dir, f.path), size: formatSize(f.size), bytes: f.size }));

    // Source maps check
    const sourceMaps = allFiles.filter(f => f.path.endsWith('.map'));
    const sourceMapSize = sourceMaps.reduce((sum, f) => sum + f.size, 0);

    bundleAnalysis = {
      build_dir: buildOutput.dir,
      total_size: formatSize(totalSize),
      total_bytes: totalSize,
      js: { files: jsFiles.length, size: formatSize(totalJsSize), bytes: totalJsSize },
      css: { files: cssFiles.length, size: formatSize(totalCssSize), bytes: totalCssSize },
      images: { files: imageFiles.length, size: formatSize(totalImageSize), bytes: totalImageSize },
      source_maps: { files: sourceMaps.length, size: formatSize(sourceMapSize), bytes: sourceMapSize },
      largest_js_files: largestJs,
    };

    // Warnings
    if (totalJsSize > 500 * 1024) {
      findings.push({ severity: 'high', message: `Total JS bundle is ${formatSize(totalJsSize)} — target under 500KB for good performance` });
    } else if (totalJsSize > 250 * 1024) {
      findings.push({ severity: 'medium', message: `Total JS bundle is ${formatSize(totalJsSize)} — consider code splitting for bundles over 250KB` });
    }

    // Check for huge individual files
    for (const f of largestJs) {
      if (f.bytes > 200 * 1024) {
        findings.push({ severity: 'high', message: `${f.file} is ${f.size} — split into smaller chunks via dynamic imports` });
      }
    }

    // Source maps in production
    if (sourceMaps.length > 0) {
      findings.push({ severity: 'low', message: `${sourceMaps.length} source map files (${formatSize(sourceMapSize)}) in build output — consider excluding from deployment` });
    }

    // Unoptimized images
    const largeImages = imageFiles.filter(f => f.size > 200 * 1024);
    if (largeImages.length > 0) {
      findings.push({ severity: 'medium', message: `${largeImages.length} images over 200KB in build output — optimize with WebP/AVIF conversion` });
    }
  } else {
    findings.push({ severity: 'info', message: 'No build output directory found (dist/, build/, .next/, out/) — run your build command first' });
  }

  // Heavy dependency warnings
  if (depAnalysis && depAnalysis.heavy_deps.length > 0) {
    for (const dep of depAnalysis.heavy_deps) {
      findings.push({
        severity: dep.severity,
        message: `Heavy dependency: ${dep.dependency} (~${dep.estimated_size}) — consider ${dep.alternative}`,
      });
    }
  }

  // Save report for historical comparison
  const reportData = {
    timestamp: new Date().toISOString(),
    bundle: bundleAnalysis,
    dependencies: depAnalysis,
    findings_count: findings.length,
  };

  let comparison = null;
  const reportsDir = join(dir, '.ultraship/reports');
  const reportFile = join(reportsDir, 'bundle-latest.json');

  if (shouldSave) {
    // Load previous for comparison
    if (existsSync(reportFile)) {
      try {
        const prev = JSON.parse(readFileSync(reportFile, 'utf8'));
        if (prev.bundle && bundleAnalysis) {
          const diff = bundleAnalysis.total_bytes - prev.bundle.total_bytes;
          comparison = {
            previous_size: prev.bundle.total_size,
            current_size: bundleAnalysis.total_size,
            diff_bytes: diff,
            diff_formatted: (diff >= 0 ? '+' : '') + formatSize(Math.abs(diff)),
            grew: diff > 0,
            previous_date: prev.timestamp,
          };

          if (diff > 50 * 1024) {
            findings.push({ severity: 'high', message: `Bundle grew by ${formatSize(diff)} since last check — investigate new dependencies or missing tree-shaking` });
          } else if (diff > 10 * 1024) {
            findings.push({ severity: 'medium', message: `Bundle grew by ${formatSize(diff)} since last check` });
          }
        }
      } catch { /* ignore */ }
    }

    // Save current report
    try {
      mkdirSync(reportsDir, { recursive: true });
      writeFileSync(reportFile, JSON.stringify(reportData, null, 2));

      // Also save timestamped copy
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      writeFileSync(join(reportsDir, `bundle-${ts}.json`), JSON.stringify(reportData, null, 2));
    } catch { /* ignore */ }
  }

  output({
    success: true,
    bundle: bundleAnalysis,
    dependencies: depAnalysis,
    comparison,
    findings,
    report_saved: shouldSave,
  });
}

main();
