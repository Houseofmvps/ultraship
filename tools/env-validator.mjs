#!/usr/bin/env node
// tools/env-validator.mjs
// Validates required env vars are set by comparing .env.example to actual environment
// Usage: node tools/env-validator.mjs <project-directory>

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)/);
    if (match) {
      const key = match[1];
      let value = match[3].trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  }
  return vars;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    output({ error: 'Usage: node env-validator.mjs <project-directory>', success: false });
    process.exit(0);
  }

  // Find example env files
  const exampleNames = ['.env.example', '.env.sample', '.env.template', '.env.defaults'];
  let exampleFile = null;
  for (const name of exampleNames) {
    const p = join(dir, name);
    if (existsSync(p)) {
      exampleFile = p;
      break;
    }
  }

  if (!exampleFile) {
    output({
      success: true,
      warning: 'No .env.example file found. Cannot validate required environment variables.',
      suggestion: 'Create a .env.example file listing all required env vars with placeholder values.',
      findings: [],
    });
    process.exit(0);
  }

  const requiredVars = parseEnvFile(exampleFile);
  const requiredKeys = Object.keys(requiredVars);

  if (requiredKeys.length === 0) {
    output({ success: true, message: 'No variables found in example file.', findings: [] });
    process.exit(0);
  }

  // Check actual .env file
  const envFile = join(dir, '.env');
  const envLocalFile = join(dir, '.env.local');
  let actualVars = {};

  if (existsSync(envLocalFile)) {
    actualVars = { ...actualVars, ...parseEnvFile(envLocalFile) };
  }
  if (existsSync(envFile)) {
    actualVars = { ...actualVars, ...parseEnvFile(envFile) };
  }

  // Merge with process.env (runtime env vars take precedence)
  for (const key of requiredKeys) {
    if (process.env[key] !== undefined) {
      actualVars[key] = process.env[key];
    }
  }

  const findings = [];
  const missing = [];
  const empty = [];
  const placeholder = [];
  const set = [];

  for (const key of requiredKeys) {
    const exampleValue = requiredVars[key];
    const actualValue = actualVars[key];

    if (actualValue === undefined) {
      missing.push(key);
      findings.push({
        variable: key,
        status: 'missing',
        severity: 'critical',
        message: `${key} is required but not set in .env or environment`,
        example_value: exampleValue || '(no example provided)',
      });
    } else if (actualValue === '') {
      empty.push(key);
      findings.push({
        variable: key,
        status: 'empty',
        severity: 'high',
        message: `${key} is set but empty`,
      });
    } else if (actualValue === exampleValue && isPlaceholder(exampleValue)) {
      placeholder.push(key);
      findings.push({
        variable: key,
        status: 'placeholder',
        severity: 'high',
        message: `${key} still has its placeholder value — update it with the real value`,
      });
    } else {
      set.push(key);
    }
  }

  // Check .gitignore includes .env
  const gitignorePath = join(dir, '.gitignore');
  let envInGitignore = false;
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, 'utf8');
    envInGitignore = gitignore.split('\n').some(line => {
      const t = line.trim();
      return t === '.env' || t === '.env*' || t === '.env.local';
    });
  }

  if (!envInGitignore) {
    findings.push({
      variable: '.env',
      status: 'gitignore_missing',
      severity: 'critical',
      message: '.env is not in .gitignore — secrets may be committed',
    });
  }

  output({
    success: true,
    example_file: basename(exampleFile),
    total_required: requiredKeys.length,
    set: set.length,
    missing: missing.length,
    empty: empty.length,
    placeholder: placeholder.length,
    env_in_gitignore: envInGitignore,
    deploy_ready: missing.length === 0 && empty.length === 0 && placeholder.length === 0,
    findings,
  });
}

function isPlaceholder(value) {
  if (!value) return false;
  const v = value.toLowerCase();
  return (
    v.includes('your_') || v.includes('xxx') || v.includes('placeholder') ||
    v.includes('change_me') || v.includes('todo') || v.includes('replace') ||
    v.includes('your-') || v === 'sk-...' || v === 'pk_...' ||
    v.match(/^[a-z_]+_here$/i) !== null
  );
}

main();
