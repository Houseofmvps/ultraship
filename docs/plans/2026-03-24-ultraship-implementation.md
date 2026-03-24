# Ultraship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ultraship Claude Code plugin — an all-in-one builder toolkit that replaces 6 plugins and adds SEO/perf/security auditing with auto-fix.

**Architecture:** Claude Code plugin with flat `skills/<name>/SKILL.md` structure, agents as `agents/<name>.md`, commands as `commands/<name>.md`, tools as `tools/<name>.mjs` Node scripts, one SessionStart hook, and two lazy-start MCP servers (context7 + playwright).

**Tech Stack:** Node.js (ESM), htmlparser2 (SEO parsing), npx lighthouse (perf), Claude Code plugin format (YAML frontmatter + markdown)

**Spec:** `docs/specs/2026-03-24-ultraship-design.md`

---

## File Structure

```
ultraship/
  .claude-plugin/
    plugin.json
    marketplace.json
  .mcp.json
  skills/
    brainstorming/SKILL.md
    writing-plans/SKILL.md
    executing-plans/SKILL.md
    test-driven-development/SKILL.md
    systematic-debugging/SKILL.md
    verification-before-completion/SKILL.md
    requesting-code-review/SKILL.md
    receiving-code-review/SKILL.md
    using-git-worktrees/SKILL.md
    dispatching-parallel-agents/SKILL.md
    subagent-driven-development/SKILL.md
    finishing-a-development-branch/SKILL.md
    writing-skills/SKILL.md
    using-ultraship/SKILL.md
    frontend-design/SKILL.md
    code-review/SKILL.md
    revise-claude-md/SKILL.md
    seo-audit/SKILL.md
    perf-audit/SKILL.md
    security-audit/SKILL.md
  agents/
    code-reviewer.md
    seo-auditor.md
    perf-auditor.md
    security-auditor.md
    browser-verifier.md
  commands/
    ship.md
    seo.md
    perf.md
    secure.md
    review.md
    brainstorm.md
    write-plan.md
    execute-plan.md
    revise-claude-md.md
  hooks/
    hooks.json
    session-start.sh
  tools/
    seo-scanner.mjs
    lighthouse-runner.mjs
    secret-scanner.mjs
    sitemap-generator.mjs
    robots-generator.mjs
    llms-txt-generator.mjs
    structured-data-generator.mjs
    gsc-client.mjs
    bing-webmaster.mjs
  package.json
  LICENSE
  README.md
```

---

## Task 1: Project Scaffold & Plugin Manifest

**Files:**
- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Initialize git repo**

```bash
cd ~/ultraship
git init
git config user.email "houseofmvps2024@gmail.com"
git config user.name "Houseofmvps"
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "ultraship",
  "version": "1.0.0",
  "description": "All-in-one Claude Code plugin. Ship production-ready SaaS with one command.",
  "type": "module",
  "author": "Houseofmvps",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Houseofmvps/ultraship"
  },
  "dependencies": {
    "htmlparser2": "^9.1.0"
  }
}
```

- [ ] **Step 3: Create .claude-plugin/plugin.json**

```json
{
  "name": "ultraship",
  "description": "All-in-one builder toolkit. Ship production-ready SaaS with one plugin.",
  "version": "1.0.0",
  "author": {
    "name": "Houseofmvps",
    "email": "houseofmvps2024@gmail.com"
  },
  "homepage": "https://github.com/Houseofmvps/ultraship",
  "repository": "https://github.com/Houseofmvps/ultraship",
  "license": "MIT",
  "keywords": ["ship", "seo", "performance", "security", "workflow", "code-review", "lighthouse", "builder"]
}
```

- [ ] **Step 4: Create .claude-plugin/marketplace.json**

```json
{
  "name": "ultraship",
  "description": "All-in-one builder toolkit for Claude Code. Replaces 6 plugins. Ship production-ready SaaS with /ship.",
  "owner": {
    "name": "Houseofmvps",
    "email": "houseofmvps2024@gmail.com",
    "url": "https://github.com/Houseofmvps"
  },
  "plugins": [
    {
      "name": "ultraship",
      "description": "Workflow + code review + frontend design + SEO/GEO/AEO + Lighthouse + security + browser testing",
      "version": "1.0.0",
      "source": "./"
    }
  ]
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.env
*.log
.DS_Store
```

