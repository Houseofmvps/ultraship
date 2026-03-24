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

**Built by [Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan), solo founder of [houseofmvps.com](https://houseofmvps.com)**

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

### /workflow: 14 Workflow Skills (Powered by Superpowers)

Ultraship bundles the full **Superpowers** skill suite. These aren't just prompts — they're structured, multi-step workflows that enforce discipline:

| Skill | What it does |
|---|---|
| **Brainstorming** | Guided idea-to-spec process. Asks clarifying questions one at a time, proposes 2-3 approaches with trade-offs, presents design for approval, writes spec doc, then hands off to planning. Includes optional visual companion for mockups in the browser. |
| **Writing Plans** | Turns specs into bite-sized implementation plans with exact file paths, complete code snippets, test commands, and commit messages. Every step is a 2-5 minute action. |
| **Test-Driven Development** | Enforces the red-green-refactor cycle. Write failing test first, run it, implement minimal code, run again, refactor, commit. No skipping steps. |
| **Systematic Debugging** | Root-cause tracing methodology. No guessing. Reproduce, isolate, trace, fix, verify. Includes defense-in-depth patterns and condition-based waiting. |
| **Subagent-Driven Development** | Dispatches a fresh subagent per task from your plan. Each task gets: implementation, spec compliance review, then code quality review. Two-stage review catches issues early. |
| **Executing Plans** | Batch execution of implementation plans with review checkpoints. For when you want to run through a plan in a separate session. |
| **Git Worktrees** | Isolate feature work in git worktrees. Smart directory selection, safety verification, clean branch setup. |
| **Code Review** | Request or receive code reviews with structured feedback, confidence scoring, and verification before completion. |
| **Finishing Branches** | Guides completion of development work — structured options for merge, PR, or cleanup. |
| **Verification Before Completion** | Requires running verification commands and confirming output before claiming work is done. Evidence before assertions. |
| **Writing Skills** | Create, test, and optimize new skills with eval frameworks and performance benchmarks. |
| **Frontend Design** | Generate distinctive, production-grade UI with Tailwind + shadcn/ui. Avoids generic AI aesthetics. |
| **CLAUDE.md Management** | Auto-create, audit, and revise CLAUDE.md files. Checks for stale rules, missing context, conflicting instructions. |
| **Deploy + Release** | Full deploy pipeline and automated release with changelog generation. |

These skills chain together naturally: **brainstorm** -> **write plan** -> **TDD** -> **review** -> **ship** -> **deploy** -> **release**.

---

### Context7: Live Documentation MCP Server

Ultraship includes the **Context7** MCP server by Upstash. Instead of Claude hallucinating outdated API docs, Context7 fetches **real, current documentation** for any library on the fly.

**How it works:**
- You ask Claude to use a library (React, Hono, Drizzle, Stripe, etc.)
- Context7 fetches the latest docs from the library's actual documentation site
- Claude gets accurate, version-correct API references in its context

**Why this matters for indie hackers:**
- No more debugging code that uses deprecated APIs
- No more "that method doesn't exist in v4" surprises
- Works with any npm/PyPI library automatically

---

### Playwright: Browser Testing MCP Server

Ultraship includes the **Playwright** MCP server by Anthropic. This gives Claude full browser automation capabilities:

**What it can do:**
- Navigate to your running app and take screenshots
- Click buttons, fill forms, select options
- Run multi-step user flows (signup, login, checkout)
- Check console for errors
- Verify page content and element visibility
- Upload files and handle dialogs

**How `/ship` uses it:**
- Auto-generates smoke tests from your routes
- Runs login, navigation, and form flows
- Reports pass/fail per route with screenshots on failure
- Browser test appears as a pass/fail line in the scorecard

**How you use it directly:**
- Ask Claude to "test the signup flow on localhost:3000"
- Claude opens the browser, fills the form, clicks submit, checks the result
- You get a screenshot and pass/fail without writing a single test file

---

### GEO + AEO: The AI Search Advantage

This is what makes Ultraship different from every other SEO plugin. Traditional SEO tools check meta tags. Ultraship checks if your content is optimized for **AI search engines**.

**GEO (Generative Engine Optimization)** — getting cited by ChatGPT, Perplexity, Gemini, and Claude when users ask questions in your domain.

| What Ultraship checks | Why it matters |
|---|---|
| `llms.txt` file exists | Tells AI crawlers what your site is about and what to index |
| AI crawler access in robots.txt | GPTBot, PerplexityBot, ClaudeBot, GoogleOther must not be blocked |
| Question-format H2 headings | AI search engines extract answers from Q&A-structured content |
| Structured data (JSON-LD) | AI models parse structured data more reliably than plain text |
| Definition paragraphs | Content that starts with "[Term] is..." gets extracted as answers |
| Concise answer blocks | 40-60 word paragraphs after headings are ideal for AI citation |

**AEO (Answer Engine Optimization)** — getting featured in Google snippets, voice assistants (Siri, Alexa), and AI overviews.

| What Ultraship checks | Why it matters |
|---|---|
| FAQPage schema | Directly eligible for Google FAQ rich results |
| Speakable markup | Tells voice assistants which content to read aloud |
| HowTo schema | Step-by-step content gets rich snippet treatment |
| Short answer paragraphs | Google extracts 40-50 word blocks as featured snippets |
| Breadcrumb structured data | Helps search engines understand site hierarchy |

**Ultraship auto-generates:**
- `llms.txt` and `llms-full.txt` from your HTML files
- AI-friendly `robots.txt` that allows all major AI crawlers
- `sitemap.xml` from your routes
- JSON-LD structured data for your pages

Most SEO tools don't even know GEO exists. Ultraship has 60+ rules for it.

---

### /design: Frontend UI Generation

Generate production-grade UI components from a text description:
- Outputs Tailwind CSS + shadcn/ui components
- Accessibility baked in (ARIA labels, keyboard navigation, focus management)
- Responsive layout (mobile-first)
- Avoids generic "AI-generated" aesthetics — aims for distinctive, polished design
- Supports dark mode, animations, and complex layouts

---

### /claude-md: CLAUDE.md Management

- **Creates** a CLAUDE.md from scratch if your project doesn't have one — reads package.json, directory structure, and README to generate context
- **Audits** existing CLAUDE.md files for stale rules, missing stack info, and conflicting instructions
- **Revises** with targeted updates based on what you built in the current session
- **SessionStart hook** checks CLAUDE.md age and reminds you to update if it's over 7 days old

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

**[Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan)** - Solo founder of **[houseofmvps.com](https://houseofmvps.com)**

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
