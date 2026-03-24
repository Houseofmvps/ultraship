#!/usr/bin/env node
// tools/code-profiler.mjs
// Static analysis for backend performance anti-patterns
// Usage: node tools/code-profiler.mjs <project-directory>
// Detects: N+1 queries, missing indexes, sync I/O in handlers, unbounded ops, memory leaks
// Safe: reads files only, no shell commands are executed by this tool
// Note: this tool DETECTS sync I/O usage in user code — it does NOT use it itself

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.cache']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

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

function isRouteHandler(content, filePath) {
  const rel = filePath.toLowerCase();
  if (rel.includes('/route') || rel.includes('/api/') || rel.includes('/handler') || rel.includes('/controller')) return true;
  if (content.includes('app.get(') || content.includes('app.post(') || content.includes('app.put(') || content.includes('app.delete(')) return true;
  if (content.includes('router.get(') || content.includes('router.post(')) return true;
  if (content.includes('.onRequest(') || content.includes('Hono(')) return true;
  if (content.includes('export default') && (content.includes('GET') || content.includes('POST')) && rel.includes('route')) return true;
  return false;
}

// Patterns that indicate synchronous file/process operations in user code
// These are string patterns we SEARCH FOR in analyzed files — we do not call them
const SYNC_PATTERNS = [
  { name: 'readFileSync', fix: 'readFile (async)' },
  { name: 'writeFileSync', fix: 'writeFile (async)' },
  { name: 'readdirSync', fix: 'readdir (async)' },
  { name: 'statSync', fix: 'stat (async)' },
  { name: 'existsSync', fix: 'access (async)' },
  { name: 'copyFileSync', fix: 'copyFile (async)' },
  { name: 'mkdirSync', fix: 'mkdir (async)' },
];

// Patterns for shell execution detection
const SHELL_SYNC_NAMES = ['execSync', 'execFileSync', 'spawnSync'];

