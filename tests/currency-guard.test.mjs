import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(__dirname, '..', 'hooks', 'currency-guard.sh');

// Run the hook with a given prompt payload, return { raw, json|null }.
function runGuard(prompt) {
  const payload = JSON.stringify({ prompt });
  const raw = execFileSync('bash', [HOOK], { input: payload, encoding: 'utf8' }).trim();
  let json = null;
  if (raw) {
    try { json = JSON.parse(raw); } catch { /* leave null */ }
  }
  return { raw, json };
}

function injects(prompt) {
  const { json } = runGuard(prompt);
  return !!(json && json.hookSpecificOutput && json.hookSpecificOutput.additionalContext);
}

describe('currency-guard hook', () => {
  describe('injects on version-sensitive prompts', () => {
    const yes = [
      'How do I use the latest Hono middleware API?',
      'is drizzle v0.30 compatible with this',
      'what is the current claude api pricing',
      'show me the newest next.js app router config',
      'has the stripe sdk deprecated this method',
      'how do I migrate to tailwind v4',
      'what model id should I use for the anthropic api',
    ];
    for (const p of yes) {
      it(`injects for: "${p}"`, () => {
        assert.equal(injects(p), true);
      });
    }
  });

  describe('stays silent on non-version-sensitive prompts', () => {
    const no = [
      'Refactor this function to be cleaner',
      'Write a unit test for the parser',
      'Rename this variable to something clearer',
      'Explain what this regex does',
      'Add a comment to this loop',
    ];
    for (const p of no) {
      it(`silent for: "${p}"`, () => {
        const { raw } = runGuard(p);
        assert.equal(raw, '', `expected no output, got: ${raw}`);
      });
    }
  });

  describe('output contract', () => {
    it('emits valid JSON with the UserPromptSubmit event name when injecting', () => {
      const { json } = runGuard('how do I use the latest react hooks api');
      assert.ok(json, 'expected JSON output');
      assert.equal(json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
      assert.match(json.hookSpecificOutput.additionalContext, /context7/);
      assert.match(json.hookSpecificOutput.additionalContext, /WebSearch/);
    });

    it('handles an empty prompt without output', () => {
      const { raw } = runGuard('');
      assert.equal(raw, '');
    });

    it('handles prompts with quotes and backslashes without breaking JSON', () => {
      const { json } = runGuard('does the "latest" version of node\\ts support this');
      assert.ok(json, 'expected valid JSON even with quotes/backslashes in prompt');
      assert.equal(json.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    });
  });
});