- [ ] **Step 6: Create LICENSE (MIT)**

Standard MIT license with "Copyright (c) 2026 Houseofmvps".

- [ ] **Step 7: Install dependencies and commit**

```bash
cd ~/ultraship
pnpm install
git add -A
git commit -m "feat: scaffold ultraship plugin with manifest and marketplace config"
```

---

## Task 2: SessionStart Hook

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.sh`

- [ ] **Step 1: Create hooks/hooks.json**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Create hooks/session-start.sh**

```bash
#!/bin/bash
# Ultraship SessionStart hook
# Checks CLAUDE.md existence and freshness

CLAUDE_MD="$PWD/CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
  CONTEXT="No CLAUDE.md found in this project directory ($PWD). Offer to create one based on the project structure — check package.json, directory layout, and any existing README for context."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$CONTEXT"
  exit 0
fi

if [ "$(uname)" = "Darwin" ]; then
  mod_epoch=$(stat -f %m "$CLAUDE_MD")
else
  mod_epoch=$(stat -c %Y "$CLAUDE_MD")
fi
now_epoch=$(date +%s)
age_days=$(( (now_epoch - mod_epoch) / 86400 ))

if [ "$age_days" -ge 7 ]; then
  CONTEXT="CLAUDE.md in this project is ${age_days} days old. Consider running /revise-claude-md to keep it current with recent changes."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$CONTEXT"
fi
```

- [ ] **Step 3: Make executable and commit**

```bash
chmod +x ~/ultraship/hooks/session-start.sh
cd ~/ultraship && git add hooks/ && git commit -m "feat: add SessionStart hook for CLAUDE.md detection and freshness"
```

---

## Task 3: MCP Configuration

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Create .mcp.json**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-playwright@latest"]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/ultraship && git add .mcp.json && git commit -m "feat: add MCP config for context7 and playwright (lazy-start)"
```

---

## Task 4: Port Superpowers Skills (14 skills)

Port all 14 superpowers workflow skills. Each skill is a SKILL.md file with YAML frontmatter. Content stays identical except rebranding "superpowers" references to "ultraship".

**Source:** `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/skills/`

**Files:**
- Create: `skills/brainstorming/SKILL.md` (+ copy scripts/ subdirectory)
- Create: `skills/writing-plans/SKILL.md`
- Create: `skills/executing-plans/SKILL.md`
- Create: `skills/test-driven-development/SKILL.md`
- Create: `skills/systematic-debugging/SKILL.md`
- Create: `skills/verification-before-completion/SKILL.md`
- Create: `skills/requesting-code-review/SKILL.md`
- Create: `skills/receiving-code-review/SKILL.md`
- Create: `skills/using-git-worktrees/SKILL.md`
- Create: `skills/dispatching-parallel-agents/SKILL.md`
- Create: `skills/subagent-driven-development/SKILL.md`
- Create: `skills/finishing-a-development-branch/SKILL.md`
- Create: `skills/writing-skills/SKILL.md` (+ copy examples/ subdirectory)
- Create: `skills/using-ultraship/SKILL.md` (+ copy references/ subdirectory)

- [ ] **Step 1: Copy all 14 skill directories from superpowers**

```bash
SRC=~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/skills
DEST=~/ultraship/skills

for skill in brainstorming writing-plans executing-plans test-driven-development systematic-debugging verification-before-completion requesting-code-review receiving-code-review using-git-worktrees dispatching-parallel-agents subagent-driven-development finishing-a-development-branch writing-skills; do
  cp -r "$SRC/$skill" "$DEST/$skill"
done

# Copy using-superpowers as using-ultraship
cp -r "$SRC/using-superpowers" "$DEST/using-ultraship"
```

- [ ] **Step 2: Rebrand using-ultraship**

