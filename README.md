<div align="center">

<img src="assets/hero-banner.jpg" alt="Ultraship — Claude Code Plugin for Solo Founders" width="100%"/>

# From `idea` to `first paying customer`. Inside Claude Code.

You brainstorm it. You spec it. You build it with TDD. You audit it. You ship it. You launch it. You track growth. You handle incidents. You iterate.

Ultraship handles every step — 29 tools, 32 skills, 9 agents, 27 commands — so you never leave your terminal.

[![npm version](https://img.shields.io/npm/v/ultraship?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/ultraship)
[![npm downloads](https://img.shields.io/npm/dm/ultraship?style=for-the-badge&logo=npm&color=blue&label=Monthly%20Downloads)](https://www.npmjs.com/package/ultraship)
[![npm total](https://img.shields.io/npm/dt/ultraship?style=for-the-badge&logo=npm&color=cyan&label=Total%20Downloads)](https://www.npmjs.com/package/ultraship)
[![GitHub stars](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Houseofmvps/ultraship/ci.yml?style=for-the-badge&logo=github&label=Tests)](https://github.com/Houseofmvps/ultraship/actions)

<br/>

1 dependency. 113 tests. MIT. Free.

<br/>

[![Follow @kaileskkhumar](https://img.shields.io/badge/Follow%20%40kaileskkhumar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/kaileskkhumar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/kailesk-khumar-soundararajan)
[![houseofmvps.com](https://img.shields.io/badge/houseofmvps.com-Website-green?style=for-the-badge&logo=google-chrome&logoColor=white)](https://houseofmvps.com)
[![Sponsor](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Houseofmvps)

</div>

---

## You're a solo founder. Here's your week without Ultraship.

Monday — you build a feature. Claude writes code, you merge it, you push. No tests. No review. You'll find out it's broken in production.

Tuesday — you google "SEO checklist for SaaS." You spend 2 hours manually checking meta tags. You miss that ChatGPT and Perplexity can't even find your site because you forgot `llms.txt` and your `robots.txt` blocks AI crawlers. In 2026, that's half your organic discovery — gone.

Wednesday — you're ready to launch. You write a Product Hunt description from scratch. You forget the Twitter thread. You don't have a press kit. You wing it.

Thursday — production goes down. You `git log` and guess which commit broke it. You don't have rollback commands ready. Your post-mortem is a Slack message that says "fixed."

Friday — you have no idea if your SEO improved this week, how much your AI costs were, or whether your bundle got heavier. You're building blind.

**That's 5 days of preventable mistakes.** Not because you're bad — because you're one person doing the work of a 10-person team.

---

## Same week. With Ultraship.

```
Monday     → /ship         → Code reviewed, profiled, audited. N+1 caught. Secret leak blocked. Score: 91.
Tuesday    → /seo          → 60+ rules. SEO, GEO (AI search), AEO (voice/snippets). llms.txt generated.
Wednesday  → /launch       → PH copy, Twitter thread, LinkedIn, HN post, checklist, press kit. Done in 60 seconds.
Thursday   → /rescue       → Health check, git culprit found, rollback command generated, post-mortem template ready.
Friday     → /grow         → SEO trajectory, git velocity, dep health, bundle trends. All in one dashboard.
```

You didn't install 6 tools. You didn't leave Claude Code. You didn't think about it. You just typed a slash command and kept building.

---

<div align="center">

<img src="assets/demo.gif" alt="Ultraship in action — SEO audit, secret scanning, scorecard" width="100%"/>

*One command. Full audit. Actual score.*

</div>

---

## Install in 30 seconds

```bash
# As a Claude Code plugin (recommended)
claude plugin marketplace add Houseofmvps/ultraship
claude plugin install ultraship
```

Restart Claude Code. Done. Or try standalone:

```bash
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

---

## The Full Lifecycle — What You Get

### Phase 1: Idea → Code

You describe what you want to build. Ultraship turns Claude Code into a disciplined engineering partner.

| Skill | What happens |
|---|---|
| **Brainstorming** | Clarifying questions, 2-3 approaches with trade-offs, written spec before any code |
| **Planning** | Spec broken into steps — exact file paths, test commands, commit messages, dependency order |
| **TDD** | Failing test first. Then implementation. Then refactor. Every time. |
| **Implementation** | Follows the plan step by step. Review checkpoints built in. |
| **Frontend Design** | Your stack (React, Tailwind, shadcn/ui, whatever). Responsive, accessible, dark mode. |
| **API Design** | REST/RPC conventions, schema validation, error handling, versioning |
| **Data Modeling** | Schema design with indexes, constraints, migration safety (Drizzle, Prisma, Knex) |
| **Code Review** | Confidence-scored findings. N+1 queries, security holes, anti-patterns — with fix suggestions |
| **Debugging** | Reproduces first, narrows root cause, writes regression test |

This isn't a prompt library. These are workflow skills — they activate based on what you're doing and enforce discipline you'd get from a senior engineering team.

### Phase 2: Code → Ship

Your code is written. Now make sure it's actually ready.

**`/ship` — The Quality Gate**

5 tools run in parallel. 4 categories scored. One number tells you if you're ready:

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

What `/ship` catches:

| Tool | What it finds |
|---|---|
| **SEO scanner** (60+ rules) | Missing meta tags, broken canonicals, heading hierarchy, OG tags, structured data, AI discoverability |
| **Secret scanner** | AWS keys, Stripe keys, JWT secrets, database URLs in your code |
| **Code profiler** | N+1 queries, sync I/O in handlers, memory leaks, unbounded queries, ReDoS risk |
| **Bundle tracker** | Oversized builds, heavy deps (`moment` → `dayjs`, `lodash` → native), growth between deploys |
| **Dep doctor** | Unused dependencies, dead wrapper files, outdated packages (monorepo-aware) |

**`/secure`** — Dedicated security scan: secrets + OWASP patterns + `npm audit`
**`/profile`** — Dedicated code profiling: 7 anti-pattern categories with exact `file:line` locations
**`/perf`** — Lighthouse via headless Chrome: Core Web Vitals, render-blocking resources, compression
**`/bundle`** — Bundle analysis with history: before/after comparison, top 10 largest files
**`/deps`** — Import graph analysis: finds unused deps that `npm ls` misses
**`/deploy`** — Full pipeline: env validation → migration check → build → ship → health check

### Phase 3: Ship → Be Found

You shipped. Now the question is: **can anyone find you?**

Most developer tools check traditional SEO. But in 2026, a huge chunk of discovery happens through AI — ChatGPT citations, Perplexity answers, Gemini recommendations. If your site isn't optimized for AI search, you're invisible to a growing segment of your potential users.

**`/seo` — Three search layers. 60+ rules.**

| Layer | Who finds you | What Ultraship checks |
|---|---|---|
| **SEO** | Google, Bing users | Meta tags, canonical URLs, heading hierarchy, alt text, sitemap, robots.txt, structured data, OG tags, redirect chains |
| **GEO** | ChatGPT, Perplexity, Gemini users | `llms.txt`, AI-friendly `robots.txt` (GPTBot, PerplexityBot, ClaudeBot allowed), question-format headings, structured data AI models can extract, content depth |
| **AEO** | Voice assistants, featured snippets | FAQPage schema, concise answer paragraphs, speakable markup, direct-answer formatting |

**GEO** = Generative Engine Optimization. Make your content citable by AI search engines.
**AEO** = Answer Engine Optimization. Get pulled into featured snippets and voice results.

Plus: Flesch-Kincaid readability, keyword density, OG image reachability, cross-page canonical conflicts, analytics detection (12 providers).

Ultraship also generates what's missing:

| Generator | What it creates |
|---|---|
| **sitemap.xml** | From your HTML files and routes |
| **robots.txt** | AI-friendly — allows GPTBot, PerplexityBot, ClaudeBot |
| **llms.txt** | Makes your project discoverable by AI assistants |
| **JSON-LD** | Structured data markup for your pages |

**`/content`** — Readability scoring, keyword analysis, GEO heading audit, thin content detection

### Phase 4: Ship → Launch

You're ready to go public. You need launch copy — now.

**`/launch` — Launch Day Autopilot**

Reads your project (package.json, README, routes, git history) and generates:

- Product Hunt description
- Twitter/X thread
- LinkedIn post
- Hacker News post
- 14-item launch checklist (SEO, analytics, legal, brand, technical)
- Press kit
- Launch day timeline

**`/compete` — Know Your Battlefield**

Compare your live site against any competitor:

- Tech stack detection (framework, hosting, analytics, CSS, payments)
- SEO score comparison (10-point scale)
- Security header comparison (6 headers)
- Shareable ASCII comparison card

**`/demo` — Demo-Ready Mode**

Before your launch, make sure your app doesn't look like a dev environment:

- Finds `console.log`s, TODOs, placeholder text, debug UI
- Checks for missing favicon, default branding, missing error pages
- Scores demo readiness (90+ = ready, 70-89 = almost, <70 = needs work)
- Generates a walkthrough from your routes

### Phase 5: Launch → Grow

Your product is live. The launch is done. Now what?

**`/grow` — Growth Intelligence**

Tracks week-over-week:

- Uptime (live health check)
- Git velocity (commits/week, deploy frequency, active days)
- SEO trajectory (from audit history)
- Dependency health
- Code quality trends
- Stores snapshots for comparison

**`/cost` — AI Build Cost Tracker**

You're building with Claude, GPT-4o, Gemini. Do you know what each feature costs?

- Log token usage per feature and model
- Built-in pricing: Claude Opus/Sonnet/Haiku, GPT-4o/4o-mini/4.1, Gemini 2.5 Pro/Flash
- Daily cost trends, per-feature breakdown
- Optimization insights (which features burn the most tokens, which models to swap)

**`/rescue` — When Production Breaks**

3am. Site's down. You need answers, not guessing.

- Health check your production URL (status, response time, SSL, security headers)
- Git culprit analysis: which of the last 5 commits likely broke it
- Error pattern scan in your codebase
- Env var validation against `.env.example`
- Rollback commands generated and ready
- Post-mortem template

### Phase 6: Grow → Improve

**`/onboard` — Instant Project Onboarding**

New contributor? Returning to your own project after a month? Generates a developer guide:

- Tech stack summary, directory tree, API routes
- Database schema, env vars, setup steps
- Gotchas and Mermaid architecture diagram

**`/architecture` — Living Architecture Map**

4 auto-generated Mermaid diagrams from your codebase:

- System overview (what connects to what)
- Route tree (all API endpoints)
- Database ER diagram
- Data flow sequence diagram
- Plus: circular dependency detection, orphan module detection

**`/clone-patterns` — Learn From the Best**

Point it at any repo. It analyzes:

- Testing patterns, error handling, TypeScript usage
- CI/CD setup, git practices, dependency choices
- Compares against your project and generates a prioritized adoption plan

**`/visual-diff` — Visual Regression**

Uses Playwright MCP to screenshot your pages before and after changes, across viewports. No more "did that CSS change break the mobile layout?" guessing.

---

## Real Results — Dogfooded on a Production SaaS

`/ship` on [SaveMRR](https://savemrr.co) — an AI retention platform built with Hono + React + Drizzle (pnpm monorepo, 5 workspace packages, 41 route handlers):

| | Backend + Dashboard | Landing Page (29 HTML pages) |
|---|---|---|
| SEO/GEO/AEO | 63/100 | 52/100 |
| Security | 100/100 | 100/100 |
| Code Quality | 70/100 | 67/100 |
| Bundle Size | 100/100 | 92/100 |
| **Overall** | **83 — READY TO SHIP** | **78 — NEEDS WORK** |

**227 findings.** What it caught:

- 1 real N+1 query in a background job (9 seed-data loops correctly downgraded to low severity)
- 33 unused dependencies — dead shadcn/ui wrapper files detected via import graph analysis
- 153 SEO issues — missing structured data, title length, no AI-friendly headings
- 1 memory leak — module-scoped array with `.push()` growing unbounded
- 1 heavy dependency — `date-fns` in the landing page bundle

One command. 227 things a solo founder would have missed.

---

## Hardened for Real Use

| Protection | How |
|---|---|
| **No shell injection** | `execFileSync` with array args — zero shell interpolation |
| **SSRF protection** | All HTTP tools block private IPs, cloud metadata, non-HTTP schemes |
| **No telemetry** | Zero data collection. No phone-home. No analytics. |
| **1 dependency** | `htmlparser2` (30KB). No native bindings. No `node-gyp`. |
| **113 unit tests** | Security, secret scanner, SEO scanner, code profiler, content scorer, dep doctor, CLI |
| **Secret redaction** | Found secrets are truncated in output. Env values never logged. |
| **File safety** | 10MB read cap. 5MB response cap. 0o600 file permissions. |

See [SECURITY.md](SECURITY.md) for full details.

---

## All 27 Commands

| Command | What it does |
|---|---|
| `/ship` | Pre-deploy quality gate — 5 tools, 4 scores, 1 scorecard |
| `/seo` | SEO + GEO + AEO audit (60+ rules, 3 search layers) |
| `/secure` | Secret scanning + OWASP patterns + dependency audit |
| `/perf` | Lighthouse + bundle size analysis |
| `/deploy` | Full pipeline: env check → migrate → build → ship → health check |
| `/review` | Code review with confidence scoring |
| `/health` | Production health check (status, SSL, security headers) |
| `/compete` | Competitive X-Ray vs any rival site |
| `/launch` | Launch copy + checklist + press kit + timeline |
| `/rescue` | Incident diagnostics + rollback commands + post-mortem |
| `/grow` | Growth metrics: uptime, velocity, SEO trajectory, dep health |
| `/cost` | AI build cost tracking per feature and model |
| `/onboard` | Auto-generated developer onboarding guide |
| `/architecture` | 4 Mermaid diagrams from your codebase |
| `/clone-patterns` | Analyze any repo's patterns, compare to yours |
| `/demo` | Find dev artifacts, score demo readiness, generate walkthrough |
| `/visual-diff` | Before/after screenshot comparison across viewports |
| `/content` | Readability, keyword density, GEO heading analysis |
| `/bundle` | Bundle size tracking with heavy dep detection |
| `/profile` | N+1 queries, sync I/O, memory leaks, unbounded queries |
| `/deps` | Unused/outdated dependency detection via import graph |
| `/redirects` | Redirect chain and loop detection |
| `/release` | Changelog, version bump, GitHub release, npm publish |
| `/revise-claude-md` | Update CLAUDE.md with session learnings |
| `/brainstorm` | Start structured ideation with spec output |
| `/execute-plan` | Execute a written plan step by step |
| `/write-plan` | Write an implementation plan from a spec |

---

## Who This Is For

- **Solo founders** who can't afford to ship broken code, miss SEO, or launch unprepared
- **Indie hackers** building side projects nights and weekends who need every hour to count
- **Bootstrapped teams** (1-3 people) doing the work of 10 without the headcount
- **Any developer** using Claude Code who wants structured workflows instead of yolo-shipping

---

## Contributing

[Open an issue](https://github.com/Houseofmvps/ultraship/issues) or PR. The codebase is simple:

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm test              # 113 tests, node:test
node tools/<tool>.mjs # No build step — tools run directly
```

---

## Sponsor

Ultraship is free and MIT licensed. Built solo by [Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan) at [houseofmvps.com](https://houseofmvps.com). If it helped you ship, consider [sponsoring on GitHub](https://github.com/sponsors/Houseofmvps).

---

## License

MIT — [LICENSE](LICENSE).

---

<div align="center">

**[Star the repo](https://github.com/Houseofmvps/ultraship) if Ultraship made your build better.**

[![Star on GitHub](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)

</div>
