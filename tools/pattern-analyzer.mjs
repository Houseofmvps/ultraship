#!/usr/bin/env node
// tools/pattern-analyzer.mjs
// Learn From the Best — analyzes codebase patterns and compares two projects
// Usage: node tools/pattern-analyzer.mjs <source-directory> [--compare=<your-directory>]
// Safe: reads files and git history only, no network, no writes

import { readFileSync, existsSync, readdirSync, statSync as fStatSync } from 'fs';
import { join, extname, relative } from 'path';
import { execFileSync } from 'child_process';
import { checkFileSize } from './lib/security.mjs';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.vercel', 'coverage', '.output']);

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function gitCmd(args, dir) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 }).trim(); } catch { return ''; }
}

function walkFiles(dir, maxFiles = 2000) {
  const files = [];
  function walk(d, depth) {
    if (depth > 10 || files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= maxFiles) return;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (CODE_EXTS.has(extname(e.name))) files.push(full);
    }
  }
  walk(dir, 0);
  return files;
}

// ---------------------------------------------------------------------------
// Analyze a single project
// ---------------------------------------------------------------------------
function analyzeProject(dir) {
  const files = walkFiles(dir);
  const pkg = readJSON(join(dir, 'package.json'));
  const allDeps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  // Structure
  let topDirs;
  try { topDirs = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')).map(e => e.name); } catch { topDirs = []; }
  const srcDir = existsSync(join(dir, 'src')) ? 'src/' : '';
  const hasFeatDirs = topDirs.some(d => /features|modules|domains/i.test(d));
  const hasLayerDirs = topDirs.some(d => /routes|controllers|models|services|utils/i.test(d));
  const structureType = hasFeatDirs ? 'feature-based' : hasLayerDirs ? 'layer-based' : 'hybrid';

  // Naming convention
  const fileNames = files.map(f => relative(dir, f).split('/').pop().replace(extname(f), ''));
  const kebabCount = fileNames.filter(f => /^[a-z]+(-[a-z]+)+$/.test(f)).length;
  const camelCount = fileNames.filter(f => /^[a-z]+[A-Z]/.test(f)).length;
  const pascalCount = fileNames.filter(f => /^[A-Z][a-z]+[A-Z]/.test(f)).length;
  const namingConvention = kebabCount >= camelCount && kebabCount >= pascalCount ? 'kebab-case' : camelCount >= pascalCount ? 'camelCase' : 'PascalCase';

  // Testing
  const testFramework = allDeps.vitest ? 'vitest' : allDeps.jest ? 'jest' : allDeps.mocha ? 'mocha' : null;
  const testFiles = files.filter(f => /\.(test|spec)\./i.test(f));
  const sourceFiles = files.filter(f => !/\.(test|spec)\./i.test(f) && !/__tests__/i.test(f));
  const testLocation = testFiles.some(f => !/tests?\/|__tests__/i.test(relative(dir, f))) ? 'colocated' : 'separate';
  const testNaming = testFiles.some(f => /\.test\./.test(f)) ? '.test.ts' : '.spec.ts';
  const hasIntegration = files.some(f => /integration|e2e/i.test(f));
  const hasE2E = files.some(f => /e2e|cypress|playwright/i.test(f));
  const hasCoverage = existsSync(join(dir, 'vitest.config.ts')) || existsSync(join(dir, 'jest.config.ts')) || existsSync(join(dir, 'jest.config.js'));

  // Error handling
  let customErrorClasses = 0;
  let tryCatchCount = 0;
  let errorMiddleware = false;
  let resultPattern = false;
  let globalHandler = false;

  for (const file of files.slice(0, 500)) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    customErrorClasses += (content.match(/class\s+\w+Error\s+extends/g) || []).length;
    tryCatchCount += (content.match(/\btry\s*\{/g) || []).length;
    if (/err,\s*req,\s*res,\s*next|error.*middleware/i.test(content)) errorMiddleware = true;
    if (/Result<|Either<|Ok\(|Err\(|\.isOk\(|\.isErr\(/i.test(content)) resultPattern = true;
    if (/process\.on\(['"]uncaught|process\.on\(['"]unhandled/i.test(content)) globalHandler = true;
  }

  // Code quality
  let totalLines = 0;
  let maxFileLength = 0;
  let filesOver300 = 0;
  let namedExports = 0;
  let defaultExports = 0;
  let barrelFiles = 0;

  for (const file of files.slice(0, 500)) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lineCount = content.split('\n').length;
    totalLines += lineCount;
    if (lineCount > maxFileLength) maxFileLength = lineCount;
    if (lineCount > 300) filesOver300++;
    namedExports += (content.match(/\bexport\s+(const|function|class|type|interface)\b/g) || []).length;
    defaultExports += (content.match(/\bexport\s+default\b/g) || []).length;
    if (/index\.(ts|js|tsx|jsx)$/.test(file) && /^export\s+/m.test(content) && content.split('\n').filter(l => l.trim() && !l.startsWith('export') && !l.startsWith('//') && !l.startsWith('/*')).length < 3) barrelFiles++;
  }

  const avgFileLength = files.length > 0 ? Math.round(totalLines / files.length) : 0;
  const exportStyle = namedExports > defaultExports * 2 ? 'named' : defaultExports > namedExports * 2 ? 'default' : 'mixed';

  // TypeScript
  const tsConfig = readJSON(join(dir, 'tsconfig.json'));
  const strict = tsConfig?.compilerOptions?.strict === true;
  let anyCount = 0, interfaceCount = 0, typeCount = 0, enumCount = 0;
  for (const file of files.filter(f => /\.tsx?$/.test(f)).slice(0, 500)) {
    const sc = checkFileSize(file, fStatSync);
    if (!sc.ok) continue;
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    anyCount += (content.match(/:\s*any\b/g) || []).length;
    interfaceCount += (content.match(/\binterface\s+\w+/g) || []).length;
    typeCount += (content.match(/\btype\s+\w+\s*=/g) || []).length;
    enumCount += (content.match(/\benum\s+\w+/g) || []).length;
  }
  const genericsUsage = files.filter(f => /\.tsx?$/.test(f)).slice(0, 100).filter(f => { try { return /<\w+>/.test(readFileSync(f, 'utf8')); } catch { return false; } }).length;
  const genericsLevel = genericsUsage > 30 ? 'heavy' : genericsUsage > 10 ? 'moderate' : 'light';

  // CI/CD
  const hasGHA = existsSync(join(dir, '.github', 'workflows'));
  const hasGitlab = existsSync(join(dir, '.gitlab-ci.yml'));
  const provider = hasGHA ? 'github-actions' : hasGitlab ? 'gitlab-ci' : 'none';
  const docker = existsSync(join(dir, 'Dockerfile'));
  const dockerCompose = existsSync(join(dir, 'docker-compose.yml')) || existsSync(join(dir, 'docker-compose.yaml'));
  let ciSteps = [];
  if (hasGHA) {
    try {
      const workflows = readdirSync(join(dir, '.github', 'workflows')).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const wf of workflows) {
        const content = readFileSync(join(dir, '.github', 'workflows', wf), 'utf8');
        if (/lint/i.test(content)) ciSteps.push('lint');
        if (/test/i.test(content)) ciSteps.push('test');
        if (/build/i.test(content)) ciSteps.push('build');
        if (/deploy/i.test(content)) ciSteps.push('deploy');
      }
      ciSteps = [...new Set(ciSteps)];
    } catch {}
  }

  // Git
  const commitLog = gitCmd(['log', '--format=%s', '-20'], dir);
  const commits = commitLog.split('\n').filter(Boolean);
  const conventionalCount = commits.filter(c => /^(feat|fix|chore|docs|style|refactor|perf|test|ci|build)(\(.+\))?:/.test(c)).length;
  const conventionalCommits = conventionalCount > commits.length * 0.5;
  const totalCommits = parseInt(gitCmd(['rev-list', '--count', 'HEAD'], dir)) || 0;
  const weeksLog = gitCmd(['log', '--format=%aI', '--since=30 days ago'], dir);
  const weeks = weeksLog.split('\n').filter(Boolean);
  const avgCommitsPerWeek = Math.round(weeks.length / 4.3);
  const contributors = parseInt(gitCmd(['shortlog', '-sn', '--no-merges'], dir).split('\n').filter(Boolean).length) || 1;

  // Dependencies
  const prodDeps = Object.keys(pkg?.dependencies || {}).length;
  const devDeps = Object.keys(pkg?.devDependencies || {}).length;
  const keyLibs = Object.keys(allDeps).filter(d => !d.startsWith('@types/')).slice(0, 15);

  return {
    structure: { type: structureType, top_level_dirs: topDirs, source_dir: srcDir, test_dir: testFiles.length > 0 ? (testLocation === 'colocated' ? 'colocated' : 'tests/') : null, naming_convention: namingConvention },
    testing: { framework: testFramework, location: testLocation, naming: testNaming, test_count: testFiles.length, source_count: sourceFiles.length, ratio: sourceFiles.length > 0 ? Math.round(testFiles.length / sourceFiles.length * 100) / 100 : 0, has_integration_tests: hasIntegration, has_e2e_tests: hasE2E, coverage_config: hasCoverage },
    error_handling: { custom_error_classes: customErrorClasses, error_middleware: errorMiddleware, try_catch_count: tryCatchCount, result_pattern: resultPattern, global_handler: globalHandler },
    code_quality: { avg_file_length: avgFileLength, max_file_length: maxFileLength, files_over_300_lines: filesOver300, export_style: exportStyle, barrel_files: barrelFiles, eslint_config: existsSync(join(dir, '.eslintrc.json')) || existsSync(join(dir, '.eslintrc.js')) || existsSync(join(dir, 'eslint.config.js')), prettier_config: existsSync(join(dir, '.prettierrc')) || existsSync(join(dir, '.prettierrc.json')) || existsSync(join(dir, 'prettier.config.js')) },
    typescript: { strict, any_count: anyCount, interface_count: interfaceCount, type_count: typeCount, enum_count: enumCount, generics_usage: genericsLevel },
    ci_cd: { provider, steps: ciSteps, docker, docker_compose: dockerCompose },
    git: { conventional_commits: conventionalCommits, commit_count: totalCommits, avg_commits_per_week: avgCommitsPerWeek, contributors },
    dependencies: { production: prodDeps, dev: devDeps, total: prodDeps + devDeps, key_libraries: keyLibs },
  };
}

// ---------------------------------------------------------------------------
// Compare two projects
// ---------------------------------------------------------------------------
function compareProjects(source, yours) {
  const differences = [];
  const yourAdvantages = [];

  // Testing
  if (source.testing.framework && !yours.testing.framework) {
    differences.push({ area: 'testing', source: `${source.testing.framework} with ${source.testing.ratio} ratio`, yours: 'No test framework detected', recommendation: `Add ${source.testing.framework} — source project achieves good test coverage` });
  } else if (yours.testing.ratio > source.testing.ratio * 1.5) {
    yourAdvantages.push({ area: 'testing', detail: `Your test ratio (${yours.testing.ratio}) is higher than theirs (${source.testing.ratio})` });
  }

  // TypeScript strictness
  if (source.typescript.strict && !yours.typescript.strict) {
    differences.push({ area: 'typescript', source: `Strict mode, ${source.typescript.any_count} any usages`, yours: `Non-strict, ${yours.typescript.any_count} any usages`, recommendation: 'Enable strict mode in tsconfig.json — reduces runtime bugs significantly' });
  }

  // Error handling
  if (source.error_handling.custom_error_classes > 0 && yours.error_handling.custom_error_classes === 0) {
    differences.push({ area: 'error_handling', source: `${source.error_handling.custom_error_classes} custom error classes + middleware`, yours: 'Try/catch only', recommendation: 'Create custom error classes for consistent API error responses' });
  }

  // CI
  if (source.ci_cd.provider !== 'none' && yours.ci_cd.provider === 'none') {
    differences.push({ area: 'ci_cd', source: `${source.ci_cd.provider} with ${source.ci_cd.steps.join(', ')}`, yours: 'No CI/CD detected', recommendation: 'Add GitHub Actions with lint, test, build steps' });
  }

  // Linting
  if (source.code_quality.eslint_config && !yours.code_quality.eslint_config) {
    differences.push({ area: 'linting', source: 'ESLint configured', yours: 'No ESLint config', recommendation: 'Add ESLint for consistent code style and bug prevention' });
  }

  // File length
  if (yours.code_quality.avg_file_length < source.code_quality.avg_file_length * 0.8) {
    yourAdvantages.push({ area: 'code_quality', detail: `Your average file length (${yours.code_quality.avg_file_length} lines) is shorter than theirs (${source.code_quality.avg_file_length}) — better modularity` });
  }

  // Adoption priority
  const adoptionPriority = differences.map((d, i) => ({
    priority: i + 1,
    pattern: d.recommendation.split(' — ')[0],
    effort: /strict mode|eslint|prettier/i.test(d.recommendation) ? 'low' : /test framework|error class/i.test(d.recommendation) ? 'medium' : 'high',
    impact: /test|strict|ci/i.test(d.area) ? 'high' : 'medium',
  }));

  return { differences, your_advantages: yourAdvantages, adoption_priority: adoptionPriority };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const compareFlag = args.find(a => a.startsWith('--compare='));
  const compareDir = compareFlag ? compareFlag.replace('--compare=', '') : null;

  if (!dir) {
    output({ error: 'Usage: node pattern-analyzer.mjs <source-dir> [--compare=<your-dir>]', success: false });
    process.exit(0);
  }
  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  try {
    const sourcePatterns = analyzeProject(dir);
    let comparison = null;

    if (compareDir && existsSync(compareDir)) {
      const yourPatterns = analyzeProject(compareDir);
      comparison = compareProjects(sourcePatterns, yourPatterns);
    }

    output({
      success: true,
      source_project: dir.split('/').pop(),
      patterns: sourcePatterns,
      comparison,
    });
  } catch (err) {
    output({ error: err.message, success: false });
  }

  process.exit(0);
}

main();