In `skills/using-ultraship/SKILL.md`:
- Change frontmatter `name: using-superpowers` to `name: using-ultraship`
- Replace all "superpowers" references with "ultraship" in the content
- Update skill references to use `ultraship:` prefix instead of `superpowers:`

- [ ] **Step 3: Update skill cross-references in all ported skills**

In every ported SKILL.md, replace all `superpowers:` prefixes with `ultraship:` prefixes. For example:
- `superpowers:writing-plans` becomes `ultraship:writing-plans`
- `superpowers:brainstorming` becomes `ultraship:brainstorming`
- `superpowers:code-reviewer` becomes `ultraship:code-reviewer`

Use sed across all SKILL.md files:
```bash
find ~/ultraship/skills -name "SKILL.md" -exec sed -i '' 's/superpowers:/ultraship:/g' {} +
```

- [ ] **Step 4: Update save paths in writing-plans and brainstorming skills**

- `docs/superpowers/plans/` becomes `docs/ultraship/plans/`
- `docs/superpowers/specs/` becomes `docs/ultraship/specs/`

```bash
find ~/ultraship/skills -name "SKILL.md" -exec sed -i '' 's|docs/superpowers/|docs/ultraship/|g' {} +
```

- [ ] **Step 5: Commit**

```bash
cd ~/ultraship && git add skills/ && git commit -m "feat: port 14 superpowers workflow skills with ultraship branding"
```

---

## Task 5: Port Code-Review Agent & Command

**Source files:**
- Agent: `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/agents/code-reviewer.md`
- Command: `~/.claude/plugins/cache/claude-plugins-official/code-review/79caa0d824ac/commands/code-review.md`

Note: The code-review plugin has no skill — only a command. We create a `skills/code-review/SKILL.md` wrapper that invokes the command's logic as a skill.

**Files:**
- Create: `agents/code-reviewer.md`
- Create: `skills/code-review/SKILL.md`
- Create: `commands/review.md`

- [ ] **Step 1: Copy superpowers code-reviewer agent**

```bash
cp ~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/agents/code-reviewer.md ~/ultraship/agents/code-reviewer.md
```

- [ ] **Step 2: Copy code-review command**

```bash
cp ~/.claude/plugins/cache/claude-plugins-official/code-review/79caa0d824ac/commands/code-review.md ~/ultraship/commands/review.md
```

- [ ] **Step 3: Create skills/code-review/SKILL.md**

Write a skill wrapper with frontmatter:
```yaml
---
name: code-review
description: Code review a pull request
allowed-tools: Bash(gh pr:*), Bash(gh issue:*), Read, Grep, Glob
---
```

Body: reference the /review command's logic — review PR diff, evaluate correctness/performance/security/maintainability, output findings with severity levels.

- [ ] **Step 4: Update agent to output severity-based findings for /ship**

Add to `agents/code-reviewer.md` prompt:

```
## Output Format for /ship

When invoked by /ship, output findings with severity levels (critical/high/medium/low/info) in the same format as other auditors for scorecard aggregation.
```

- [ ] **Step 5: Rebrand any source plugin references to ultraship**

- [ ] **Step 6: Commit**

```bash
cd ~/ultraship && git add agents/code-reviewer.md skills/code-review/ commands/review.md && git commit -m "feat: add code-review agent, skill, and /review command"
```

---

## Task 6: Port Frontend-Design Skill

**Source file:** `~/.claude/plugins/cache/claude-plugins-official/frontend-design/79caa0d824ac/skills/frontend-design/SKILL.md`

**Files:**
- Create: `skills/frontend-design/SKILL.md`

- [ ] **Step 1: Copy the frontend-design skill**

```bash
mkdir -p ~/ultraship/skills/frontend-design
cp ~/.claude/plugins/cache/claude-plugins-official/frontend-design/79caa0d824ac/skills/frontend-design/SKILL.md ~/ultraship/skills/frontend-design/SKILL.md
```

- [ ] **Step 2: Update any plugin-specific references to use ultraship prefix**

- [ ] **Step 3: Commit**

```bash
cd ~/ultraship && git add skills/frontend-design/ && git commit -m "feat: add frontend-design skill"
```

---

## Task 7: Port Claude-MD Management Skills & Command

