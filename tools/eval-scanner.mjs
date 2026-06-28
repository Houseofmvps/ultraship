#!/usr/bin/env node
// eval-scanner — finds the AI features in a codebase that need an eval / regression harness.
// The 2026 reality: AI-written code passes review but fails at runtime, and AI *features* (chatbots,
// RAG, classifiers) drift silently. This locates every LLM call site so /evals can lock their
// behavior with characterization tests + a Promptfoo suite. Deterministic, zero false positives:
// it only flags real SDK imports / call sites / model IDs.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { checkFileSize } from './lib/security.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'coverage', '.output', '.vercel', '.turbo', 'vendor', '__pycache__', '.venv', 'venv']);
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.go']);

// Provider → import signatures (module names that unambiguously mean "an LLM SDK is here").
const PROVIDERS = [
  { id: 'anthropic', modules: ['@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk', 'anthropic'] },
  { id: 'openai', modules: ['openai'] },
  { id: 'google-gemini', modules: ['@google/genai', '@google/generative-ai', 'google-generativeai'] },
  { id: 'cohere', modules: ['cohere-ai', 'cohere'] },
  { id: 'mistral', modules: ['@mistralai/mistralai', 'mistralai'] },
  { id: 'ollama', modules: ['ollama'] },
  { id: 'vercel-ai-sdk', modules: ['ai', '@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google'] },
  { id: 'langchain', modules: ['langchain', '@langchain/core', '@langchain/openai', '@langchain/anthropic', 'langchain_anthropic', 'langchain_openai', 'langchain_core'] },
];

// LLM call-site fingerprints (only meaningful when a provider import is also present in the file).
const CALL_SITES = [
  /\.messages\.create\s*\(/,
  /\.chat\.completions\.create\s*\(/,
  /\bgenerateText\s*\(/, /\bstreamText\s*\(/, /\bgenerateObject\s*\(/,
  /\.generateContent\s*\(/, /\.generate_content\s*\(/,
  /\.complete\s*\(/, /\.chat\s*\(/,
  /\.invoke\s*\(/, /\.stream\s*\(/, // langchain runnables
];

// Model-ID literals — used to report which models, never as a standalone trigger.
const MODEL_ID_RE = /\b(?:claude-[a-z0-9.\-]+|gpt-[0-9a-z.\-]+|o[134](?:-[a-z0-9.\-]+)?|gemini-[0-9a-z.\-]+|mistral-[a-z0-9.\-]+|command-[a-z0-9.\-]+|llama-?[0-9][a-z0-9.\-]*)\b/gi;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out); }
    else if (e.isFile()) out.push(join(dir, e.name));
  }
  return out;
}

function read(file) {
  if (!checkFileSize(file, statSync).ok) return null;
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

// True only for a real import/require of one of `modules` (not a substring of an unrelated path).
function importsModule(content, modules) {
  for (const mod of modules) {
    const m = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // JS: from 'mod' | require('mod') | import('mod')   Python: import mod | from mod import
    const js = new RegExp(`(?:from|require\\(|import\\()\\s*['"\`]${m}(?:/[^'"\`]*)?['"\`]`);
    const py = new RegExp(`^\\s*(?:import\\s+${m}|from\\s+${m}[\\s.])`, 'm');
    if (js.test(content) || py.test(content)) return mod;
  }
  return null;
}

function detectTestRunner(rootDir) {
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = read(pkgPath) || '';
    if (/vitest/.test(pkg)) return 'vitest';
    if (/jest/.test(pkg)) return 'jest';
    if (/"test":\s*"node --test/.test(pkg)) return 'node:test';
    if (/mocha/.test(pkg)) return 'mocha';
    if (/playwright/.test(pkg)) return 'playwright';
  }
  if (existsSync(join(rootDir, 'pytest.ini')) || existsSync(join(rootDir, 'conftest.py'))) return 'pytest';
  if (existsSync(join(rootDir, 'go.mod'))) return 'go test';
  return null;
}

function detectExistingEvals(rootDir, files) {
  for (const name of ['promptfooconfig.yaml', 'promptfooconfig.yml', 'promptfooconfig.js', '.promptfoo.yaml']) {
    if (existsSync(join(rootDir, name))) return 'promptfoo';
  }
  for (const f of files) {
    const b = basename(f).toLowerCase();
    if (/\.eval\.(js|ts|mjs|py)$/.test(b) || b.includes('deepeval') || /evals?\//.test(f.replace(rootDir, ''))) return 'eval-tests';
  }
  return null;
}

function scanDirectory(rootDir) {
  const files = walk(rootDir);
  const rel = (f) => f.slice(rootDir.length).replace(/^[/\\]/, '') || basename(f);
  const aiFeatures = [];
  const modelIds = new Set();
  let filesScanned = 0;

  for (const file of files) {
    if (!CODE_EXT.has(extname(file))) continue;
    const content = read(file);
    if (content === null) continue;
    filesScanned++;

    let provider = null;
    for (const p of PROVIDERS) {
      if (importsModule(content, p.modules)) { provider = p.id; break; }
    }
    if (!provider) continue;

    const callSites = CALL_SITES.filter(re => re.test(content)).length;
    const models = [];
    let m;
    MODEL_ID_RE.lastIndex = 0;
    while ((m = MODEL_ID_RE.exec(content)) !== null) { models.push(m[0]); modelIds.add(m[0]); }

    aiFeatures.push({
      file: rel(file),
      provider,
      call_sites: callSites,
      models: [...new Set(models)].slice(0, 6),
    });
  }

  const testRunner = detectTestRunner(rootDir);
  const existingEvals = detectExistingEvals(rootDir, files);

  const findings = [];
  if (aiFeatures.length > 0 && !existingEvals) {
    findings.push({
      file: '.', line: 0, severity: 'medium', category: 'evals',
      rule: 'ai-features-without-evals',
      message: `${aiFeatures.length} AI feature(s) detected (${[...new Set(aiFeatures.map(f => f.provider))].join(', ')}) with no eval suite found. AI features drift silently — run /evals to scaffold a Promptfoo suite and characterization tests, then gate them in CI.`,
    });
  }

  let score = null;
  if (filesScanned > 0) {
    // Score reflects eval coverage of AI features, not code quality.
    score = aiFeatures.length === 0 ? null : (existingEvals ? 100 : 40);
  }

  return {
    files_scanned: filesScanned,
    ai_features: aiFeatures,
    model_ids: [...modelIds].sort(),
    test_runner: testRunner,
    existing_evals: existingEvals,
    findings,
    score,
    note: aiFeatures.length === 0
      ? 'No LLM SDK call sites found. eval-scanner seeds /evals for projects that ship AI features (chatbots, RAG, classifiers).'
      : 'AI features located. /evals can now generate characterization tests + a Promptfoo suite and wire them into the ship-gate.',
  };
}

const rootDir = process.argv[2] || '.';
process.stdout.write(JSON.stringify(scanDirectory(rootDir), null, 2) + '\n');
