# Ultraship — Claude Code Plugin

All-in-one builder plugin for Claude Code. npm: `ultraship`, GitHub: `Houseofmvps/ultraship`.

## Project Structure

```
.claude-plugin/   — Plugin manifest (plugin.json)
skills/           — 22 skills (16 workflow + 6 specialist)
agents/           — 5 agents (ship, review, seo, security, browser)
commands/         — 17 slash commands (/ship, /seo, /perf, /review, /deploy, /health, etc.)
tools/            — 20 Node.js tools (scanner, lighthouse, profiler, dep-doctor, GSC, Bing, generators, etc.)
hooks/            — Pre-commit security hook
docs/             — Documentation
```

## Tech Stack

- Node.js ESM (type: module)
- htmlparser2 for HTML parsing (SAX-based, ~30KB)
- No build step — tools run directly via `node tools/<tool>.mjs`
- All tools use `execFileSync` (not `execSync`) to prevent shell injection

## Key Tools

| Tool | Purpose |
|---|---|
| `seo-scanner.mjs` | 60+ rule SEO/GEO/AEO scanner with cross-page analysis, analytics detection, canonical conflicts |
| `content-scorer.mjs` | Readability (Flesch-Kincaid), keyword density, GEO heading analysis |
| `og-validator.mjs` | Open Graph tag validation, image reachability check |
| `redirect-checker.mjs` | Redirect chain/loop detection, mixed protocol, sitemap-based bulk check |
| `lighthouse-runner.mjs` | Lighthouse via headless Chrome, extracts CWV + diagnostics |
| `health-check.mjs` | Production health check (status, response time, SSL, security headers) |
| `env-validator.mjs` | Validates required env vars from .env.example against actual .env |
| `migration-checker.mjs` | Detects pending DB migrations (Drizzle, Prisma, Knex) |
| `bundle-tracker.mjs` | Bundle size tracking with history, heavy dependency detection |
| `audit-history.mjs` | Saves/compares audit scores over time |
| `api-smoke-test.mjs` | API endpoint smoke testing (status codes, response times, CORS) |
| `gsc-client.mjs` | Google Search Console API (JWT auth via service account) |
| `bing-webmaster.mjs` | Bing Webmaster API (API key auth) |
| `code-profiler.mjs` | Static analysis for N+1 queries, sync I/O, memory leaks, unbounded queries |
| `dep-doctor.mjs` | Detects unused/outdated dependencies, recommends removals |
| `secret-scanner.mjs` | Detects leaked secrets, skips .env.example files |
| `sitemap-generator.mjs` | Generates sitemap.xml from HTML files |
| `robots-generator.mjs` | Generates AI-friendly robots.txt (allows GPTBot, PerplexityBot, etc.) |
| `structured-data-generator.mjs` | Generates JSON-LD structured data |
| `llms-txt-generator.mjs` | Generates llms.txt for AI discoverability |

## Security

- All HTTP-making tools import `tools/lib/security.mjs` for SSRF protection, response size limits
- `validateUrl()` blocks private IPs, cloud metadata, non-HTTP schemes
- `checkFileSize()` prevents OOM by capping reads at 10MB
- `createResponseAccumulator()` caps HTTP responses at 5MB
- File writes use mode `0o600`, directories `0o700`
- Secret scanner redacts found values in output
- Lighthouse version is pinned (`lighthouse@12`) to prevent supply chain attacks

## Conventions

- Tools output JSON to stdout, errors exit with code 0 (never crash Claude Code)
- Skills use `${CLAUDE_PLUGIN_ROOT}` to reference tool paths
- New tools that make HTTP requests MUST import and use `validateUrl()` from `tools/lib/security.mjs`
- New tools that read files MUST use `checkFileSize()` before `readFileSync()`
- GEO = Generative Engine Optimization (NOT geographic targeting)
- AEO = Answer Engine Optimization (featured snippets, voice assistants)
- Auth env vars: `ULTRASHIP_GSC_CREDENTIALS`, `ULTRASHIP_GSC_ACCESS_TOKEN`, `ULTRASHIP_BING_KEY`

## Publishing

- `npm publish` with granular token via `.npmrc`
- Git commits use `houseofmvps2024@gmail.com`
- Version bump in both `package.json` and test before publishing