**Source files:**
- Command: `~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/commands/revise-claude-md.md`
- Skill: `~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/skills/claude-md-improver/SKILL.md`
- References: `~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/skills/claude-md-improver/references/` (templates.md, update-guidelines.md, quality-criteria.md)

**Files:**
- Create: `skills/revise-claude-md/SKILL.md`
- Create: `skills/revise-claude-md/references/templates.md`
- Create: `skills/revise-claude-md/references/update-guidelines.md`
- Create: `skills/revise-claude-md/references/quality-criteria.md`
- Create: `commands/revise-claude-md.md`

- [ ] **Step 1: Copy skill with references**

```bash
mkdir -p ~/ultraship/skills/revise-claude-md/references
cp ~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/skills/claude-md-improver/SKILL.md ~/ultraship/skills/revise-claude-md/SKILL.md
cp ~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/skills/claude-md-improver/references/*.md ~/ultraship/skills/revise-claude-md/references/
```

- [ ] **Step 2: Copy command**

```bash
cp ~/.claude/plugins/cache/claude-plugins-official/claude-md-management/1.0.0/commands/revise-claude-md.md ~/ultraship/commands/revise-claude-md.md
```

- [ ] **Step 3: Update skill name in frontmatter**

The source skill is named `claude-md-improver`. Update to `revise-claude-md` in the SKILL.md frontmatter to match our naming.

- [ ] **Step 4: Commit**

```bash
cd ~/ultraship && git add skills/revise-claude-md/ commands/revise-claude-md.md && git commit -m "feat: add CLAUDE.md revision skill and command"
```

---

## Task 8: Port Workflow Commands

**Source:** `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/commands/`

**Files:**
- Create: `commands/brainstorm.md`
- Create: `commands/write-plan.md`
- Create: `commands/execute-plan.md`

- [ ] **Step 1: Copy superpowers commands**

```bash
cp ~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/commands/brainstorm.md ~/ultraship/commands/brainstorm.md
cp ~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/commands/write-plan.md ~/ultraship/commands/write-plan.md
cp ~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/commands/execute-plan.md ~/ultraship/commands/execute-plan.md
```

- [ ] **Step 2: Update skill references from superpowers to ultraship**

```bash
sed -i '' 's/superpowers:/ultraship:/g' ~/ultraship/commands/brainstorm.md ~/ultraship/commands/write-plan.md ~/ultraship/commands/execute-plan.md
```

- [ ] **Step 3: Commit**

```bash
cd ~/ultraship && git add commands/brainstorm.md commands/write-plan.md commands/execute-plan.md && git commit -m "feat: add workflow commands (brainstorm, write-plan, execute-plan)"
```

---

## Task 9: Build SEO Scanner Tool

**Files:**
- Create: `tools/seo-scanner.mjs`

- [ ] **Step 1: Create seo-scanner.mjs**

Zero-dependency tool (uses htmlparser2 from project deps). Accepts a directory, finds all HTML files, parses with htmlparser2 SAX parser, checks for meta tags, OG tags, headings, alt text, structured data, and project-level files (robots.txt, sitemap.xml, llms.txt, favicon.ico).

Outputs JSON: `{ files_scanned, findings[], scores: { seo, geo, aeo } }`

Scoring: start at 100 per category, deduct by severity (critical=-20, high=-10, medium=-5, low=-2).

Key checks:
- SEO: title, meta description, viewport, charset, OG tags, twitter card, canonical, H1, alt text, robots.txt, sitemap.xml, favicon
- GEO: JSON-LD structured data, llms.txt
- AEO: FAQPage schema, speakable markup

Skip directories: node_modules, .git, dist

- [ ] **Step 2: Test on mrr-guardian**

```bash
cd ~/ultraship && node tools/seo-scanner.mjs ~/mrr-guardian
```

Verify JSON output with findings and scores.

- [ ] **Step 3: Commit**

```bash
cd ~/ultraship && git add tools/seo-scanner.mjs && git commit -m "feat: add SEO/GEO/AEO scanner tool with htmlparser2"
```

---

