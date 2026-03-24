# Changelog

All notable changes to Ultraship will be documented in this file.

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
