# Ultraship Design Spec

**Date:** 2026-03-24
**Author:** Houseofmvps + Claude
**Status:** Draft

---

## 1. Vision

Ultraship is a single Claude Code plugin that replaces 6+ separate plugins and adds capabilities no other plugin offers. It takes a project from "I have code" to "this is ready to sell" — covering workflow, code review, frontend design, SEO/GEO (Generative Engine Optimization — optimizing for AI search engines)/AEO (Answer Engine Optimization — optimizing for featured snippets and voice assistants), performance, security, and browser testing.

The `/ship` command is the viral core: one command that runs every audit in parallel and produces a screenshot-shareable scorecard.

## 2. Target Audience

Indie SaaS builders shipping with Claude Code. Developers who want to go from code to production-ready without installing 6 plugins, configuring MCP servers, or manually running audits.

## 3. What Ultraship Replaces

| Current Plugin | What Ultraship Absorbs |
|---|---|
| superpowers | All 14 workflow skills (brainstorming, TDD, debugging, planning, verification, git worktrees, etc.) |
| context7 | Live library docs via MCP (lazy-start) |
| playwright | Browser testing via MCP (lazy-start) |
| code-review | PR review with confidence scoring |
| frontend-design | Frontend design skill |
| claude-md-management | CLAUDE.md auto-creation hook + revise skill |

**New capabilities (not in any existing plugin):**
- `/ship` — pre-deploy quality gate with parallel auditors and scorecard
- `/seo` — SEO + GEO + AEO audit with auto-fix
- `/perf` — Lighthouse performance audit with auto-fix
- `/secure` — security hardening (dep audit, secret scan, OWASP, headers)
- GSC + Bing Webmaster integration (optional)
- llms.txt generator
- Sitemap + robots.txt generator
- Structured data (JSON-LD) generator

## 4. Plugin Structure

```
ultraship/
  .claude-plugin/
    plugin.json           # manifest
    marketplace.json      # marketplace listing
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
    using-ultraship/SKILL.md          # replaces using-superpowers
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
    session-start.sh
  tools/
    lighthouse-runner.mjs
    seo-scanner.mjs
    sitemap-generator.mjs
    robots-generator.mjs
    llms-txt-generator.mjs
    structured-data-generator.mjs
    secret-scanner.mjs
    gsc-client.mjs          # optional, needs API key
    bing-webmaster.mjs       # optional, needs API key
  .mcp.json                  # context7 + playwright
```

**Key constraint:** Claude Code only discovers skills at `skills/<name>/SKILL.md` — flat directory, no nesting. All 20 skills follow this pattern.

## 5. Plugin Manifest (plugin.json)

```json
{
  "name": "ultraship",
  "version": "1.0.0",
  "description": "All-in-one builder toolkit. Ship production-ready SaaS with one plugin.",
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

**Note:** Hooks are defined in `hooks/hooks.json` (Claude Code plugin convention), not embedded in plugin.json. Agent files are flat markdown at `agents/<name>.md` (matching Claude Code's discovery pattern).

## 6. MCP Configuration (.mcp.json)

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

Both servers lazy-start on first tool call (the MCP server process is spawned only when a tool from that server is first invoked — not at plugin load time). Zero startup cost.

## 7. Hook Design

**One hook only: SessionStart**

```bash
#!/bin/bash
# Check CLAUDE.md existence and freshness
CLAUDE_MD="$PWD/CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"No CLAUDE.md found in $PWD. Offer to create one based on the project structure.\"}}"
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
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"CLAUDE.md is ${age_days} days old. Consider running /revise-claude-md to keep it current.\"}}"
fi
```

**No PreToolUse/PostToolUse hooks.** Target: <10ms execution.

## 8. Commands Reference

| Command | What It Does | Target Time |
|---|---|---|
| `/ship` | Run all auditors in parallel, output scorecard | <60s |
| `/seo` | SEO + GEO + AEO audit with auto-fix | <5s |
| `/perf` | Lighthouse audit with auto-fix | <30s |
| `/secure` | Security scan with auto-fix | <10s |
| `/review` | PR code review with confidence scoring | <30s |
| `/brainstorm` | Collaborative idea-to-design flow | interactive |
| `/write-plan` | Create implementation plan from spec | interactive |
| `/execute-plan` | Execute plan with review checkpoints | interactive |
| `/revise-claude-md` | Update CLAUDE.md from session learnings | <10s |

## 9. /ship Pipeline Detail

The viral core. One command that tells you if your project is ready to ship.

### Flow

```
/ship
  |
  +---> [parallel agents]
  |       |-- seo-auditor      (SEO/GEO/AEO scan)
  |       |-- perf-auditor     (Lighthouse run)
  |       |-- security-auditor (dep audit + secret scan + OWASP)
  |       |-- code-reviewer    (code quality check)
  |       |-- browser-verifier (Playwright smoke test)
  |
  +---> [collect results]
  |
  +---> [generate scorecard]
  |
  +---> [auto-fix mode: fix issues found by SEO/security/code-quality]
  |
  +---> [output final scorecard with fix count]