## Task 10: Build Secret Scanner Tool

**Files:**
- Create: `tools/secret-scanner.mjs`

- [ ] **Step 1: Create secret-scanner.mjs**

Zero npm deps. Uses `execFileSync('git', ['ls-files'])` to get tracked files (falls back to recursive directory listing if not a git repo). Scans each file against regex patterns for known secret formats.

Patterns: AWS access keys (AKIA...), AWS secret keys, Stripe secret/restricted keys, OpenAI keys (sk-...), Anthropic keys (sk-ant-...), GitHub tokens (ghp_/gho_/ghu_/ghs_...), private key headers, JWT secrets, database URLs with passwords, generic API keys/secrets.

Skip: binary files, lockfiles, images, fonts.

Check for committed .env files.

Output JSON: `{ files_scanned, findings[] }`

Each finding: `{ file, line, severity, pattern, match (redacted), message }`

Use `execFileSync` (not `execSync`) for the git command to avoid shell injection.

- [ ] **Step 2: Test**

```bash
cd ~/ultraship && node tools/secret-scanner.mjs ~/ultraship
```

- [ ] **Step 3: Commit**

```bash
cd ~/ultraship && git add tools/secret-scanner.mjs && git commit -m "feat: add secret scanner tool"
```

---

## Task 11: Build Generators (Sitemap, Robots, llms.txt, Structured Data)

**Files:**
- Create: `tools/sitemap-generator.mjs`
- Create: `tools/robots-generator.mjs`
- Create: `tools/llms-txt-generator.mjs`
- Create: `tools/structured-data-generator.mjs`

- [ ] **Step 1: Create sitemap-generator.mjs**

Usage: `node tools/sitemap-generator.mjs <directory> <base-url>`

Finds routes from: Next.js app/pages dirs, static HTML in public/dist/build/out. Generates XML sitemap. Writes to public/ if exists, else project root.

Output: `{ path, urls, written }`

- [ ] **Step 2: Create robots-generator.mjs**

Usage: `node tools/robots-generator.mjs <directory> <base-url>`

Generates standard robots.txt with `User-agent: *`, `Allow: /`, and sitemap reference.

Output: `{ path, written }`

- [ ] **Step 3: Create llms-txt-generator.mjs**

Usage: `node tools/llms-txt-generator.mjs <directory>`

Reads package.json for name/description/deps, README.md for context. Generates llms.txt (concise) and llms-full.txt (detailed).

Output: `{ path, full_path, sections, written }`

- [ ] **Step 4: Create structured-data-generator.mjs**

Usage: `node tools/structured-data-generator.mjs <directory> --type=<Organization|Product|FAQPage|HowTo|SoftwareApplication>`

Reads package.json for project info. Generates appropriate JSON-LD schema.

Output: `{ path, type, written }`

- [ ] **Step 5: Test all generators**

```bash
cd ~/ultraship
node tools/sitemap-generator.mjs ~/mrr-guardian https://savemrr.co
node tools/robots-generator.mjs ~/mrr-guardian https://savemrr.co
node tools/llms-txt-generator.mjs ~/mrr-guardian
node tools/structured-data-generator.mjs ~/mrr-guardian --type=SoftwareApplication
```

Clean up generated test files after verification.

- [ ] **Step 6: Commit**

```bash
cd ~/ultraship && git add tools/sitemap-generator.mjs tools/robots-generator.mjs tools/llms-txt-generator.mjs tools/structured-data-generator.mjs && git commit -m "feat: add sitemap, robots.txt, llms.txt, and structured data generators"
```

---

## Task 12: Build Lighthouse Runner Tool

**Files:**
- Create: `tools/lighthouse-runner.mjs`

- [ ] **Step 1: Create lighthouse-runner.mjs**

Usage: `node tools/lighthouse-runner.mjs <url>`

Auto-detects Chrome location (macOS app path, linux paths, `which` fallback). Runs Lighthouse via `npx -y lighthouse` with `--output=json` and `--chrome-flags="--headless --no-sandbox"`. Parses JSON report for scores and opportunities.

