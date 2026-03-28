<div align="center">

<img src="assets/hero-banner.jpg" alt="Ultraship — Claude Code Plugin" width="100%"/>

### SEO + GEO + AEO auditing, security scanning, competitive analysis, launch prep, and 25 more tools for Claude Code.

**The first Claude Code plugin with Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO) — built for how search works in 2026.**

[![npm version](https://img.shields.io/npm/v/ultraship?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/ultraship)
[![npm downloads](https://img.shields.io/npm/dm/ultraship?style=for-the-badge&logo=npm&color=blue&label=Monthly%20Downloads)](https://www.npmjs.com/package/ultraship)
[![npm total](https://img.shields.io/npm/dt/ultraship?style=for-the-badge&logo=npm&color=cyan&label=Total%20Downloads)](https://www.npmjs.com/package/ultraship)
[![GitHub stars](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Houseofmvps/ultraship/ci.yml?style=for-the-badge&logo=github&label=Tests)](https://github.com/Houseofmvps/ultraship/actions)

---

[![Follow @kaileskkhumar](https://img.shields.io/badge/Follow%20%40kaileskkhumar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/kaileskkhumar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/kailesk-khumar-soundararajan)
[![houseofmvps.com](https://img.shields.io/badge/houseofmvps.com-Website-green?style=for-the-badge&logo=google-chrome&logoColor=white)](https://houseofmvps.com)
[![Sponsor](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Houseofmvps)

**Built by [Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan) at [houseofmvps.com](https://houseofmvps.com)**

</div>

---

## What is Ultraship?

Ultraship is a Claude Code plugin with 29 tools, 32 skills, 9 agents, and 27 commands. It covers the full build lifecycle: brainstorming, planning, implementation, code review, deployment, competitive analysis, launch preparation, incident response, and post-ship growth tracking.

**Search optimization for the AI era:** Ultraship audits your site across three layers — traditional SEO (Google, Bing), GEO (Generative Engine Optimization for ChatGPT, Perplexity, Gemini), and AEO (Answer Engine Optimization for featured snippets and voice assistants). 60+ rules check everything from `llms.txt` and AI-friendly `robots.txt` to question-format headings, FAQPage schema, and structured data that AI models can extract.

**1 dependency** (`htmlparser2`, 30KB). **113 unit tests.** MIT licensed. Free.

---

<div align="center">

<img src="assets/demo.gif" alt="Ultraship CLI Demo — SEO audit, secret scanning, scorecard" width="100%"/>

*SEO audit, secret scanning, and the /ship scorecard — all from your terminal.*

</div>

---

## Quick Start

### Install as a Claude Code plugin (recommended)

```bash
# Step 1: Add the Ultraship marketplace
claude plugin marketplace add Houseofmvps/ultraship

# Step 2: Install the plugin
claude plugin install ultraship
```

Restart Claude Code. All 32 skills, 29 tools, and 27 commands are active.

### Or try standalone

```bash
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
npx ultraship health https://yourapp.com
```

### Use in Claude Code

Once installed, use slash commands inside any Claude Code session:

```bash
/ship          # Full pre-deploy audit + scorecard
/seo           # SEO/GEO/AEO audit
/secure        # Security scan
/perf          # Bundle size + Lighthouse audit
/deploy        # Build -> audit -> deploy -> health check
/compete       # Competitive analysis vs a rival site
/launch        # Launch day copy + checklist + press kit
/rescue        # Incident diagnostics + rollback
/grow          # Post-ship growth metrics
/cost          # AI build cost tracking
```

---

## What's Inside

| Category | Count | Highlights |
|---|---|---|
| **Tools** | 29 | SEO scanner (60+ rules), secret scanner, code profiler, bundle tracker, dep doctor, competitive analyzer, launch prep, incident commander, growth tracker, cost tracker, architecture mapper, onboard generator |
| **Skills** | 32 | 16 workflow (brainstorming, TDD, debugging, planning, code review, frontend design) + 6 specialist (SEO, security, profiling) + 10 growth/launch/intelligence |
| **Agents** | 9 | Ship, code review, SEO, security, browser, competitive analysis, launch, incident response, growth |
| **Commands** | 27 | `/ship` `/seo` `/secure` `/compete` `/launch` `/rescue` `/grow` `/cost` `/onboard` `/architecture` `/demo` `/visual-diff` `/clone-patterns` and more |
| **MCP Servers** | 2 | Live library docs (Context7), browser automation (Playwright) |

---

## Features

### Auditing & Quality Gates

**`/ship` — Pre-Deploy Scorecard**
Runs 5 tools in parallel, scores 4 categories (SEO/GEO/AEO, Security, Code Quality, Bundle Size), produces a scorecard:

```
+===========================================+
|      U L T R A S H I P   S C O R E       |
+===========================================+
|  SEO/GEO/AEO    92/100  ############-    |
|  Security        95/100  ############-    |
|  Code Quality    88/100  ###########--    |
|  Bundle Size     97/100  ############-    |
+===========================================+
|   OVERALL         90/100                  |
|   STATUS          READY TO SHIP           |
+===========================================+
```

**`/seo` — SEO + GEO + AEO Audit (60+ rules across 3 search layers)**

| Layer | What it optimizes for | What Ultraship checks |
|---|---|---|
| **SEO** | Traditional search (Google, Bing) | Meta tags, canonical URLs, heading hierarchy, image alt text, sitemap, robots.txt, structured data, OG tags, redirect chains |
| **GEO** | AI search (ChatGPT, Perplexity, Gemini) | `llms.txt`, AI-friendly `robots.txt` (GPTBot, PerplexityBot, ClaudeBot), question-format headings, structured data for AI extraction, content depth scoring |
| **AEO** | Featured snippets & voice assistants | FAQPage schema, concise answer paragraphs, speakable markup, direct-answer formatting |

Plus: Flesch-Kincaid readability scoring, keyword density analysis, OG image reachability, cross-page canonical conflict detection, analytics provider detection (12 providers).

Most tools only check traditional SEO. In 2026, 40%+ of search discovery happens through AI assistants — GEO and AEO coverage is what separates sites that get cited from sites that get ignored.

**`/secure` — Security Scan**
Secret scanning (AWS keys, Stripe keys, JWT secrets, database URLs), OWASP pattern detection (eval, innerHTML, SQL concatenation), dependency audit via `npm audit`, unused/outdated dependency detection.

**`/profile` — Code Profiling**
Static analysis for N+1 queries, sync I/O in handlers, unbounded queries, missing indexes, memory leaks, sequential awaits, ReDoS risk.

**`/perf` — Performance Audit**
Lighthouse via headless Chrome. Core Web Vitals (LCP, FID, CLS), render-blocking resources, unoptimized images, compression checks.

**`/bundle` — Bundle Size Tracking**
Analyzes build output directories, reports top 10 largest files, detects heavy dependencies with lighter alternatives (`moment` -> `dayjs`, `lodash` -> native), saves reports for before/after comparison.

**`/deps` — Dependency Health**
Detects unused dependencies via import graph analysis. Identifies dead wrapper files. Flags outdated packages. Monorepo-aware.

### Competitive Intelligence & Launch

**`/compete` — Competitive X-Ray** *(new in v2.0)*
Compare your site against a competitor on tech stack, SEO score, performance, and security headers. Generates a shareable ASCII comparison card.

**`/launch` — Launch Day Autopilot** *(new in v2.0)*
Reads your project and generates Product Hunt copy, Twitter thread, LinkedIn post, Hacker News post, a 14-item launch checklist, press kit, and launch day timeline.

**`/rescue` — Incident Commander** *(new in v2.0)*
Production incident diagnostics: health check, git culprit analysis (last 5 commits), error pattern scanning, env var validation, rollback commands, and post-mortem template.

**`/grow` — Growth Intelligence** *(new in v2.0)*
Tracks uptime, git velocity (commits/week, deploy frequency), SEO trajectory, dependency health, and code quality trends over time. Stores snapshots for week-over-week comparison.

**`/cost` — AI Cost Tracker** *(new in v2.0)*
Log token usage per feature and model. Built-in pricing for Claude, GPT-4o, Gemini. Shows daily trends, per-feature breakdown, and optimization insights.

### Project Understanding

**`/onboard` — Project Onboarding** *(new in v2.0)*
Auto-generates a developer onboarding guide: tech stack, directory tree, API routes, database schema, env vars, gotchas, and a Mermaid architecture diagram.

**`/architecture` — Living Architecture Map** *(new in v2.0)*
Generates 4 Mermaid diagrams from your codebase: system overview, route tree, database ER diagram, and data flow sequence. Detects circular dependencies and orphan modules.

**`/clone-patterns` — Learn From the Best** *(new in v2.0)*
Analyze any repo's patterns (testing, error handling, TypeScript usage, CI/CD, git practices) and compare them to yours. Generates a prioritized adoption plan.

**`/demo` — Demo-Ready Mode** *(new in v2.0)*
Finds console.logs, TODOs, placeholder text, missing favicons, and other dev artifacts. Scores demo readiness and generates a walkthrough from your routes.

**`/visual-diff` — Visual Regression** *(new in v2.0)*
Uses Playwright MCP to take before/after screenshots across viewports and compare them.

### Workflow Skills

Ultraship includes 16 workflow skills that activate based on context during your Claude Code session:

| Skill | What it does |
|---|---|
| **Brainstorming** | Asks clarifying questions, proposes approaches with trade-offs, writes a spec before code |
| **Planning** | Breaks spec into implementation steps with file paths, test commands, and commit messages |
| **TDD** | Enforces red-green-refactor: failing test first, then implementation, then cleanup |
| **Implementation** | Follows the plan step by step with review checkpoints |
| **Code Review** | Reviews with confidence scoring, catches N+1 queries, security issues, anti-patterns |
| **Debugging** | Reproduces first, narrows root cause, writes regression test |
| **Refactoring** | Verifies behavior preserved via tests |
| **Frontend Design** | Uses your existing stack, handles responsive/a11y/dark mode |
| **API Design** | REST/RPC conventions, schema validation, error handling, versioning |
| **Data Modeling** | Schema design, migration safety, index checks |
| **Git Workflow** | Branching, commits, PRs, merge strategy |
| **CLAUDE.md Management** | Updates project instructions with session learnings |
| **Deploy Pipeline** | Env validation, migration check, build, ship, health check |
| **Release** | Changelog, version bump, GitHub release, npm publish |
| **Generators** | sitemap.xml, robots.txt, llms.txt, JSON-LD structured data |
| **Browser Testing** | Navigate, click, fill forms, screenshot via Playwright MCP |

### Additional Tools

| Tool | Purpose |
|---|---|
| `content-scorer` | Readability (Flesch-Kincaid), keyword density, GEO heading analysis |
| `og-validator` | Open Graph tag validation, image reachability |
| `redirect-checker` | Redirect chain/loop detection, sitemap-based bulk check |
| `health-check` | Production health: status, response time, SSL, security headers |
| `env-validator` | Compares .env.example against actual .env |
| `migration-checker` | Pending DB migrations (Drizzle, Prisma, Knex) |
| `audit-history` | Saves/compares audit scores over time |
| `api-smoke-test` | API endpoint smoke testing (status, response times, CORS) |
| `gsc-client` | Google Search Console API (optional, JWT auth) |
| `bing-webmaster` | Bing Webmaster API (optional, API key auth) |
| `sitemap-generator` | Generates sitemap.xml from HTML files |
| `robots-generator` | AI-friendly robots.txt |
| `structured-data-generator` | JSON-LD schema markup |
| `llms-txt-generator` | llms.txt for AI discoverability |

---

## Dogfooded in Production

`/ship` on [SaveMRR](https://savemrr.co) (AI retention platform — Hono + React + Drizzle pnpm monorepo):

**Backend + Dashboard (5 workspace packages, 41 route handlers):**

| Metric | Score |
|---|---|
| SEO/GEO/AEO | 63/100 |
| Security | 100/100 |
| Code Quality | 70/100 |
| Bundle Size | 100/100 |
| Overall | **83/100 — READY TO SHIP** |

**Landing Page (29 pre-rendered HTML pages):**

| Metric | Score |
|---|---|
| SEO/GEO/AEO | 52/100 |
| Security | 100/100 |
| Code Quality | 67/100 |
| Bundle Size | 92/100 |
| Overall | **78/100 — NEEDS WORK** |

**227 findings across both audits.** Examples: 1 real N+1 query in a background job, 33 unused dependencies in the landing page, 153 SEO issues (missing structured data, title length, no AI-friendly headings), 1 memory leak (module-scoped array with `.push()`), 1 heavy dependency (`date-fns`).

---

## Security

| Protection | How |
|---|---|
| **No shell injection** | `execFileSync` with array args everywhere — zero shell interpolation |
| **SSRF protection** | All HTTP tools block private IPs, cloud metadata, non-HTTP schemes |
| **No telemetry** | Zero data collection. No phone-home. |
| **1 dependency** | `htmlparser2` only (30KB). No native bindings. No `node-gyp`. |
| **113 unit tests** | Security module, secret scanner, SEO scanner, code profiler, content scorer, dep doctor, CLI scorecard |
| **Secret redaction** | Found secrets truncated in output. Env values never logged. |
| **File safety** | 10MB read cap. 5MB response cap. Restrictive write permissions. |

See [SECURITY.md](SECURITY.md) for full details.

---

## Contributing

Found a bug? Want a new auditor? [Open an issue](https://github.com/Houseofmvps/ultraship/issues) or PR.

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm test              # 113 tests, node:test
node tools/<tool>.mjs # No build step — tools run directly
```

---

## Sponsor

Ultraship is free and MIT licensed. If it saved you time, consider [sponsoring on GitHub](https://github.com/sponsors/Houseofmvps).

---

## License

MIT — [LICENSE](LICENSE).

---

<div align="center">

**[Star the repo](https://github.com/Houseofmvps/ultraship) if you find it useful.**

[![Star on GitHub](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)

</div>