```

### Scorecard Output

```
====================================
  ULTRASHIP SCORECARD
====================================
  SEO/GEO/AEO    92/100  [==========-]
  Performance     87/100  [========---]
  Security        95/100  [==========-]
  Code Quality    88/100  [========---]
  Browser Test    PASS    (pass/fail, not scored)

  OVERALL         90/100
  STATUS          READY TO SHIP
====================================
  Fixed: 7 issues auto-resolved
  Remaining: 2 manual items
====================================
```

Designed to be screenshot-shareable on Twitter/X. Progress bar maps linearly: each `=` represents ~9 points on a 10-character bar.

### Scoring Weights

| Category | Weight | Score Source |
|---|---|---|
| SEO/GEO/AEO | 25% | seo-scanner output |
| Performance | 25% | Lighthouse scores |
| Security | 25% | dep audit + secret scan + OWASP |
| Code Quality | 25% | code-review agent |

**Browser Test** is pass/fail only — it does not contribute to the numeric score. A FAIL adds a warning banner to the scorecard but does not reduce the overall score.

**Scoring threshold:** >= 80 = "READY TO SHIP", 60-79 = "NEEDS WORK", < 60 = "NOT READY"

### Scoring Algorithm

Each auditor returns a list of findings with severity (critical=0pts, high=-10pts, medium=-5pts, low=-2pts, info=0pts). Category score starts at 100 and deducts per finding, floored at 0. Overall = weighted average of category scores.

### Project Type Adaptation

- **API-only projects:** Skip SEO, browser test. Redistribute: Security 40%, Code Quality 40%, Performance 20%.
- **Landing pages:** Skip code quality deep-dive. Redistribute: SEO 40%, Performance 40%, Security 20%.
- **Full-stack apps:** All auditors run with equal weight (25% each).

Detection: check for `index.html`, `next.config`, `vite.config`, route files, `package.json` scripts.

### CI Status Check

If `.github/workflows/` exists, check latest CI status via `gh run list --limit 1`. Warn if CI is failing but don't block the scorecard.

## 10. SEO/GEO/AEO Audit Detail

### Phase 1: Traditional SEO
- Meta tags (title, description, viewport, charset)
- Open Graph tags (og:title, og:description, og:image, og:url, og:type)
- Twitter Card tags
- Canonical URLs
- Heading hierarchy (single H1, logical H2-H6)
- Image alt text
- Internal/external link audit
- favicon.ico existence
- robots.txt existence and validity
- sitemap.xml existence

### Phase 2: GEO (Generative Engine Optimization)
- Content structure for AI consumption
- FAQ sections with clear Q&A format
- Definitive statements (not hedging language)
- Entity clarity (who, what, where)
- Topical authority signals
- llms.txt / llms-full.txt existence and validity

### Phase 3: AEO (Answer Engine Optimization)
- Structured data (JSON-LD) presence and validity
  - FAQPage, HowTo, Organization, Product, SoftwareApplication
  - speakable markup
- Featured snippet optimization
  - Paragraph snippets (40-60 word answers)
  - List snippets (ordered/unordered)
  - Table snippets
- Schema.org compliance

### Phase 4: GSC + Bing Submit (Optional)
- If GSC API key configured: submit sitemap, check indexing status, pull search performance data
- If Bing Webmaster API key configured: submit sitemap, request URL indexing
- If no keys: skip silently, no error

### Phase 5: Fix Mode
- Auto-generate missing meta tags
- Auto-generate missing OG tags with sensible defaults
- Auto-generate sitemap.xml from route files
- Auto-generate robots.txt
- Auto-generate llms.txt from project structure
- Auto-generate JSON-LD structured data
- Fix heading hierarchy issues
- Add missing alt text placeholders

### Tool: seo-scanner.mjs

Uses `htmlparser2` (streaming SAX-style parser, ~30KB, zero transitive deps) for reliable HTML parsing. Regex-only parsing breaks on multi-line attributes, JSX, and minified HTML. htmlparser2 handles all edge cases while staying lightweight.

## 11. Performance Audit Detail

### Lighthouse Flow

```
1. Check if Chrome/Chromium available
2. If yes: run `npx lighthouse <url> --output=json --chrome-flags="--headless --no-sandbox"`
3. Parse JSON output for scores
4. If no Chrome: graceful fallback (skip, report "Chrome not found")
```

### Scores Captured
- Performance (LCP, INP, CLS, FCP, TTFB, SI)
- Accessibility
- Best Practices
- SEO (Lighthouse's own SEO checks, complementing our deeper /seo)

### Auto-Fix Patterns
- Add `loading="lazy"` to below-fold images
- Add `width`/`height` attributes to images (prevents CLS)
- Add `rel="preconnect"` for external origins
- Defer non-critical scripts (`defer` attribute)
- Add `font-display: swap` to @font-face declarations
- Minification recommendations (not auto-applied — build tool dependent)

### Graceful Degradation
- No Chrome: report "Lighthouse requires Chrome. Install Chrome or skip /perf."
- Lighthouse not installed: auto-install via `npx lighthouse` (one-time)
- No running dev server: suggest `pnpm dev` first, or test against production URL
- Timeout (>30s): return partial results with warning

## 12. Security Audit Detail

### Dependency Audit
- Run `npm audit` / `pnpm audit` / `yarn audit` (detect package manager from lockfile)
- Parse output for critical/high/medium vulnerabilities
- Auto-fix: run `npm audit fix` (non-breaking only)

### Secret Scanning
- Scan all tracked files for patterns:
  - API keys (AWS, Stripe, OpenAI, Anthropic, etc.)
  - Private keys (RSA, SSH)
  - Database connection strings with passwords
  - JWT secrets
  - `.env` files committed to git
- Uses regex patterns, zero dependencies

### OWASP Pattern Detection
- Scan source files for dangerous patterns:
  - `eval()`, `Function()` constructor
  - `innerHTML` assignments (XSS risk)
  - SQL string concatenation (injection risk)
  - `dangerouslySetInnerHTML` without sanitization
  - Hardcoded credentials
  - Missing CSRF protection in forms
  - `http://` URLs (mixed content)