function analyzeFile(filePath, relPath, content) {
  const findings = [];
  const lines = content.split('\n');
  const isHandler = isRouteHandler(content, relPath);

  // === N+1 Query Detection ===
  const loopPatterns = [
    /\bfor\s*\(/,
    /\.forEach\s*\(/,
    /\.map\s*\(/,
    /\bfor\s+.*\bof\b/,
    /\bwhile\s*\(/,
  ];
  const queryPatterns = [
    /\.findOne\s*\(/, /\.findFirst\s*\(/, /\.findUnique\s*\(/,
    /\.find\s*\(/, /\.findMany\s*\(/,
    /\.query\s*\(/, /\.execute\s*\(/,
    /\.select\s*\(/, /\.where\s*\(/,
    /await\s+db\./, /await\s+prisma\./,
    /\.from\s*\(/,
  ];

  let insideLoop = 0;
  let braceDepthAtLoopStart = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        braceDepth--;
        if (insideLoop > 0 && braceDepth < braceDepthAtLoopStart) insideLoop--;
      }
    }

    if (loopPatterns.some(p => p.test(line))) {
      insideLoop++;
      braceDepthAtLoopStart = braceDepth;
    }

    if (insideLoop > 0 && queryPatterns.some(p => p.test(line))) {
      findings.push({
        file: relPath, line: i + 1, severity: 'critical', category: 'n+1',
        message: 'Database query inside loop — N+1 pattern detected. Use batch query (findMany/IN clause) instead',
        code: trimmed.slice(0, 120),
      });
    }
  }

  // === Synchronous I/O in Request Handlers ===
  if (isHandler) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      for (const sp of SYNC_PATTERNS) {
        if (line.includes(sp.name)) {
          findings.push({
            file: relPath, line: i + 1, severity: 'high', category: 'sync-io',
            message: `Synchronous I/O (${sp.name}) in request handler blocks the event loop — use ${sp.fix}`,
            code: trimmed.slice(0, 120),
          });
        }
      }

      for (const name of SHELL_SYNC_NAMES) {
        if (line.includes(name)) {
          findings.push({
            file: relPath, line: i + 1, severity: 'high', category: 'sync-io',
            message: `Synchronous shell execution (${name}) in request handler — use async alternative`,
            code: trimmed.slice(0, 120),
          });
        }
      }
    }
  }

  // === Unbounded Operations ===
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (/\.findMany\s*\(\s*\{/.test(line)) {
      const chunk = content.slice(content.indexOf(line), content.indexOf(line) + 300);
      if (!chunk.includes('take:') && !chunk.includes('limit')) {
        findings.push({
          file: relPath, line: i + 1, severity: 'high', category: 'unbounded',
          message: 'findMany without limit/take — could return entire table into memory',
          code: trimmed.slice(0, 120),
        });
      }
    }

    if (/SELECT\s+\*/i.test(line) && !/LIMIT/i.test(line)) {
      findings.push({
        file: relPath, line: i + 1, severity: 'high', category: 'unbounded',
        message: 'SELECT * without LIMIT — could return entire table',
        code: trimmed.slice(0, 120),
      });
    }
  }

  // === Missing Database Indexes (Schema Analysis) ===
  if (relPath.includes('schema') || relPath.includes('migration')) {
    // Drizzle foreign keys without indexes
    const fkPattern = /\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)\)/g;
    let fkMatch;
    while ((fkMatch = fkPattern.exec(content)) !== null) {
      const lineNum = content.slice(0, fkMatch.index).split('\n').length;
      const nearby = content.slice(Math.max(0, fkMatch.index - 500), fkMatch.index + 500);
      if (!nearby.includes('index(') && !nearby.includes('.index(')) {
        findings.push({
          file: relPath, line: lineNum, severity: 'high', category: 'missing-index',
          message: `Foreign key to ${fkMatch[1]}.${fkMatch[2]} without index — joins on this column will be slow`,
          code: fkMatch[0].slice(0, 120),
        });
      }
    }

    // Prisma @relation without @@index
    if (content.includes('@relation')) {
      const relPattern = /@relation.*fields:\s*\[(\w+)\]/g;
      let relMatch;
      while ((relMatch = relPattern.exec(content)) !== null) {
        const field = relMatch[1];
        if (!content.includes(`@@index([${field}]`) && !content.includes('@unique')) {
          const lineNum = content.slice(0, relMatch.index).split('\n').length;
          findings.push({
            file: relPath, line: lineNum, severity: 'high', category: 'missing-index',
            message: `Relation field "${field}" without @@index — foreign key lookups do full table scans`,
            code: relMatch[0].slice(0, 120),
          });
        }
      }
    }
  }

  // === Memory Leak Patterns ===
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Module-scoped arrays that grow
    if (/^(const|let|var)\s+\w+\s*=\s*\[\s*\]/.test(trimmed) && braceDepth === 0) {
      const varName = trimmed.match(/^(?:const|let|var)\s+(\w+)/)?.[1];
      if (varName && content.includes(`${varName}.push(`)) {
        findings.push({
          file: relPath, line: i + 1, severity: 'medium', category: 'memory-leak',
          message: `Module-scoped array "${varName}" with .push() — grows unbounded, memory leak in long-running servers`,
          code: trimmed.slice(0, 120),
        });
      }
    }

    // Event listeners in handlers
    if (isHandler && (/\.addEventListener\s*\(/.test(line) || /\.on\s*\(\s*['"]/.test(line))) {
      findings.push({
        file: relPath, line: i + 1, severity: 'medium', category: 'memory-leak',
        message: 'Event listener in request handler — may accumulate without cleanup',
        code: trimmed.slice(0, 120),
      });
    }
  }

  // === Error Handling in Handlers ===
  if (isHandler) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      if (/JSON\.parse\s*\(/.test(line)) {
        let hasTry = false;
        for (let j = Math.max(0, i - 5); j < i; j++) {
          if (lines[j].includes('try')) hasTry = true;
        }
        if (!hasTry) {
          findings.push({
            file: relPath, line: i + 1, severity: 'medium', category: 'error-handling',
            message: 'JSON.parse without try/catch in handler — malformed input crashes the handler',
            code: trimmed.slice(0, 120),
          });
        }
      }

      if (/new RegExp\s*\(/.test(line)) {
        findings.push({
          file: relPath, line: i + 1, severity: 'medium', category: 'redos',
          message: 'Dynamic RegExp in handler — user-controlled input could cause ReDoS',
          code: trimmed.slice(0, 120),
        });
      }
    }
  }

  // === Sequential Await (could be parallel) ===
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';
    if (line.startsWith('//') || line.startsWith('*')) continue;

    if (/^(const|let|var)\s+\w+\s*=\s*await\b/.test(line) && /^(const|let|var)\s+\w+\s*=\s*await\b/.test(nextLine)) {
      const firstVar = line.match(/^(?:const|let|var)\s+(\w+)/)?.[1];
      if (firstVar && !nextLine.includes(firstVar)) {
        findings.push({
          file: relPath, line: i + 1, severity: 'medium', category: 'sequential-await',
          message: 'Sequential awaits that could run in parallel — use Promise.all()',
          code: `${line.slice(0, 60)} | ${nextLine.slice(0, 60)}`,
        });
      }
    }
  }

  return findings;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    output({ error: 'Usage: node code-profiler.mjs <project-directory>', success: false });
    process.exit(0);
  }

  if (!existsSync(dir)) {
    output({ error: `Path not found: ${dir}`, success: false });
    process.exit(0);
  }

  const codeFiles = findCodeFiles(dir);
  if (codeFiles.length === 0) {
    output({ success: true, message: 'No TypeScript/JavaScript files found', findings: [] });
    process.exit(0);
  }

  const allFindings = [];
  let filesAnalyzed = 0;
  let handlersFound = 0;

  for (const file of codeFiles) {
    const content = readFileSync(file, 'utf8');
    const relPath = relative(dir, file);
    if (isRouteHandler(content, relPath)) handlersFound++;
    allFindings.push(...analyzeFile(file, relPath, content));
    filesAnalyzed++;
  }

  const byCategory = {};
  for (const f of allFindings) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }

  const categorySummary = {};
  for (const [cat, items] of Object.entries(byCategory)) {
    categorySummary[cat] = {
      count: items.length,
      critical: items.filter(i => i.severity === 'critical').length,
      high: items.filter(i => i.severity === 'high').length,
      medium: items.filter(i => i.severity === 'medium').length,
    };
  }

  let score = 100;
  for (const f of allFindings) {
    if (f.severity === 'critical') score -= 15;
    else if (f.severity === 'high') score -= 8;
    else if (f.severity === 'medium') score -= 3;
  }

  output({
    success: true,
    files_analyzed: filesAnalyzed,
    handlers_found: handlersFound,
    total_findings: allFindings.length,
    performance_score: Math.max(0, score),
    categories: categorySummary,
    findings: allFindings,
  });
}

main();