Uses `execFileSync('npx', [...args])` — NOT `execSync` with string concatenation. The URL is passed as an argument array element, not interpolated into a shell string.

Output: `{ url, scores: { performance, accessibility, best_practices, seo }, opportunities[], error }`

Graceful failures:
- No Chrome → `{ error: "Chrome not found", scores: null }`
- Timeout → `{ error: "Lighthouse timed out", scores: null }`

- [ ] **Step 2: Commit**

```bash
cd ~/ultraship && git add tools/lighthouse-runner.mjs && git commit -m "feat: add Lighthouse runner tool with Chrome auto-detection"
```

---

## Task 13: Build GSC and Bing Webmaster Stubs

**Files:**
- Create: `tools/gsc-client.mjs`
- Create: `tools/bing-webmaster.mjs`

- [ ] **Step 1: Create gsc-client.mjs**

Env var gated stub. Checks `ULTRASHIP_GSC_KEY`. If not set, outputs `{ error: "No API key configured...", success: false }` and exits 0. Placeholder for v1.1 implementation.

- [ ] **Step 2: Create bing-webmaster.mjs**

Same pattern. Checks `ULTRASHIP_BING_KEY`.

- [ ] **Step 3: Commit**

```bash
cd ~/ultraship && git add tools/gsc-client.mjs tools/bing-webmaster.mjs && git commit -m "feat: add GSC and Bing Webmaster stubs (optional, env-gated)"
```

---

## Task 14: Build New Audit Skills

**Files:**
- Create: `skills/seo-audit/SKILL.md`
- Create: `skills/perf-audit/SKILL.md`
- Create: `skills/security-audit/SKILL.md`

- [ ] **Step 1: Create skills/seo-audit/SKILL.md**

Skill that guides Claude through: (1) running seo-scanner tool, (2) presenting findings by category, (3) applying fixes (missing meta tags, missing sitemap/robots/llms.txt via generators, missing structured data), (4) optional GSC/Bing submit, (5) re-scan to verify.

Key principle in the skill: "Fix, don't just audit."

- [ ] **Step 2: Create skills/perf-audit/SKILL.md**

Skill for: (1) finding dev server URL, (2) running lighthouse-runner, (3) presenting scores, (4) applying fixes (lazy loading, image dimensions, preconnect, defer, font-display), (5) graceful degradation for no Chrome.

- [ ] **Step 3: Create skills/security-audit/SKILL.md**

Skill for: (1) dep audit via detected package manager, (2) secret scanning via tool, (3) OWASP pattern grep, (4) HTTP header check if server running, (5) applying safe fixes.

- [ ] **Step 4: Commit**

```bash
cd ~/ultraship && git add skills/seo-audit/ skills/perf-audit/ skills/security-audit/ && git commit -m "feat: add SEO, performance, and security audit skills"
```

---

## Task 15: Build New Audit Agents

**Files:**
- Create: `agents/seo-auditor.md`
- Create: `agents/perf-auditor.md`
- Create: `agents/security-auditor.md`
- Create: `agents/browser-verifier.md`

- [ ] **Step 1: Create agents/seo-auditor.md**

Agent with frontmatter `name: seo-auditor`, `model: inherit`. Prompt: run seo-scanner tool, check project files, return JSON with category, scores, findings, fixes_available.

- [ ] **Step 2: Create agents/perf-auditor.md**

Agent: detect dev server, run lighthouse-runner, return JSON. Handle Chrome-not-found gracefully.

- [ ] **Step 3: Create agents/security-auditor.md**

Agent: run dep audit, secret scanner, grep for OWASP patterns, return JSON.

- [ ] **Step 4: Create agents/browser-verifier.md**

Agent: use Playwright MCP tools to navigate, check console errors, verify pages load, take screenshot. Return PASS/FAIL JSON.

- [ ] **Step 5: Commit**

```bash
cd ~/ultraship && git add agents/ && git commit -m "feat: add SEO, perf, security, and browser verifier agents"
```

---

## Task 16: Build New Commands (/ship, /seo, /perf, /secure)

**Files:**
- Create: `commands/ship.md`
- Create: `commands/seo.md`
- Create: `commands/perf.md`
- Create: `commands/secure.md`