### HTTP Security Headers Check
- If running server detected, check for:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security
  - Referrer-Policy
- Auto-fix: generate middleware snippet for missing headers

### Tool: secret-scanner.mjs

Zero npm dependencies. Reads files via `git ls-files` (or falls back to recursive directory listing if not a git repo), applies regex patterns for known secret formats. Reports file:line for each finding.

## 13. Tools Architecture

| Tool | Dependencies | Purpose |
|---|---|---|
| seo-scanner.mjs | htmlparser2 | HTML meta/OG/heading/link analysis |
| sitemap-generator.mjs | None | Generate sitemap.xml from routes |
| robots-generator.mjs | None | Generate robots.txt |
| llms-txt-generator.mjs | None | Generate llms.txt / llms-full.txt |
| structured-data-generator.mjs | None | Generate JSON-LD schemas |
| secret-scanner.mjs | None | Regex-based secret detection |
| lighthouse-runner.mjs | npx lighthouse | Lighthouse wrapper with JSON parsing |
| gsc-client.mjs | googleapis (optional) | Google Search Console API |
| bing-webmaster.mjs | node-fetch (optional) | Bing Webmaster API |

**6/9 tools have zero npm dependencies.** seo-scanner uses htmlparser2 (lightweight, ~30KB). Lighthouse uses npx (downloads on demand). GSC/Bing clients are optional and only install their deps when the user configures API keys.

## 14. Agent File Format

Each agent is a flat markdown file at `agents/<name>.md`:

```markdown
---
name: seo-auditor
description: Runs SEO/GEO/AEO audit on project HTML files and generates fix recommendations
tools: [Bash, Read, Write, Edit, Glob, Grep]
---

You are the SEO auditor agent for Ultraship. Your job is to...
(full agent prompt here)
```

The frontmatter defines the agent's name, description (used for dispatch matching), and allowed tools. The body is the system prompt.

## 15. Command File Format

Each command lives in `commands/<name>.md`:

```markdown
---
name: ship
description: Run all auditors and produce a ship-readiness scorecard
---

# /ship — Pre-Deploy Quality Gate

Run the following agents in parallel using the dispatching-parallel-agents skill:

1. **seo-auditor** — Scan all HTML files for SEO/GEO/AEO issues
2. **perf-auditor** — Run Lighthouse via `node tools/lighthouse-runner.mjs <url>`
3. **security-auditor** — Run `node tools/secret-scanner.mjs` + dep audit + OWASP scan
4. **code-reviewer** — Review staged/recent changes for quality issues
5. **browser-verifier** — Use Playwright MCP to smoke-test the running app

After all agents complete, aggregate results into the scorecard format.
Apply auto-fixes for SEO, security, and code quality findings.
Output the final scorecard.
```

