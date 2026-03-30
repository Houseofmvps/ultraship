<div align="center">

<img src="assets/hero-banner.jpg" alt="Ultraship — Claude Code Plugin" width="100%"/>

### Claude Code plugin — 33 expert-level skills for building, shipping, and scaling production software. 30 audit tools (security, pentest, code quality, bundle size, SEO/GEO/AEO) close the loop before deploy.

[![npm version](https://img.shields.io/npm/v/ultraship?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/ultraship)
[![npm downloads](https://img.shields.io/npm/dm/ultraship?style=for-the-badge&logo=npm&color=blue&label=Monthly%20Downloads)](https://www.npmjs.com/package/ultraship)
[![npm total](https://img.shields.io/npm/dt/ultraship?style=for-the-badge&logo=npm&color=cyan&label=Total%20Downloads)](https://www.npmjs.com/package/ultraship)
[![GitHub stars](https://img.shields.io/github/stars/Houseofmvps/ultraship?style=for-the-badge&logo=github&color=gold)](https://github.com/Houseofmvps/ultraship/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Houseofmvps/ultraship/ci.yml?style=for-the-badge&logo=github&label=Tests)](https://github.com/Houseofmvps/ultraship/actions)
[![Sponsor](https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Houseofmvps)

---

[![Follow @kaileskkhumar](https://img.shields.io/badge/Follow%20%40kaileskkhumar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/kaileskkhumar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/kailesk-khumar-soundararajan)
[![houseofmvps.com](https://img.shields.io/badge/houseofmvps.com-Website-green?style=for-the-badge&logo=google-chrome&logoColor=white)](https://houseofmvps.com)

**Built by [Kaileskkhumar](https://www.linkedin.com/in/kailesk-khumar-soundararajan), solo founder of [houseofmvps.com](https://houseofmvps.com)**

</div>

---

```
1 dependency (htmlparser2) · 155 tests · Node.js ESM · MIT
```

## Install

```bash
# Claude Code plugin
claude plugin marketplace add Houseofmvps/ultraship
claude plugin install ultraship

# Or standalone via npx
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

## What it does

`/ship` runs 5 tools in parallel and outputs a scorecard:

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

<details>
<summary>Demo</summary>

<img src="assets/demo.gif" alt="Ultraship — SEO audit, secret scanning, scorecard" width="100%"/>

</details>

## Tools (30)

Each tool is a standalone Node.js script (`node tools/<name>.mjs`). JSON output. Exit 0 always. No build step.

### Auditing

| Tool | What it checks |
|---|---|
| `seo-scanner` | 60+ rules across meta tags, canonicals, heading hierarchy, OG tags, structured data, sitemap, robots.txt, `llms.txt`, AI-crawler access, content depth, cross-page canonical conflicts |
| `secret-scanner` | AWS keys, Stripe keys, JWT secrets, database URLs, private keys. Redacts values in output. |
| `code-profiler` | N+1 queries, sync I/O in handlers, unbounded queries, missing indexes, memory leaks, sequential awaits, ReDoS risk |
| `bundle-tracker` | JS/CSS/image sizes in build output. Detects heavy deps (`moment`→`dayjs`, `lodash`→native). History for before/after. Monorepo-aware. |
| `dep-doctor` | Unused dependencies via import graph analysis (not just grep). Dead wrapper files. Outdated packages. |
| `content-scorer` | Flesch-Kincaid readability, keyword density, thin content detection, GEO heading analysis |
| `lighthouse-runner` | Lighthouse via headless Chrome. Core Web Vitals, render-blocking resources, diagnostics. |

### Validation

| Tool | What it checks |
|---|---|
| `health-check` | HTTP status, response time, SSL certificate (issuer, expiry), 6 security headers |
| `env-validator` | Compares `.env.example` against actual `.env`. Catches missing/empty/placeholder vars. |
| `migration-checker` | Pending DB migrations for Drizzle, Prisma, Knex |
| `og-validator` | Open Graph tags, image reachability, size validation |
| `redirect-checker` | Redirect chains, loops, mixed HTTP/HTTPS. Sitemap-based bulk check. |
| `api-smoke-test` | Hit API endpoints, check status codes, response times, CORS headers |

### Generators

| Tool | What it creates |
|---|---|
| `sitemap-generator` | `sitemap.xml` from HTML files and routes |
| `robots-generator` | AI-friendly `robots.txt` (allows GPTBot, PerplexityBot, ClaudeBot) |
| `llms-txt-generator` | `llms.txt` for AI assistant discoverability |
| `structured-data-generator` | JSON-LD schema markup |

### Competitive & Launch

| Tool | What it does |
|---|---|
| `compete-analyzer` | Compares two URLs: tech stack, SEO score, security headers, response time. ASCII comparison card. |
| `launch-prep` | Reads project, generates PH/Twitter/LinkedIn/HN copy, 14-item checklist, press kit |
| `demo-prep` | Finds console.logs, TODOs, placeholder text, missing favicons. Scores demo readiness. |

### Operations

| Tool | What it does |
|---|---|
| `incident-commander` | Health check + git culprit analysis + error patterns + rollback commands + post-mortem template |
| `growth-tracker` | Uptime, git velocity, SEO trajectory, dep health. Stores snapshots for week-over-week comparison. |
| `cost-tracker` | Log AI token usage per feature/model. Built-in pricing for Claude, GPT-4o, Gemini. Daily trends. |
| `pentest-scanner` | Automated penetration testing: XSS, SQLi, SSTI, command injection, path traversal, CORS, JWT, GraphQL introspection, prototype pollution, race conditions, request smuggling. Zero false positives — every finding has proof-of-concept. |

### Project Analysis

| Tool | What it does |
|---|---|
| `onboard-generator` | Auto-generates developer guide: stack, directory tree, routes, schema, env vars, Mermaid diagram |
| `architecture-mapper` | 4 Mermaid diagrams: system overview, route tree, DB ER, data flow. Circular dependency + orphan detection. |
| `pattern-analyzer` | Analyzes testing, error handling, TypeScript usage, CI/CD, git practices. Cross-repo comparison. |
| `audit-history` | Saves/compares audit scores over time |

### Integrations (optional)

| Tool | What it does |
|---|---|
| `gsc-client` | Google Search Console: submit sitemaps, inspect URLs, query rankings (requires `ULTRASHIP_GSC_CREDENTIALS`) |
| `bing-webmaster` | Bing Webmaster: submit sitemaps/URLs, check indexing (requires `ULTRASHIP_BING_KEY`). Also powers ChatGPT Search. |

## Commands (28)

Slash commands available inside Claude Code after installing the plugin:

| Command | Description |
|---|---|
| `/pentest` | Penetration testing — hack-test your app (web, API, browser, GitHub, local code) |
| `/ship` | Pre-deploy scorecard — runs 5 tools, scores 4 categories |
| `/seo` | SEO + GEO + AEO audit (60+ rules) |
| `/secure` | Secret scanning + OWASP patterns + `npm audit` |
| `/perf` | Lighthouse + bundle size |
| `/deploy` | Env check → migration check → build → deploy → health check |
| `/review` | Code review with confidence-scored findings |
| `/health` | Production health check |
| `/compete` | Compare your site vs a competitor |
| `/launch` | Generate launch copy + checklist + press kit |
| `/rescue` | Incident diagnostics + rollback commands |
| `/grow` | Growth metrics over time |
| `/cost` | AI build cost tracking |
| `/onboard` | Generate developer onboarding guide |
| `/architecture` | Generate Mermaid architecture diagrams |
| `/clone-patterns` | Analyze any repo's patterns, compare to yours |
| `/demo` | Find dev artifacts, score demo readiness |
| `/visual-diff` | Before/after screenshot comparison (via Playwright MCP) |
| `/content` | Readability + keyword density analysis |
| `/bundle` | Bundle size tracking |
| `/profile` | Static analysis for backend anti-patterns |
| `/deps` | Unused/outdated dependency detection |
| `/redirects` | Redirect chain/loop detection |
| `/release` | Changelog + version bump + GitHub release + npm publish |
| `/revise-claude-md` | Update CLAUDE.md with session learnings |
| `/brainstorm` | Structured ideation → spec document |
| `/write-plan` | Implementation plan from spec |
| `/execute-plan` | Execute plan step by step |

## Skills (33)

Skills are markdown instruction files that shape Claude's behavior during your session. They activate based on context — when you're debugging, Claude uses the debugging skill; when you're building UI, it uses the frontend design skill.

**Workflow (16):** brainstorming, planning, TDD, implementation, code review, debugging, refactoring, frontend design, API design, data modeling, git workflow, deploy pipeline, release, CLAUDE.md management, verification, browser testing

**Specialist (7):** SEO/GEO/AEO audit, security audit, **penetration testing**, performance audit, content quality, code profiling, parallel agent dispatching

**Growth & Intelligence (10):** competitive analysis, launch prep, incident response, growth tracking, cost tracking, onboarding, architecture mapping, pattern analysis, demo readiness, visual regression

## Agents (10)

Agents are dispatched by skills to run audits in parallel:

`ship` · `code-reviewer` · `seo-auditor` · `security-auditor` · `pentest-auditor` · `perf-auditor` · `browser-verifier` · `compete-analyzer` · `launch-auditor` · `incident-responder` · `growth-tracker`

## MCP Servers (2)

| Server | Purpose |
|---|---|
| [Context7](https://github.com/upstash/context7) | Live library documentation. Fetches current docs for any framework/library. |
| [Playwright](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-server-playwright) | Browser automation. Navigate, screenshot, fill forms, test deployed pages. |

Both lazy-start on first use. No background processes.

## SEO, GEO, and AEO

The SEO scanner checks three layers:

- **SEO** — traditional search engine optimization (Google, Bing): meta tags, canonicals, heading hierarchy, alt text, sitemap, robots.txt, structured data, OG tags
- **GEO** — Generative Engine Optimization (ChatGPT, Perplexity, Gemini): `llms.txt`, AI-friendly `robots.txt`, question-format headings, structured data for AI extraction
- **AEO** — Answer Engine Optimization (featured snippets, voice assistants): FAQPage schema, concise answer paragraphs, speakable markup

GEO and AEO matter because AI search engines (ChatGPT Search, Perplexity, Gemini) now drive a significant portion of content discovery. If your `robots.txt` blocks GPTBot or you don't have `llms.txt`, AI assistants can't cite your content.

## Dogfooding

`/ship` results on [SaveMRR](https://savemrr.co) (Hono + React + Drizzle pnpm monorepo, 5 packages, 41 routes):

| | Backend + Dashboard | Landing (29 pages) |
|---|---|---|
| SEO/GEO/AEO | 63 | 52 |
| Security | 100 | 100 |
| Code Quality | 70 | 67 |
| Bundle Size | 100 | 92 |
| **Overall** | **83** | **78** |

227 findings: 1 N+1 query, 33 unused deps (dead shadcn/ui wrappers via import graph), 153 SEO issues, 1 memory leak, 1 heavy dep.

## Security

All tools use `execFileSync` with array args (no shell interpolation). HTTP tools import `tools/lib/security.mjs` for SSRF protection (blocks private IPs, cloud metadata, non-HTTP schemes). 10MB file read cap. 5MB response cap. Secret values redacted in output. Zero telemetry.

See [SECURITY.md](SECURITY.md).

## Architecture

```
.claude-plugin/   Plugin manifest
skills/           33 markdown skill files
agents/           10 markdown agent definitions
commands/         28 markdown command definitions
tools/            30 Node.js ESM scripts
tools/lib/        Shared modules (security.mjs, monorepo.mjs)
hooks/            Session-start hook (CLAUDE.md check)
```

- Node.js ESM (`type: module`)
- 1 dependency: `htmlparser2` (SAX HTML parser, ~30KB)
- Tools output JSON to stdout, exit 0 on success and failure (errors in JSON)
- Skills reference tools via `${CLAUDE_PLUGIN_ROOT}/tools/<name>.mjs`
- No build step. No native bindings. No `node-gyp`.

## Contributing

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm test              # 155 tests, node:test
node tools/<tool>.mjs # Run any tool directly
```

[Open an issue](https://github.com/Houseofmvps/ultraship/issues) or submit a PR.

## License

MIT
