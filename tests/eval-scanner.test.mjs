import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'tools', 'eval-scanner.mjs');

function scan(dir) {
  return JSON.parse(execFileSync('node', [TOOL, dir], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
}
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function hasRule(r, rule) { return r.findings.some(f => f.rule === rule); }

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ultraship-eval-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('eval-scanner', () => {
  it('outputs valid JSON with score null on an empty directory', () => {
    const r = scan(tmp);
    assert.equal(r.files_scanned, 0);
    assert.equal(r.score, null);
    assert.deepEqual(r.ai_features, []);
  });

  it('detects an Anthropic SDK call site and its model id', () => {
    write(tmp, 'src/chat.ts', 'import Anthropic from "@anthropic-ai/sdk";\nconst c=new Anthropic();\nawait c.messages.create({model:"claude-opus-4-8",messages:[]});\n');
    const r = scan(tmp);
    assert.equal(r.ai_features.length, 1);
    assert.equal(r.ai_features[0].provider, 'anthropic');
    assert.ok(r.ai_features[0].call_sites >= 1);
    assert.ok(r.model_ids.includes('claude-opus-4-8'));
  });

  it('detects the OpenAI SDK', () => {
    write(tmp, 'src/o.ts', 'import OpenAI from "openai";\nconst o=new OpenAI();\nawait o.chat.completions.create({model:"gpt-4o"});\n');
    const r = scan(tmp);
    assert.equal(r.ai_features[0]?.provider, 'openai');
  });

  it('detects the Vercel AI SDK (import from "ai")', () => {
    write(tmp, 'src/v.ts', 'import { generateText } from "ai";\nawait generateText({ prompt: "hi" });\n');
    const r = scan(tmp);
    assert.equal(r.ai_features[0]?.provider, 'vercel-ai-sdk');
  });

  it('does NOT flag a local ./ai import (zero false positive)', () => {
    write(tmp, 'src/app.ts', 'import { helper } from "./ai";\nexport const x = helper();\n');
    assert.equal(scan(tmp).ai_features.length, 0);
  });

  it('does NOT flag a non-LLM dependency', () => {
    write(tmp, 'src/server.ts', 'import express from "express";\nconst app = express();\n');
    assert.equal(scan(tmp).ai_features.length, 0);
  });

  it('detects a Python LLM SDK import', () => {
    write(tmp, 'bot.py', 'import anthropic\nclient = anthropic.Anthropic()\nclient.messages.create(model="claude-opus-4-8")\n');
    assert.equal(scan(tmp).ai_features[0]?.provider, 'anthropic');
  });

  it('flags ai-features-without-evals when AI features exist but no eval suite', () => {
    write(tmp, 'src/chat.ts', 'import Anthropic from "@anthropic-ai/sdk";\nawait new Anthropic().messages.create({});\n');
    const r = scan(tmp);
    assert.ok(hasRule(r, 'ai-features-without-evals'));
    assert.equal(r.score, 40);
  });

  it('does NOT flag when a promptfoo config exists (and scores 100)', () => {
    write(tmp, 'src/chat.ts', 'import Anthropic from "@anthropic-ai/sdk";\nawait new Anthropic().messages.create({});\n');
    write(tmp, 'promptfooconfig.yaml', 'prompts: []\n');
    const r = scan(tmp);
    assert.equal(r.existing_evals, 'promptfoo');
    assert.ok(!hasRule(r, 'ai-features-without-evals'));
    assert.equal(r.score, 100);
  });

  it('reports the project test runner', () => {
    write(tmp, 'src/chat.ts', 'import OpenAI from "openai";\n');
    write(tmp, 'package.json', JSON.stringify({ devDependencies: { vitest: '^2' } }));
    assert.equal(scan(tmp).test_runner, 'vitest');
  });
});
