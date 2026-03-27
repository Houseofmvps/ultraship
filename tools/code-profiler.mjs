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

// Files where DB-in-loop patterns are expected and non-critical
function isNonProductionFile(filePath) {
  const rel = filePath.toLowerCase();
  return (
    rel.includes('seed') || rel.includes('fixture') ||
    rel.includes('test') || rel.includes('spec') || rel.includes('__test') ||
    rel.includes('migration') || rel.includes('migrate') ||
    rel.includes('/scripts/') || rel.includes('/demo')
  );
}

// Check if a specific line is inside a seed/demo/test function context
// Scans backwards for the nearest route/function definition and checks for seed keywords
function isInSeedContext(lines, lineIndex) {
  const SEED_KEYWORDS = /seed|demo|populate|fixture|mock|fake|sample|generate.*data|test.*data/i;
  const ROUTE_DEF = /\.(get|post|put|delete|patch|all)\s*\(/;
  const FUNC_DEF = /(?:function|const|let|var)\s+\w+.*(?:=>|\{)|(?:async\s+function)/;

  for (let i = lineIndex; i >= Math.max(0, lineIndex - 500); i--) {
    const line = lines[i];
    // Found a route definition — check if it's seed-related
    if (ROUTE_DEF.test(line)) {
      // Check this line and a few lines around it for seed keywords
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
        if (SEED_KEYWORDS.test(lines[j])) return true;
      }
      return false; // Found a route but not seed-related
    }
    // Check if any line on the way up has clear seed context
    if (SEED_KEYWORDS.test(line) && FUNC_DEF.test(line)) return true;
    // Comment indicating seed context
    if (/^\s*\/\/.*(?:seed|demo|populate|test data)/i.test(line)) return true;
  }
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
  const isNonProd = isNonProductionFile(relPath);

  // === N+1 Query Detection ===
  // Block-based loops: for, for..of, while, forEach/map with braces
  const blockLoopPatterns = [
    /\bfor\s*\(/,
    /\bfor\s+.*\bof\b/,
    /\bwhile\s*\(/,
  ];
  // Callback loops: .forEach(...) and .map(...) — may be braceless arrows
  const callbackLoopPattern = /\.(forEach|map)\s*\(/;

  // Query patterns — must be actual DB calls, not ORM query builder chaining
  const queryPatterns = [
    /\.findOne\s*\(/, /\.findFirst\s*\(/, /\.findUnique\s*\(/,
    /\.find\s*\(/, /\.findMany\s*\(/,
    /\.query\s*\(/, /\.execute\s*\(/,
    /await\s+db\./, /await\s+prisma\./,
  ];

  // Track loops using absolute paren and brace depth
  // Block loops (for/while): tracked by brace depth
  // Callback loops (.map/.forEach): tracked by paren depth
  const blockLoopStack = [];   // each entry: braceDepth when loop was detected
  const callbackLoopStack = []; // each entry: absolute parenDepth at the opening ( of .map(
  let braceDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Detect loops BEFORE counting delimiters on this line
    const isBlockLoop = blockLoopPatterns.some(p => p.test(line));
    const callbackMatch = callbackLoopPattern.test(line);

    if (isBlockLoop) {
      blockLoopStack.push(braceDepth);
    }

    if (callbackMatch) {
      // The callback lives inside the parens of .map(...) or .forEach(...)
      // Record current parenDepth — callback closes when depth returns to this level
      callbackLoopStack.push(parenDepth);
    }

    // Count delimiters on this line
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '(') parenDepth++;
      if (ch === '}') {
        braceDepth--;
        while (blockLoopStack.length > 0 && braceDepth <= blockLoopStack[blockLoopStack.length - 1]) {
          blockLoopStack.pop();
        }
      }
      if (ch === ')') {
        parenDepth--;
        while (callbackLoopStack.length > 0 && parenDepth <= callbackLoopStack[callbackLoopStack.length - 1]) {
          callbackLoopStack.pop();
        }
      }
    }

    // After counting delimiters: check if we're still inside any loop
    // For the CURRENT line, if a callback opened and closed on the same line,
    // it's already been popped. But if the query is on the same line as the .map(),
    // it was inside the callback when the paren depth was higher.
    // Solution: check BEFORE popping. Instead, we check if this line had a callback
    // AND a query pattern — if the .map() opened and the query is inside the parens.
    const insideBlockLoop = blockLoopStack.length > 0;
    const insideCallbackLoop = callbackLoopStack.length > 0;
    // Special case: callback opened AND closed on same line (e.g., ids.map(id => db.find(id)))
    const sameLineCallback = callbackMatch && !insideCallbackLoop;
    const insideAnyLoop = insideBlockLoop || insideCallbackLoop || sameLineCallback;

    if (insideAnyLoop && queryPatterns.some(p => p.test(line))) {
      // Downgrade severity for seed/test/migration files or seed function context
      const inSeedCtx = isNonProd || isInSeedContext(lines, i);
      const severity = inSeedCtx ? 'low' : 'high';
      const suffix = inSeedCtx ? ' (in seed/test context — low priority)' : '';
      findings.push({
        file: relPath, line: i + 1, severity, category: 'n+1',
        message: `Database query inside loop — N+1 pattern detected. Use batch query (findMany/IN clause) instead${suffix}`,
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
      // Skip if the SELECT * is inside a comment (JSX {/* */}, block /* */, or line //)
      const selectMatch = line.match(/SELECT\s+\*/i);
      const selectIdx = selectMatch ? line.indexOf(selectMatch[0]) : -1;
      const beforeSelect = selectIdx >= 0 ? line.slice(0, selectIdx) : '';
      const isInJsxComment = /\{\/\*/.test(beforeSelect) && /\*\/\}/.test(line.slice(selectIdx));
      const isInBlockComment = /\/\*/.test(beforeSelect) && !/\*\//.test(beforeSelect.slice(beforeSelect.lastIndexOf('/*')));
      const isAfterLineComment = /\/\//.test(beforeSelect);
      const isInComment = isInJsxComment || isInBlockComment || isAfterLineComment;
      // Only flag if it looks like an actual SQL query context (inside quotes or template literal)
      const isInSqlContext = /['"`].*SELECT\s+\*/i.test(line) || /SELECT\s+\*.*['"`]/i.test(line);
      if (!isInComment && isInSqlContext) {
        findings.push({
          file: relPath, line: i + 1, severity: 'high', category: 'unbounded',
          message: 'SELECT * without LIMIT — could return entire table',
          code: trimmed.slice(0, 120),
        });
      }
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
          file: relPath, line: lineNum, severity: 'medium', category: 'missing-index',
          message: `Foreign key to ${fkMatch[1]}.${fkMatch[2]} without index — joins will be slow at scale`,
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
            file: relPath, line: lineNum, severity: 'medium', category: 'missing-index',
            message: `Relation field "${field}" without @@index — lookups will be slow at scale`,
            code: relMatch[0].slice(0, 120),
          });
        }
      }
    }
  }

  // === Memory Leak Patterns ===
  // Detect if this file is a one-shot script (not a long-running server)
  const SERVER_PATTERNS = /app\.get\(|app\.listen\(|app\.post\(|Hono\(|createServer|express\(|router\.(get|post|put|delete)\(|\.onRequest\(/;
  const isOneShotScript = (
    relPath.includes('/scripts/') ||
    relPath.includes('cli.') ||
    relPath.includes('/bin/') ||
    relPath.match(/(?:^|\/)cli[./]/)
  ) || !SERVER_PATTERNS.test(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Module-scoped arrays that grow
    if (/^(const|let|var)\s+\w+\s*=\s*\[\s*\]/.test(trimmed) && braceDepth === 0) {
      const varName = trimmed.match(/^(?:const|let|var)\s+(\w+)/)?.[1];
      if (varName && content.includes(`${varName}.push(`)) {
        if (isOneShotScript) {
          findings.push({
            file: relPath, line: i + 1, severity: 'low', category: 'memory-leak',
            message: `Module-scoped array "${varName}" with .push() — grows unbounded (one-shot script, not a server)`,
            code: trimmed.slice(0, 120),
          });
        } else {
          findings.push({
            file: relPath, line: i + 1, severity: 'medium', category: 'memory-leak',
            message: `Module-scoped array "${varName}" with .push() — grows unbounded, memory leak in long-running servers`,
            code: trimmed.slice(0, 120),
          });
        }
      }
    }

    // Event listeners in handlers — but not standard req body parsing patterns
    if (isHandler && (/\.addEventListener\s*\(/.test(line) || /\.on\s*\(\s*['"]/.test(line))) {
      // req.on('data'), req.on('end'), req.on('error') are standard body parsing — not leaks
      const isReqBodyParsing = /\b(req|request|res|response)\s*\.\s*on\s*\(\s*['"](data|end|error|close)['"]/i.test(line);
      if (!isReqBodyParsing) {
        findings.push({
          file: relPath, line: i + 1, severity: 'medium', category: 'memory-leak',
          message: 'Event listener in request handler — may accumulate without cleanup',
          code: trimmed.slice(0, 120),
        });
      }
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
  // Skip scripts/migration/cleanup files — sequential execution is often intentional there
  if (!isNonProd && !relPath.includes('/scripts/') && !relPath.includes('cleanup') && !relPath.includes('migrate')) {
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';
    if (line.startsWith('//') || line.startsWith('*')) continue;

    if (/^(const|let|var)\s+\w+\s*=\s*await\b/.test(line) && /^(const|let|var)\s+\w+\s*=\s*await\b/.test(nextLine)) {
      const firstVar = line.match(/^(?:const|let|var)\s+(\w+)/)?.[1];
      if (firstVar && !nextLine.includes(firstVar)) {
        findings.push({
          file: relPath, line: i + 1, severity: 'low', category: 'sequential-await',
          message: 'Sequential awaits that could run in parallel — consider Promise.all()',
          code: `${line.slice(0, 60)} | ${nextLine.slice(0, 60)}`,
        });
      }
    }
  }
  } // end sequential-await skip guard

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
      low: items.filter(i => i.severity === 'low').length,
    };
  }

  // Deduplicate: same category in same file = one deduction (not N per line)
  let score = 100;
  const seenCatFile = new Set();
  for (const f of allFindings) {
    const key = `${f.category}:${f.file}`;
    const firstInFile = !seenCatFile.has(key);
    seenCatFile.add(key);
    // First finding per category per file gets full deduction, subsequent get half
    const mult = firstInFile ? 1 : 0.5;
    if (f.severity === 'high') score -= 5 * mult;
    else if (f.severity === 'medium') score -= 2 * mult;
    else if (f.severity === 'low') score -= 0.5 * mult;
  }
  score = Math.round(score);

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
