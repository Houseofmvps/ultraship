<div align="center">

# ULTRASHIP

### Replace 6 Claude Code plugins with 1. Ship production-ready SaaS with a single command.

[![npm version](https://img.shields.io/npm/v/ultraship?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/ultraship)
[![npm downloads](https://img.shields.io/npm/dm/ultraship?style=for-the-badge&logo=npm&color=blue&label=Monthly%20Downloads)](https://www.npmjs.com/package/ultraship)
[![npm total](https://img.shields.io/npm/dt/ultraship?style=for-the-badge&logo=npm&color=cyan&label=Total%20Downloads)](https://www.npmjs.com/package/ultraship)
[![GitHub stars](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=silver)](https://github.com/Houseofmvps/ultraship/network)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](LICENSE)

---

[![Follow @kaileskkhumar](https://img.shields.io/badge/Follow%20%40kaileskkhumar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/kaileskkhumar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/kailesk-khumar-soundararajan)
[![houseofmvps.com](https://img.shields.io/badge/houseofmvps.com-Website-green?style=for-the-badge&logo=google-chrome&logoColor=white)](https://houseofmvps.com)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-orange?style=for-the-badge&logo=anthropic)](https://github.com/Houseofmvps/ultraship)

**Built by [Kaileskkhumar](https://x.com/kaileskkhumar), solo founder of [houseofmvps.com](https://houseofmvps.com)**

*One indie hacker. One plugin. Everything you need to ship.*

</div>

---

## The Problem

You're a solo founder building a SaaS. Before every deploy, you're juggling:

- One plugin for code review
- One for SEO checks
- One for performance audits
- One for security scanning
- One for browser testing
- One for workflow automation

Six plugins. Six configs. Six things fighting for context window. And you STILL forget to check your OG tags.

## The Solution

```bash
/ship
```

One command. Ultraship audits your entire project across **5 dimensions**, auto-fixes what it can, and gives you a score:

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

**Score >= 80?** Ship it. **Below 80?** Ultraship already fixed 7 issues for you. Fix the remaining 2 and run again.

---

## Quick Start

```bash
# Install as a Claude Code plugin (recommended)
claude plugin add ultraship

# Or install globally via npm
npm install -g ultraship
```

Then in any project:

```bash
/ship          # Full pre-deploy audit + auto-fix
/seo           # SEO/GEO/AEO audit only
/security      # Security scan only
/deploy        # Build -> audit -> deploy -> health check
```

**Zero configuration.** Ultraship reads your project structure and self-configures.

---

## What Ultraship Replaces

| Plugin you're using now | What Ultraship gives you instead |
|---|---|
| **superpowers** | 14 workflow skills: brainstorming, TDD, debugging, planning, code review, git worktrees |
| **context7** | Live documentation lookups via integrated MCP server |
| **playwright** | Smoke test generation and browser test execution |
| **code-review plugins** | PR review with confidence scoring, severity tagging, inline comments |
| **frontend-design** | Production-grade UI generation (Tailwind + shadcn/ui) |
| **claude-md-management** | CLAUDE.md auto-creation, auditing, and revision |

**One install. All six. Plus 14 more tools they don't have.**

---

## Every Feature, Explained

### /ship: The Pre-Deploy Quality Gate

The flagship command. Dispatches 5 parallel agents, runs 10 inline checks, auto-fixes issues, and produces the scorecard.

**What it checks:**
- SEO/GEO/AEO: 60+ rules including meta tags, canonical URLs, structured data, llms.txt, AI crawler access
- Performance: Lighthouse via headless Chrome, Core Web Vitals, bundle size analysis
- Security: dependency vulnerabilities, secret scanning, OWASP patterns, HTTP headers
- Code Quality: N+1 queries, sync I/O in handlers, memory leaks, unused deps
- Browser: Playwright smoke tests on your running app

**What it auto-fixes:**
- Missing meta tags, broken canonical URLs, OG tag issues
- Security header middleware generation
- `.env` added to `.gitignore` if missing
- Safe dependency updates

---

### /seo: SEO / GEO / AEO Audit

**60+ rules** across three optimization layers:

| Layer | What it means | What Ultraship checks |
|---|---|---|
| **SEO** | Traditional search engines (Google, Bing) | Meta tags, canonical URLs, heading hierarchy, image alt text, sitemap, robots.txt, structured data |
| **GEO** | Generative Engine Optimization (ChatGPT, Perplexity, Gemini search) | `llms.txt`, AI-friendly robots.txt, question-format headings, structured data for AI extraction |
| **AEO** | Answer Engine Optimization (featured snippets, voice assistants) | FAQPage schema, speakable markup, concise answer paragraphs, definition patterns |

**Bonus tools:**
- Content quality scoring (Flesch-Kincaid readability, keyword density)
- OG tag validation with image reachability check
- Redirect chain/loop detection
- Analytics detection (GA4, Plausible, PostHog, and 7 more)
- Cross-page canonical conflict detection

---

### /security: Security Hardening

| Check | Details |
|---|---|
| **Dependency audit** | `pnpm audit` / `npm audit` / `yarn audit` with auto-fix |
| **Secret scanning** | AWS keys, Stripe keys, OpenAI keys, GitHub tokens, private keys, JWT secrets, database URLs |
| **OWASP patterns** | Dangerous code execution, innerHTML, SQL concatenation, mixed content |
| **HTTP headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| **Dependency health** | Unused deps, outdated packages, pinned versions |

Finds issues AND fixes them. Generates security header middleware for your framework (Hono, Express, Next.js).

---

### /deploy: Full Deploy Pipeline

```
Pre-flight checks -> /ship audit -> Deploy -> Health check -> Score saved
```

| Step | What happens |
|---|---|
| **Env validation** | Compares `.env.example` to actual env: catches missing/empty/placeholder vars |
| **Migration safety** | Detects pending DB migrations (Drizzle, Prisma, Knex) |
| **Bundle check** | Analyzes build output size, warns on growth |
| **Ship audit** | Full `/ship` scorecard: blocks deploy if score < threshold |
| **Deploy** | `git push` (Vercel), `railway up`, `fly deploy`, or custom command |
| **Health check** | Hits production URL: status code, response time, SSL cert, security headers |
| **History** | Saves score for trend tracking |

---

### /review: AI Code Review

Reviews staged changes or a specific PR with:
- **Confidence scoring** - only flags issues it's sure about
- **Severity tagging** - critical, warning, suggestion
- **Inline diff references** - exact file and line
- **Security focus** - injection, XSS, auth bypass detection
- **Test gap analysis** - spots untested code paths

---

### /perf: Performance Audit

Lighthouse via headless Chrome with:
- Core Web Vitals extraction (LCP, CLS, TBT, FCP, SI, TTI)
- LCP element identification
- Unused JS/CSS quantification
- Third-party impact analysis
- Top 10 opportunities ranked by savings

---

### /health: Production Health Check

```bash
/health https://yourapp.com
```

Checks: HTTP status, response time, SSL certificate validity and expiry, redirect chains, 6 security headers, server identification. Gives you a health assessment with specific issues.

---

### /content: Content Quality Analysis

- **Flesch Reading Ease** and **Flesch-Kincaid Grade Level**
- Keyword density analysis with optional target keyword
- Thin content detection (< 300 words)
- Wall-of-text warnings (150+ word paragraphs)
- GEO heading analysis: are your H2s phrased as questions for AI search?

---

### /bundle: Bundle Size Tracking

- Analyzes `dist/`, `build/`, `.next/`, `out/` directories
- Reports JS/CSS/image sizes with largest files
- Detects heavy dependencies with lighter alternatives (`moment` -> `dayjs`, `lodash` -> native, `axios` -> `fetch`)
- Saves reports for before/after comparison with `--save`
- Warns on unexpected growth between builds

---

### /profile: Code Performance Analysis

Static analysis for backend anti-patterns:
- **N+1 queries** - database calls inside loops
- **Sync I/O** - blocking file reads in request handlers
- **Unbounded queries** - `findMany` without `take`/`limit`
- **Missing indexes** - foreign keys without database indexes
- **Memory leaks** - module-scoped arrays with `.push()`
- **Sequential awaits** - independent `await`s that should be `Promise.all()`

---

### /deps: Dependency Doctor

- Detects unused production dependencies via import scanning
- Finds unused dev dependencies
- Flags significantly outdated packages
- Recommends `^` for pinned versions
- Confirms before recommending removal

---

### /release: Automated Releases

Determines version bump from commit messages, generates changelog, bumps `package.json`, commits and tags, pushes, creates GitHub release, publishes to npm.

---

### /redirects: Redirect Chain Checker

- Follows redirect chains up to 10 hops
- Detects redirect loops
- Flags mixed HTTP/HTTPS chains
- Recommends 301 over 302 for SEO
- Supports bulk checking from sitemap

---

### More Commands

| Command | What it does |
|---|---|
| `/design` | Generate production-grade UI components from a description |
| `/test` | Generate and run Playwright smoke tests |
| `/workflow` | Access 14 workflow skills (brainstorming, TDD, debugging, planning) |
| `/claude-md` | Create, audit, or revise CLAUDE.md for your project |

---

## How It Works

```
You type /ship
    |
    |-- Detects project type (API, landing page, full-stack)
    |-- Runs pre-flight checks (env vars, migrations, bundle)
    |
    |-- Dispatches 5 parallel agents:
    |   |-- SEO Auditor ---- 60+ rules, cross-page analysis
    |   |-- Perf Auditor --- Lighthouse, Core Web Vitals
    |   |-- Security ------- Deps, secrets, OWASP, headers
    |   |-- Code Reviewer -- Quality, N+1, memory leaks
    |   +-- Browser -------- Playwright smoke tests
    |
    |-- Runs inline checks:
    |   |-- Content quality (readability, keyword density)
    |   |-- OG tag validation (image reachability)
    |   |-- Bundle analysis (size, heavy deps)
    |   |-- Code profiling (N+1, sync I/O, leaks)
    |   +-- Dependency health (unused, outdated)
    |
    |-- Auto-fixes everything it safely can
    |
    +-- Outputs the scorecard
        |-- >= 80: READY TO SHIP
        |-- 60-79: NEEDS WORK
        +-- < 60:  NOT READY
```

---

## Full Architecture

```
ultraship/
  .claude-plugin/     Plugin manifest
  skills/             22 skills (14 workflow + 8 specialist)
  agents/              5 agents (ship, review, seo, security, browser)
  commands/           18 slash commands
  tools/              21 Node.js tools + shared security module
  hooks/               1 pre-commit security hook
  SECURITY.md          Full security documentation
```

| Layer | Count | Details |
|---|---|---|
| **Skills** | 22 | Brainstorming, TDD, debugging, planning, code review, git worktrees, deploy, release, SEO audit, security audit, perf audit, frontend design, CLAUDE.md management |
| **Agents** | 5 | Ship orchestrator, code reviewer, SEO auditor, security auditor, browser verifier |
| **Commands** | 18 | /ship, /deploy, /review, /design, /seo, /perf, /security, /health, /content, /redirects, /bundle, /release, /profile, /deps, /test, /workflow, /claude-md, /brainstorm |
| **Tools** | 21 | SEO scanner (60+ rules), content scorer, OG validator, redirect checker, Lighthouse runner, health check, env validator, migration checker, bundle tracker, audit history, API smoke test, code profiler, dep doctor, GSC client, Bing client, secret scanner, sitemap/robots/structured-data/llms-txt generators, shared security module |
| **MCP Servers** | 2 | Context7 (live docs), Playwright (browser automation) |

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| HTML parsing | htmlparser2 (SAX-based, ~30KB) |
| Performance | Lighthouse via headless Chrome |
| Browser testing | Playwright MCP |
| Documentation | Context7 MCP |
| Build step | None: tools run directly as `.mjs` files |
| Dependencies | 1 (`htmlparser2`) |

---

## Security

Ultraship is secure by default. See [SECURITY.md](SECURITY.md) for the full details.

| Protection | How |
|---|---|
| **No shell injection** | All subprocess calls use `execFileSync` with array args, no shell interpolation |
| **SSRF protection** | All HTTP tools block private IPs, cloud metadata endpoints, non-HTTP schemes |
| **No telemetry** | Zero data collection. No analytics. No phone-home. Ever. |
| **No background processes** | Every tool is stateless: runs, outputs JSON, exits |
| **1 dependency** | `htmlparser2` only. No native bindings. No `node-gyp`. Clean install everywhere. |
| **Secret redaction** | Found secrets are truncated in output. Env values never logged. |
| **File safety** | 10MB read cap. 5MB response cap. Restrictive write permissions. |
| **Supply chain** | Lighthouse pinned to major version. No postinstall scripts. |

---

## Who Is This For?

Ultraship is built for **builders who ship fast and ship alone**:

- **Solo founders** building their first SaaS
- **Indie hackers** launching side projects
- **Micro-SaaS founders** ($0-50K MRR)
- **AI founders** building on Claude, GPT, or other LLMs
- **Bootstrapped teams** (1-3 people) who can't afford separate tools
- **SEO specialists** who want GEO/AEO optimization for AI search
- **Marketers** who want to audit content quality and social previews
- **Developers** who want one plugin instead of six

---

## Built By

<div align="center">

**[Kaileskkhumar](https://x.com/kaileskkhumar)** - Solo founder of **[houseofmvps.com](https://houseofmvps.com)**

Building MVPs and shipping SaaS products as a one-person team. Ultraship was born from the frustration of juggling six different Claude Code plugins while trying to ship production-ready products fast.

*"I was spending more time configuring plugins than writing code. So I built one plugin that does everything."*

[![Twitter](https://img.shields.io/badge/Twitter-@kaileskkhumar-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://x.com/kaileskkhumar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Kaileskkhumar-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/kailesk-khumar-soundararajan)
[![Website](https://img.shields.io/badge/Website-houseofmvps.com-green?style=flat-square&logo=google-chrome&logoColor=white)](https://houseofmvps.com)

</div>

---

## Credits

- **[Superpowers](https://github.com/anthropics/claude-plugins-official)** by Jesse Vincent - workflow skills foundation (MIT license)
- **[Context7](https://github.com/upstash/context7)** by Upstash - live documentation MCP server
- **[Playwright MCP](https://github.com/anthropics/claude-plugins-official)** by Anthropic - browser automation

---

## Contributing

Found a bug? Want a new auditor? Open an issue or PR.

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
# No build step: edit tools/*.mjs directly
# Test with: node tools/<tool>.mjs <args>
```

---

## License

MIT - see [LICENSE](LICENSE) for details.

**Free forever.** No pro tier. No paywalls. No "upgrade for more scans."

---

<div align="center">

**If Ultraship helped you ship faster, [star the repo](https://github.com/Houseofmvps/ultraship) and tell a friend.**

[![Star on GitHub](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)

</div>
