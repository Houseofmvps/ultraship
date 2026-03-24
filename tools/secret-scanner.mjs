#!/usr/bin/env node
// Uses execFileSync (not exec) to avoid shell injection
import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.map',
  '.bin', '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.pdf', '.mp4', '.mp3', '.wav', '.avi',
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

const SECRET_PATTERNS = [
  {
    id: 'aws-access-key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    message: 'AWS access key found',
  },
  {
    id: 'aws-secret-key',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})/g,
    severity: 'critical',
    message: 'AWS secret access key found',
  },
  {
    id: 'stripe-secret-key',
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
    message: 'Stripe live secret key found',
  },
  {
    id: 'stripe-restricted-key',
    regex: /rk_live_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
    message: 'Stripe live restricted key found',
  },
  {
    id: 'openai-api-key',
    regex: /sk-[A-Za-z0-9]{20,}/g,
    severity: 'critical',
    message: 'OpenAI API key found',
  },
  {
    id: 'anthropic-api-key',
    regex: /sk-ant-[A-Za-z0-9_-]{20,}/g,
    severity: 'critical',
    message: 'Anthropic API key found',
  },
  {
    id: 'github-token',
    regex: /gh[pous]_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
    message: 'GitHub token found',
  },
  {
    id: 'private-key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    message: 'Private key found',
  },
  {
    id: 'jwt-secret',
    regex: /(?:jwt_secret|JWT_SECRET|jwt_key)\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
    severity: 'high',
    message: 'JWT secret found',
  },
  {
    id: 'database-url-with-password',
    regex: /(?:postgres|mysql|mongodb):\/\/[^:]+:([^@]+)@/g,
    severity: 'critical',
    message: 'Database URL with embedded password found',
  },
  {
    id: 'generic-api-key',
    regex: /(?:api_key|apikey|API_KEY)\s*[=:]\s*['"]([A-Za-z0-9_\-]{20,})['"]/gi,
    severity: 'high',
    message: 'Generic API key found',
  },
  {
    id: 'generic-secret',
    regex: /(?:secret|SECRET)\s*[=:]\s*['"]([A-Za-z0-9_\-]{20,})['"]/gi,
    severity: 'medium',
    message: 'Generic secret found',
  },
];

function shouldSkipFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  return SKIP_EXTENSIONS.has(ext) || SKIP_FILES.has(name);
}

function getFilesViaGit(dir) {
  try {
    const output = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' });
    const files = output.trim().split('\n').filter(Boolean).map(f => join(dir, f));
    return files;
  } catch {
    return null;
  }
}

function getFilesRecursive(dir) {
  const results = [];
  function walk(current) {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      if (SKIP_DIRS.has(entry)) continue;
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function redact(match) {
  if (typeof match !== 'string') return '(redacted)';
  return match.slice(0, 8) + '...(redacted)';
}

function scanFile(filePath) {
  const findings = [];

  // Check for committed .env files (skip example/sample/template files)
  const name = basename(filePath);
  const ENV_EXAMPLE_SUFFIXES = ['.example', '.exam', '.sample', '.template', '.defaults'];
  const isEnvFile = name === '.env' || name.startsWith('.env.');
  const isExampleEnv = ENV_EXAMPLE_SUFFIXES.some(suffix => name.endsWith(suffix));
  if (isEnvFile && !isExampleEnv) {
    findings.push({
      file: filePath,
      line: 0,
      severity: 'critical',
      pattern: 'committed-env-file',
      match: name,
      message: 'Committed .env file found — may contain secrets',
    });
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    // Binary or unreadable file, skip
    return findings;
  }

  const lines = content.split('\n');

  for (const patternDef of SECRET_PATTERNS) {
    // Reset lastIndex before each file scan (critical for /g patterns)
    patternDef.regex.lastIndex = 0;

    let match;
    while ((match = patternDef.regex.exec(content)) !== null) {
      const matchIndex = match.index;
      // Find line number
      let lineNum = 1;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 for newline
        if (charCount > matchIndex) {
          lineNum = i + 1;
          break;
        }
      }

      findings.push({
        file: filePath,
        line: lineNum,
        severity: patternDef.severity,
        pattern: patternDef.id,
        match: redact(match[0]),
        message: patternDef.message,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        patternDef.regex.lastIndex++;
      }
    }

    // Reset again after use
    patternDef.regex.lastIndex = 0;
  }

  return findings;
}

function main() {
  const dir = process.argv[2] || process.cwd();

  let files = getFilesViaGit(dir);

  if (!files) {
    files = getFilesRecursive(dir);
  }

  const filteredFiles = files.filter(f => !shouldSkipFile(f));

  let filesScanned = 0;
  const allFindings = [];

  for (const file of filteredFiles) {
    const findings = scanFile(file);
    filesScanned++;
    allFindings.push(...findings);
  }

  const result = {
    files_scanned: filesScanned,
    findings: allFindings,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
