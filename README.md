# ultraship

**Ship production-ready SaaS with one command.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What it does

Ultraship is an all-in-one Claude Code plugin that replaces six separate tools with a single integrated toolkit. One install gives you structured workflow skills, AI-powered code review, production-grade UI generation, SEO/GEO/AEO optimization, Lighthouse performance audits with auto-fix, security scanning, Playwright browser tests, and CLAUDE.md management — all wired together and surfaced through a single `/ship` command that scores your project before every deploy.

---

## The /ship command

Run `/ship` before any deploy. Ultraship audits your project across five dimensions and returns a scorecard:

```
====================================
  ULTRASHIP SCORECARD
====================================
  SEO/GEO/AEO    92/100  [==========-]
  Performance     87/100  [========---]
  Security        95/100  [==========-]
  Code Quality    88/100  [========---]
  Browser Test    PASS

  OVERALL         90/100
  STATUS          READY TO SHIP
====================================
  Fixed: 7 issues auto-resolved
  Remaining: 2 manual items
====================================
```

Auto-fixable issues are resolved inline. Manual items are listed with exact file and line references. Nothing ships without a score.

---

## What Ultraship Replaces

| Plugin | What ultraship provides instead |
|---|---|
| superpowers | 14 workflow skills (brainstorming, TDD, debugging, planning, and more) |
| context7 | Live documentation lookups via integrated MCP server |
| playwright | Smoke test generation and browser test execution |
| code-review | PR review with confidence scoring and severity tagging |
| frontend-design | Production-grade UI component generation |
| claude-md-management | CLAUDE.md auto-creation, auditing, and revision |

---

## Features

### Workflow
14 skills covering the full build cycle: brainstorming, TDD, debugging, planning, architecture review, refactoring, sprint planning, estimation, documentation, API design, database schema, onboarding, retrospective, and release notes.

### Code Review
Pull request review with confidence scoring, severity tagging (critical / warning / suggestion), and inline diff comments. Flags security issues, logic errors, and test gaps.

### Frontend Design
Production-grade UI generation from a description or screenshot. Outputs Tailwind + shadcn/ui components with accessibility and responsive layout baked in.

### SEO / GEO / AEO
- SEO: meta tags, canonical URLs, structured data, sitemap validation
- GEO: geographic targeting signals, hreflang, localized content checks
- AEO: answer engine optimization — structures content for AI citation in ChatGPT, Perplexity, and similar tools

### Performance
Lighthouse audits via headless Chrome. Auto-fixes image formats, defers non-critical JS, adds resource hints. Reports CLS, LCP, FID with before/after scores.

### Security
Dependency audit (npm/pnpm), secret scanning, OWASP Top 10 checklist, HTTP security header validation. Blocks ship if critical vulnerabilities are found.

### Browser Testing
Playwright smoke tests auto-generated from your routes. Runs login, navigation, and form flows. Outputs pass/fail per route with screenshots on failure.

### CLAUDE.md Management
Generates a CLAUDE.md from your project structure if none exists. Audits existing files for stale rules, missing stack context, and conflicting instructions. Proposes revisions with a diff.

---

## Commands

| Command | Description |
|---|---|
| `/ship` | Full pre-deploy audit — runs all checks and returns the scorecard |
| `/review` | Code review of staged changes or a PR |
| `/design` | Generate a UI component from a description |
| `/seo` | Run SEO/GEO/AEO audit only |
| `/perf` | Run Lighthouse performance audit only |
| `/security` | Run security scan only |
| `/test` | Generate and run Playwright smoke tests |
| `/workflow` | Access the 14 workflow skills interactively |
| `/claude-md` | Create or audit CLAUDE.md for this project |

---

## Quick Start

```bash
# Install via npm
npm install -g ultraship

# Or add as a Claude Code plugin
claude plugin add ultraship

# Run a full pre-deploy audit
/ship
```

No configuration required. Ultraship reads your project structure, package.json, and existing CLAUDE.md (if any) to self-configure on first run.

---

## Architecture

| Layer | Count | Details |
|---|---|---|
| Skills | 20 | 14 workflow + 6 specialist skills |
| Agents | 5 | ship, review, seo, security, browser |
| Commands | 9 | /ship, /review, /design, /seo, /perf, /security, /test, /workflow, /claude-md |
| Tools | 9 | audit, scan, lighthouse, playwright, diff, schema, sitemap, headers, secrets |
| Hook | 1 | pre-commit hook that blocks on critical security findings |
| MCP Servers | 2 | context7 (live docs), playwright (browser automation) |

---

## Credits

- **Superpowers** by Jesse Vincent — workflow skills foundation, used under MIT license
- **Context7** by Upstash — live documentation MCP server
- **Playwright MCP** by Anthropic — browser automation and testing

---

## License

MIT — see [LICENSE](LICENSE) for details.
