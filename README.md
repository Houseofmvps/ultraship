<div align="center">

<img src="assets/hero-banner.jpg" alt="Ultraship — All-in-one Claude Code Plugin" width="100%"/>

### The only Claude Code plugin you need. 20 tools. 22 skills. Ship production-ready SaaS with one command.

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

**Built by [Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan), solo founder of [houseofmvps.com](https://houseofmvps.com)**

*One indie hacker. One plugin. Everything you need to ship.*

</div>

---

<div align="center">

<img src="assets/demo.gif" alt="Ultraship CLI Demo — SEO audit, secret scanning, scorecard" width="100%"/>

*SEO audit, secret scanning, and the /ship scorecard — all from your terminal.*

</div>

---

## The Problem

You're a solo founder. You just spent 3 hours building a feature. Now you need to ship it. Here's what happens next:

- You ask Claude to review your code. It says "looks good" without catching the N+1 query you just introduced.
- You forget to check if your OG tags work. Your launch post on Twitter shows a broken preview for 6 hours.
- You deployed without running Lighthouse. Your LCP is 4.2 seconds. Google is already de-ranking you.
- Your `.env` has a placeholder `sk-...` that made it to production. You find out when Stripe emails you about the leaked key.
- ChatGPT and Perplexity can't cite your content because you blocked AI crawlers in `robots.txt` and you don't have an `llms.txt`.
- Your bundle is 2.3MB because `moment.js` is still in there. You didn't know `dayjs` is 2KB.
- You push to production and pray. No health check. No SSL verification. No security header audit.

That's not shipping. That's gambling.

## The Solution

```bash
/ship
```

One command. 5 tools scan your entire project in parallel — SEO, security, code quality, bundle size, and dependency health. Gives you a score:

```
╔══════════════════════════════════════════╗
║      U L T R A S H I P   S C O R E      ║
╠══════════════════════════════════════════╣
║  SEO/GEO/AEO    92/100  ████████████░   ║
║  Security        95/100  ████████████░   ║
║  Code Quality    88/100  ███████████░░   ║
║  Bundle Size     97/100  ████████████░   ║
╠══════════════════════════════════════════╣
║   OVERALL         90/100                 ║
║   STATUS          READY TO SHIP          ║
╚══════════════════════════════════════════╝
```

**Score >= 80?** Ship it. **Below 80?** Fix the remaining items and run again.

But `/ship` is just the final step. Ultraship changes how you build from the very first line of code.

---

## Quick Start

```bash
# As a Claude Code plugin (recommended)
claude plugin add ultraship

# Or try standalone — no plugin install needed
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
npx ultraship health https://yourapp.com
```

Then in Claude Code:

```bash
/ship          # Full pre-deploy audit + scorecard
/seo           # SEO/GEO/AEO audit
/secure        # Security scan
/perf          # Bundle size + Lighthouse audit
/deploy        # Build -> audit -> deploy -> health check
```

**Zero configuration.** Ultraship reads your project structure and self-configures.

---

## Dogfooded in Production

`/ship` on [SaveMRR](https://savemrr.co) (AI retention platform for indie SaaS — Hono + React + Drizzle pnpm monorepo):

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

**227 findings across both audits.** What it caught:

- **1 real N+1 query** in a background job (9 seed-data loops correctly downgraded to low priority)
- **33 unused dependencies** in landing page — dead shadcn/ui wrapper files detected via import graph analysis
- **153 SEO issues** — missing structured data, title/description length, no question-format headings for AI search
- **1 memory leak** — module-scoped array with `.push()` growing unbounded
- **1 heavy dependency** — `date-fns` detected in landing page bundle
- **SSL certificate** — valid, Let's Encrypt, 84 days until expiry

One command found all of this. No manual checklist. No guessing.

---

## How It Works

It starts before you write a single line of code.

1. **You describe what you want.** The brainstorming skill asks clarifying questions, proposes 2-3 approaches with trade-offs, and writes a spec for your approval.
2. **Planning breaks it down.** Exact file paths, code, test commands, commit messages. Every step is 2-5 minutes.
3. **TDD is enforced.** Write the failing test first. Implement the minimum code to pass. Refactor. Commit.
4. **When you're ready:** `/ship` runs 5 tools in parallel, scans for issues, and produces the scorecard.
5. **Score >= 80?** Ship it. Below 80? Fix the flagged issues and run again.

Skills activate automatically based on what you're doing. Zero configuration.

---

## What's Inside

| Category | Count | Highlights |
|---|---|---|
| **Tools** | 20 | SEO scanner (60+ rules), secret scanner, code profiler, bundle tracker, dep doctor, content scorer |
| **Skills** | 22 | Brainstorming, TDD, debugging, planning, code review, frontend design, verification |
| **Commands** | 17 | `/ship` `/seo` `/secure` `/perf` `/deploy` `/review` `/health` `/bundle` `/profile` `/deps` and more |
| **MCP Servers** | 2 | Live library docs (Context7), browser automation (Playwright) |

<details>
<summary><strong>All 17 commands</strong></summary>

| Command | What it does |
|---|---|
| `/ship` | Pre-deploy quality gate — 5 tools in parallel, scorecard |
| `/seo` | SEO/GEO/AEO audit (60+ rules) |
| `/secure` | Security scan — secrets, OWASP patterns |
| `/perf` | Bundle size + Lighthouse audit |
| `/deploy` | Full pipeline — env check, migrate, build, ship, health check |
| `/review` | Code review with confidence scoring |
| `/health` | Production health check (status, SSL, headers) |
| `/content` | Content quality — readability, keyword density, GEO headings |
| `/bundle` | Bundle size tracking with heavy dep detection |
| `/profile` | Backend anti-patterns — N+1, sync I/O, memory leaks |
| `/deps` | Unused/outdated dependency detection |
| `/redirects` | Redirect chain/loop checker |
| `/release` | Changelog, version bump, GitHub release, npm publish |
| `/brainstorm` | Idea-to-spec with clarifying questions |
| `/write-plan` | Spec to bite-sized implementation plan |
| `/execute-plan` | Execute plan with review checkpoints |
| `/revise-claude-md` | Update CLAUDE.md with session learnings |

[Full feature docs](docs/features.md)

</details>

---

## Every Feature, Explained

### /ship: The Pre-Deploy Quality Gate

The flagship command. Runs 5 tools in parallel, scores 4 categories, and produces the scorecard.

**What it checks:**
- **SEO/GEO/AEO:** meta tags, canonical URLs, structured data, llms.txt, AI crawler access, heading hierarchy, OG tags (60+ rules via seo-scanner)
- **Security:** secret scanning — AWS, Stripe, OpenAI, GitHub tokens, private keys, DB URLs (via secret-scanner)
- **Code Quality:** N+1 queries, sync I/O in handlers, memory leaks, unbounded queries, sequential awaits, unused/outdated dependencies (via code-profiler + dep-doctor)
- **Bundle Size:** build output size, heavy dependency detection with lighter alternatives (via bundle-tracker)

**Failed audits show `FAIL`** — not false "READY TO SHIP". If a tool crashes or times out, you'll know.

---

### /seo: SEO / GEO / AEO Audit

**60+ rules** across three optimization layers:

| Layer | What it means | What Ultraship checks |
|---|---|---|
| **SEO** | Traditional search (Google, Bing) | Meta tags, canonical URLs, heading hierarchy, image alt text, sitemap, robots.txt, structured data |
| **GEO** | Generative Engine Optimization (ChatGPT, Perplexity) | `llms.txt`, AI-friendly robots.txt, question-format headings, structured data for AI extraction |
| **AEO** | Answer Engine Optimization (featured snippets, voice) | FAQPage schema, concise answer paragraphs, speakable markup |

Plus: content scoring (Flesch-Kincaid readability), OG tag validation with image reachability, redirect chain detection, analytics detection (12 providers), cross-page canonical conflict detection.

---

### /secure: Security Scanning

| Check | Details |
|---|---|
| **Secret scanning** | AWS keys, Stripe keys, OpenAI keys, GitHub tokens, private keys, JWT secrets, database URLs |
| **OWASP patterns** | Dangerous code execution, innerHTML, SQL concatenation |
| **Dependency health** | Unused deps, outdated packages, pinned versions (via dep-doctor) |

Detects and reports issues with file:line locations. In Claude Code, the `/secure` skill provides fix guidance.

---

### /deploy: Full Deploy Pipeline

```
Pre-flight checks -> /ship audit -> Deploy -> Health check -> Score saved
```

| Step | What happens |
|---|---|
| **Env validation** | Compares `.env.example` to actual env: catches missing/empty/placeholder vars |
| **Migration safety** | Detects pending DB migrations (Drizzle, Prisma, Knex) |
| **Bundle check** | Analyzes build output, warns on growth |
| **Ship audit** | Full `/ship` scorecard: blocks deploy if score < threshold |
| **Deploy** | `git push` (Vercel), `railway up`, or custom command |
| **Health check** | Hits production URL: status, response time, SSL cert, security headers |

---

### /profile: Code Performance Analysis

Static analysis for backend anti-patterns:
- **N+1 queries** — database calls inside loops (for, forEach, map)
- **Sync I/O in handlers** — readFileSync, execSync blocking the event loop
- **Unbounded queries** — findMany without take/limit, SELECT * without LIMIT
- **Missing indexes** — foreign keys without database indexes (Drizzle, Prisma)
- **Memory leaks** — module-scoped arrays with `.push()`, event listeners in handlers
- **Sequential awaits** — independent `await`s that should be `Promise.all()`
- **ReDoS risk** — dynamic RegExp from user input in handlers

---

### /bundle: Bundle Size Tracking

- Analyzes `dist/`, `build/`, `.next/`, `out/` directories
- Reports JS/CSS/image sizes with top 10 largest files
- Detects heavy dependencies with lighter alternatives (`moment` -> `dayjs`, `lodash` -> native, `axios` -> `fetch`)
- Saves reports for before/after comparison
- Warns on unexpected growth between builds

---

### /health: Production Health Check

```bash
/health https://yourapp.com
```

Checks: HTTP status, response time, SSL certificate validity and expiry, redirect chains, 6 security headers. Gives you a health assessment with specific issues.

---

### /content: Content Quality Analysis

- **Flesch Reading Ease** and **Flesch-Kincaid Grade Level**
- Keyword density analysis with optional target keyword
- Thin content detection (< 300 words)
- Wall-of-text warnings (150+ word paragraphs)
- GEO heading analysis: are your H2s phrased as questions for AI search?

---

## Security

| Protection | How |
|---|---|
| **No shell injection** | `execFileSync` with array args everywhere — zero shell interpolation |
| **SSRF protection** | All HTTP tools block private IPs, cloud metadata, non-HTTP schemes |
| **No telemetry** | Zero data collection. No phone-home. Ever. |
| **1 dependency** | `htmlparser2` only (30KB). No native bindings. No `node-gyp`. |
| **113 unit tests** | Security module, secret scanner, SEO scanner, code profiler, content scorer, dep doctor, CLI scorecard |
| **Secret redaction** | Found secrets truncated in output. Env values never logged. |
| **File safety** | 10MB read cap. 5MB response cap. Restrictive write permissions. |

See [SECURITY.md](SECURITY.md) for the full details.

---

## Philosophy

**Test-Driven, Not Vibe-Driven.** Red-green-refactor is enforced, not suggested. The agent writes the failing test before touching implementation code.

**Think First, Build Second.** Brainstorming and planning before code. The spec gets reviewed before the first line is written.

**Evidence Before Assertions.** Never claims "it works" without proof. The scorecard is evidence, not opinion.

**1 Dependency.** `htmlparser2` (30KB). No `node-gyp`. No supply chain surface area.

---

## Who Is This For?

- **Solo founders** building their first SaaS
- **Indie hackers** launching side projects
- **Bootstrapped teams** (1-3 people) who can't afford separate tools
- **Developers** who want one plugin instead of six

---

## Contributing

Found a bug? Want a new auditor? [Open an issue](https://github.com/Houseofmvps/ultraship/issues) or PR.

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm test              # 113 tests, node:test
node tools/<tool>.mjs # No build step
```

---

## License

MIT — [LICENSE](LICENSE). **Free forever.** No pro tier. No paywalls.

---

<div align="center">

**If Ultraship helped you ship faster, [star the repo](https://github.com/Houseofmvps/ultraship) and tell a friend.**

[![Star on GitHub](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)

</div>