Commands are markdown instructions that Claude follows when the user types the slash command. They reference agents and tools by name.

## 16. Tool I/O Contracts

All tools are Node.js scripts invoked via `node tools/<name>.mjs [args]`. They output JSON to stdout and use exit code 0 for success, 1 for error.

### seo-scanner.mjs

```
Input:  node tools/seo-scanner.mjs <directory>
Output: {
  "files_scanned": 12,
  "findings": [
    { "file": "index.html", "line": 5, "severity": "high", "category": "seo",
      "rule": "missing-meta-description", "message": "No <meta name=\"description\"> found",
      "fix": { "type": "insert", "content": "<meta name=\"description\" content=\"...\">" } }
  ],
  "scores": { "seo": 72, "geo": 85, "aeo": 60 }
}
```

### lighthouse-runner.mjs

```
Input:  node tools/lighthouse-runner.mjs <url>
Output: {
  "url": "http://localhost:3000",
  "scores": { "performance": 87, "accessibility": 92, "best_practices": 88, "seo": 95 },
  "opportunities": [
    { "id": "render-blocking-resources", "severity": "medium", "savings_ms": 450,
      "message": "Eliminate render-blocking resources" }
  ],
  "error": null
}
Error:  { "error": "Chrome not found", "scores": null }
```

### secret-scanner.mjs

```
Input:  node tools/secret-scanner.mjs [directory]
Output: {
  "files_scanned": 142,
  "findings": [
    { "file": "src/config.ts", "line": 12, "severity": "critical",
      "pattern": "aws-access-key", "match": "AKIA...(redacted)", "message": "AWS access key found" }
  ]
}
```

### sitemap-generator.mjs

```
Input:  node tools/sitemap-generator.mjs <directory> <base-url>
Output: { "path": "public/sitemap.xml", "urls": 24, "written": true }
```

### robots-generator.mjs

```
Input:  node tools/robots-generator.mjs <directory> <base-url>
Output: { "path": "public/robots.txt", "written": true }
```

### llms-txt-generator.mjs

```
Input:  node tools/llms-txt-generator.mjs <directory>
Output: { "path": "public/llms.txt", "full_path": "public/llms-full.txt", "sections": 8, "written": true }
```

### structured-data-generator.mjs

```
Input:  node tools/structured-data-generator.mjs <directory> --type=<Organization|Product|FAQPage|HowTo|SoftwareApplication>
Output: { "path": "public/schema.json", "type": "Organization", "written": true }
```

### gsc-client.mjs / bing-webmaster.mjs

```
Input:  node tools/gsc-client.mjs submit-sitemap <sitemap-url>
        node tools/gsc-client.mjs check-indexing <site-url>
        node tools/bing-webmaster.mjs submit-sitemap <sitemap-url>
Output: { "success": true, "message": "Sitemap submitted" }
Error:  { "error": "No API key configured. Set ULTRASHIP_GSC_KEY in environment.", "success": false }
```

## 17. Configuration

### API Keys (Optional)

GSC and Bing Webmaster integrations use environment variables:

```bash
# In .claude/settings.json or .claude/settings.local.json
{
  "env": {
    "ULTRASHIP_GSC_KEY": "path/to/service-account.json",
    "ULTRASHIP_BING_KEY": "your-bing-api-key"
  }
}
```

Or set directly in shell environment. If not set, GSC/Bing features are silently skipped.

### No Other Configuration Required

Everything else works out of the box. Project type is auto-detected. Chrome is auto-detected. Package manager is auto-detected from lockfile.

## 18. Installation

```bash
# Via Claude Code plugin marketplace (preferred)
# User enables "ultraship" in /plugins menu

# Via GitHub (manual)
# Clone to ~/.claude/plugins/ or add as extraKnownMarketplaces in settings.json
```

### marketplace.json

```json
{
  "name": "ultraship",
  "description": "All-in-one builder toolkit. Ship production-ready SaaS with one plugin.",
  "version": "1.0.0",
  "author": {
    "name": "Houseofmvps",
    "url": "https://github.com/Houseofmvps"
  },
  "plugins": [
    {
      "name": "ultraship",
      "source": "./",
      "description": "Workflow + code review + frontend design + SEO/GEO/AEO + Lighthouse + security + browser testing"
    }
  ]
}
```

