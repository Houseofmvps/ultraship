# Changelog

All notable changes to Ultraship will be documented in this file.

## [2.5.0] - 2026-04-01

### Added — Elite SEO Intelligence (Top 1% Operator Patterns)

**keyword-intelligence.mjs**
- `anomalies` command — detects low-position high-CTR keywords (Google flags these as strongest opportunities) and high-position low-CTR underperformers
- `cross-reference` command — joins GSC page data with GA4 conversion data to find 4 critical buckets: converting-but-underexposed, ranking-but-not-converting, scalable pages, CTR problems
- `--brand=term1,term2` flag — separates brand vs non-brand queries across ALL commands (non-brand is all that matters for SEO growth)
- Position band distribution (% in positions 1-3, 4-10, 11-20, 21+) in analyze output

**ga4-client.mjs**
- `ai-traffic` command — tracks ChatGPT (utm_source=chatgpt.com), Perplexity, Microsoft Copilot, Gemini, Claude, and You.com referral traffic with conversion rates
- `organic` command — organic-only overview with key event rates per landing page
- `--organic` flag — filters top-pages and landing-pages to organic search only
- Key event rate per session and average engagement time per page on landing-pages and top-pages

**bing-webmaster.mjs**
- `indexnow` command — instant IndexNow push for changed URLs (Bing, Yandex, and partners)
- `keyword-research` command — keyword suggestions from Bing
- `backlinks` command — backlink counts and sample link data
- `site-scan` command — Bing's technical SEO scan results
- `url-inspection` command — crawl/index status from Bing's perspective

**seo-scanner.mjs**
- `nosnippet` detection — flags pages with nosnippet meta directive (blocks AI citations and featured snippets)
- `max-snippet` detection — flags restrictive max-snippet values that limit AI feature eligibility
- `data-nosnippet` detection — flags elements excluded from search snippets

**seo-strategy SKILL.md**
- AI Traffic Measurement phase — measure ChatGPT/Perplexity/Copilot traffic before optimizing
- CTR Anomaly Analysis framework — invest in low-position high-CTR, fix high-position low-CTR
- Non-Brand Position Band Tracking — weekly KPI stack from elite operators
- GSC ↔ GA4 Cross-Reference phase — the "money move" that finds highest-ROI pages
- IndexNow for instant Bing/Copilot discovery
- AI Slop Prevention guardrails — content quality checks before publishing
- Ruthless weekly KPI stack (14 metrics, not 50)

## [1.1.2] - 2026-03-25

### Added
- Premium hero banner image
- GitHub Actions CI (tool smoke tests, security tests, version sync, npm audit)
- CHANGELOG.md
- CONTRIBUTING.md with security requirements

### Changed
- npm package optimized with `files` field (smaller installs)
- Added 17 keywords to package.json for npm discoverability
- README rebranded — all capabilities presented as Ultraship's own
- Added comprehensive "What Is Ultraship?" section to README

### Fixed
- Plugin manifest version synced across package.json, plugin.json, marketplace.json

## [1.1.1] - 2026-03-24

### Security
- Added SSRF protection to all HTTP-making tools (health-check, api-smoke-test, redirect-checker, og-validator, lighthouse-runner)
- Added shared security module (`tools/lib/security.mjs`) with URL validation, private IP blocking, cloud metadata blocking
- Added file size limits (10MB read cap) to all file-reading tools (seo-scanner, content-scorer, og-validator)
- Added HTTP response size limits (5MB cap) via `createResponseAccumulator()`
- Pinned Lighthouse to major version (`lighthouse@12`) to prevent supply chain attacks
- Added restrictive file permissions (0o600 files, 0o700 directories) to audit-history and bundle-tracker
- Redacted env var values in env-validator output
- Added `SECURITY.md` with full security documentation

## [1.1.0] - 2026-03-24

### Added
- 14 workflow skills: brainstorming, TDD, systematic debugging, planning, code review, git worktrees, subagent-driven development, and more
- Frontend design skill for production-grade UI generation
- CLAUDE.md management skill (auto-create, audit, revise)
- Live documentation MCP server for real-time library docs
- Browser automation MCP server for automated smoke testing
- Pre-commit security hook for secret scanning
- SEO/GEO/AEO audit skill with 60+ rules
- Performance audit skill with Lighthouse integration
- Security audit skill with dependency + secret scanning
- Deploy and release workflow skills

## [1.0.5] - 2026-03-23

### Added
- Code profiler tool (N+1 queries, sync I/O, memory leaks)
- Dependency doctor tool (unused deps, outdated packages)
- Bundle tracker with history and heavy dependency detection

## [1.0.4] - 2026-03-23

### Added
- Initial release with core tools
- SEO scanner (60+ rules, cross-page analysis)
- Content scorer (Flesch-Kincaid readability)
- OG tag validator with image reachability
- Redirect chain/loop detector
- Lighthouse runner via headless Chrome
- Health check (status, SSL, security headers)
- Env validator
- Migration checker (Drizzle, Prisma, Knex)
- API smoke test tool
- GSC and Bing Webmaster API clients
- Secret scanner
- Sitemap, robots.txt, structured data, llms.txt generators
