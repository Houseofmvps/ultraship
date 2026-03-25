#!/usr/bin/env node
// Ultraship standalone CLI — run audits without Claude Code
// Usage: npx ultraship <command> [path]

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, '..', 'tools');

const COMMANDS = {
  seo: { tool: 'seo-scanner.mjs', desc: 'Run SEO/GEO/AEO audit' },
  security: { tool: 'secret-scanner.mjs', desc: 'Scan for leaked secrets' },
  perf: { tool: 'bundle-tracker.mjs', desc: 'Analyze bundle size' },
  health: { tool: 'health-check.mjs', desc: 'Check production URL health' },
  content: { tool: 'content-scorer.mjs', desc: 'Score content quality' },
  env: { tool: 'env-validator.mjs', desc: 'Validate environment variables' },
  deps: { tool: 'dep-doctor.mjs', desc: 'Find unused/outdated dependencies' },
  og: { tool: 'og-validator.mjs', desc: 'Validate Open Graph tags' },
  redirects: { tool: 'redirect-checker.mjs', desc: 'Check redirect chains' },
  profile: { tool: 'code-profiler.mjs', desc: 'Find performance anti-patterns' },
  migrations: { tool: 'migration-checker.mjs', desc: 'Check pending migrations' },
};

const args = process.argv.slice(2);
const command = args[0];
const target = args[1] || process.cwd();

function getVersion() {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  return pkg.version;
}

function printHelp() {
  console.log(`
  ultraship v${getVersion()} — Ship production-ready SaaS

  Usage: ultraship <command> [path|url]

  Commands:`);
  for (const [name, { desc }] of Object.entries(COMMANDS)) {
    console.log(`    ${name.padEnd(14)} ${desc}`);
  }
  console.log(`
    version        Show version
    help           Show this help

  Examples:
    ultraship seo .                    Audit current directory for SEO issues
    ultraship security ./my-project    Scan project for leaked secrets
    ultraship health https://myapp.com Check production health
    ultraship deps .                   Find unused dependencies

  Full plugin: claude plugin add ultraship
  Docs: https://github.com/Houseofmvps/ultraship
`);
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === 'version' || command === '--version' || command === '-v') {
  console.log(`ultraship v${getVersion()}`);
  process.exit(0);
}

const cmd = COMMANDS[command];
if (!cmd) {
  console.error(`Unknown command: ${command}\nRun "ultraship help" for available commands.`);
  process.exit(1);
}

const toolPath = join(TOOLS_DIR, cmd.tool);
const resolvedTarget = target.startsWith('http') ? target : resolve(target);

try {
  const output = execFileSync('node', [toolPath, resolvedTarget], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  });

  try {
    const parsed = JSON.parse(output);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    process.stdout.write(output);
  }
} catch (err) {
  if (err.stdout) {
    try {
      const parsed = JSON.parse(err.stdout);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      process.stdout.write(err.stdout);
    }
  }
  if (err.stderr) {
    process.stderr.write(err.stderr);
  }
  process.exit(err.status || 1);
}