- [ ] **Step 1: Create commands/ship.md**

The viral core command. Instructions to:
1. Detect project type (API-only / landing / full-stack)
2. Dispatch auditors in parallel (use dispatching-parallel-agents skill)
3. Collect JSON results from each agent
4. Calculate scores with severity deductions and project-type weights
5. Apply auto-fixes for SEO/security/code-quality
6. Output ASCII scorecard with progress bars
7. Optional CI status check via `gh run list`

Include the scorecard template, scoring thresholds (>=80 READY TO SHIP, 60-79 NEEDS WORK, <60 NOT READY), and weight redistribution rules.

- [ ] **Step 2: Create commands/seo.md**

Simple: invoke `ultraship:seo-audit` skill.

- [ ] **Step 3: Create commands/perf.md**

Simple: invoke `ultraship:perf-audit` skill.

- [ ] **Step 4: Create commands/secure.md**

Simple: invoke `ultraship:security-audit` skill.

- [ ] **Step 5: Commit**

```bash
cd ~/ultraship && git add commands/ && git commit -m "feat: add /ship, /seo, /perf, /secure commands"
```

---

## Task 17: Update using-ultraship Skill

**Files:**
- Modify: `skills/using-ultraship/SKILL.md`

- [ ] **Step 1: Add new skills and commands to the catalog**

Update the skill listing to include all 20 skills (14 ported + 6 new: seo-audit, perf-audit, security-audit, frontend-design, code-review, revise-claude-md).

Update the command listing to include all 9 commands (/ship, /seo, /perf, /secure, /review, /brainstorm, /write-plan, /execute-plan, /revise-claude-md).

- [ ] **Step 2: Commit**

```bash
cd ~/ultraship && git add skills/using-ultraship/ && git commit -m "feat: update using-ultraship skill with full capability catalog"
```

---

## Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

Sections:
- Hero: "Ship production-ready SaaS with one command."
- What it replaces (6 plugins listed in table)
- Feature grid with categories
- `/ship` scorecard ASCII example
- Quick install
- Full command reference table
- Architecture overview
- Credits (superpowers by Jesse Vincent, context7, playwright)
- MIT license badge

- [ ] **Step 2: Commit**

```bash
cd ~/ultraship && git add README.md && git commit -m "docs: add README with feature overview and install instructions"
```

---

## Task 19: Final Integration Test

- [ ] **Step 1: Verify plugin structure**

```bash
cd ~/ultraship
ls .claude-plugin/plugin.json .claude-plugin/marketplace.json .mcp.json hooks/hooks.json hooks/session-start.sh
ls skills/*/SKILL.md | wc -l  # expect 20
ls agents/*.md | wc -l        # expect 5
ls commands/*.md | wc -l      # expect 9
ls tools/*.mjs | wc -l        # expect 9
```

- [ ] **Step 2: Test each tool outputs valid JSON**

```bash
node tools/seo-scanner.mjs . | jq .
node tools/secret-scanner.mjs . | jq .
node tools/sitemap-generator.mjs . https://example.com | jq .
node tools/robots-generator.mjs . https://example.com | jq .
node tools/llms-txt-generator.mjs . | jq .
node tools/structured-data-generator.mjs . --type=SoftwareApplication | jq .
node tools/gsc-client.mjs submit-sitemap https://example.com/sitemap.xml | jq .
node tools/bing-webmaster.mjs submit-sitemap https://example.com/sitemap.xml | jq .
```

Clean up generated files after testing.

- [ ] **Step 3: Verify hook outputs valid JSON**

```bash
cd ~/ultraship && bash hooks/session-start.sh | jq .
```

- [ ] **Step 4: Final commit**

```bash
cd ~/ultraship && git add -A && git commit -m "feat: ultraship v1.0.0 — all-in-one Claude Code builder plugin"
```

- [ ] **Step 5: Create GitHub repo and push**

```bash
cd ~/ultraship
gh repo create Houseofmvps/ultraship --public --source=. --description "All-in-one Claude Code plugin. Ship production-ready SaaS with one command." --push
```