## 19. Agent Definitions

### code-reviewer
- Reads PR diff or staged changes
- Evaluates: correctness, performance, security, maintainability
- Outputs findings with severity levels (critical/high/medium/low/info) — same format as other auditors, fed into the deduction-based scoring algorithm
- Flags critical issues that block shipping

### seo-auditor
- Runs seo-scanner.mjs on all HTML files
- Checks for sitemap.xml, robots.txt, llms.txt
- Validates structured data
- Scores SEO/GEO/AEO separately

### perf-auditor
- Runs lighthouse-runner.mjs
- Parses scores and opportunities
- Applies auto-fixes for common issues
- Reports before/after scores

### security-auditor
- Runs dep audit, secret scan, OWASP check
- Checks HTTP headers if server running
- Applies safe auto-fixes (audit fix, header middleware)
- Reports findings by severity

### browser-verifier
- Uses Playwright MCP to:
  - Navigate to the app URL
  - Check for console errors
  - Verify key pages load
  - Take screenshots for visual verification
- Reports PASS/FAIL with evidence

## 20. Zero-Blocker Guarantee

Every potential failure mode has graceful degradation:

| Scenario | Behavior |
|---|---|
| No Chrome installed | Skip Lighthouse, report "Chrome needed for /perf" |
| No internet | Skip GSC/Bing, all other tools work offline |
| No package.json | Detect as non-Node project, skip npm-specific checks |
| No HTML files | Skip SEO audit, focus on API security |
| No git repo | Skip PR review, secret scan uses file list instead |
| No running server | Skip HTTP header check, suggest starting dev server |
| Lighthouse timeout | Return partial results with warning |
| GSC/Bing no API key | Skip silently, no error message |
| npm audit fails | Report error, continue with other checks |
| Large repo (>10k files) | Scan only tracked files, use `.gitignore` |
| No routes found | Generate minimal sitemap with index page |
| Python/Go/Rust project | Skip npm-specific checks. Secret scan + OWASP patterns still work. Language-specific audits planned for v1.2+ |

## 21. Performance Budget

| Operation | Target | Method |
|---|---|---|
| Plugin startup | <10ms | Skills are markdown, no runtime code |
| SessionStart hook | <10ms | Single bash script, stat + echo |
| /seo audit | <5s | htmlparser2-based file scanning |
| /perf audit | <30s | Lighthouse headless run |
| /secure audit | <10s | Dep audit + regex scanning |
| /ship (full) | <60s | Parallel agents if supported, sequential fallback ~90s. Bounded by Lighthouse. No re-run after fixes — scorecard reflects pre-fix state with fix count appended |
| MCP server start | On-demand | context7/playwright start on first tool call |

## 22. Launch Strategy

1. **GitHub:** Open source (MIT), README with scorecard screenshot, GIF demo
2. **Twitter/X:** Thread showing before/after scorecard, tag Claude Code account
3. **Hacker News:** "Show HN: I built a plugin that replaces 6 Claude Code plugins"
4. **Dev.to / Hashnode:** Tutorial: "Ship production-ready SaaS with one command"
5. **Product Hunt:** Launch with demo video
6. **Reddit:** r/SaaS, r/indiehackers, r/webdev

**Viral mechanics:**
- Scorecard output designed for screenshots
- `/ship` is a single memorable command
- "Replaces 6 plugins" is a compelling hook
- MIT license removes adoption friction
- Works immediately with zero config

## 23. Licensing & Attribution

- **License:** MIT
- **Credits in README:**
  - Superpowers plugin (workflow skills foundation)
  - Context7 (live documentation MCP)
  - Playwright MCP (browser testing)
- **Original work:** All SEO/GEO/AEO, Lighthouse, security, /ship pipeline, scorecard design

## 24. Future Roadmap

| Version | Feature |
|---|---|
| v1.1 | Cursor IDE support |
| v1.2 | Image optimization (WebP conversion, compression) |
| v1.3 | Multi-language SEO (hreflang, i18n) |
| v1.4 | Uptime monitoring integration |
| v1.5 | Custom audit rules (user-defined checks) |

## 25. Success Criteria

- 500+ GitHub stars in first month
- Featured in Claude Code community
- 3+ blog posts/tutorials by community members
- Used by 100+ builders in first quarter
- Median time-to-first-scorecard < 5 minutes (from install to running `/ship`)
- < 5% of GitHub issues are setup/config problems
