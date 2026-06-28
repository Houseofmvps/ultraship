# Changelog

All notable changes to Ultraship will be documented in this file.

## [2.13.2] - 2026-06-28

### Fixed — seo-scanner precision pass (fewer false positives on non-content files)

Found by running the full `/ship` against a live production site — the static SEO score (60) was far below the live Lighthouse SEO score (100), and the entire gap was false alarms on files that aren't content pages:

- **Search-engine verification stubs are no longer audited.** Google Search Console / Yandex / Pinterest / Bing ownership files (e.g. `googleb88d33c38f15c7cd.html`) are intentionally near-empty markers — they were being flagged for missing title, description, h1, and internal links. They now produce zero findings. Matched precisely by filename (the token must be a long hex string), so a real page like `google-ads-guide.html` is still audited normally.
- **Error & utility pages are exempt from content-ranking rules.** A 404/500/offline page is inherently short and unlinked, so `thin-content`, `thin-content-ai`, `orphan-page`, and `no-internal-links` no longer fire on them (reusing the same error-page detection added in 2.13.1 for the noindex check). A real, unlinked content page is still flagged as an orphan — the exemption is error-pages-only.

On the live test site this raised the reported SEO score from **60 → 87** (now in line with Lighthouse) and removed 60 false findings, with no loss of real signal. +4 regression tests (274 total).

## [2.13.1] - 2026-06-28

### Fixed — ship-gate false-positive on noindexed error pages

- `seo-scanner.mjs` no longer reports a **critical** `noindex` finding for conventionally-noindexed **error & utility pages** (`404`, `500`, `403`, `offline`, `maintenance`, etc., including directory-routed `404/index.html`). A 404 page *should* be noindexed, so the old behavior made the `/ship-gate` **hard-fail on essentially every well-built site** (they all ship a noindexed 404). These pages now emit an `info`-level `has-noindex-utility-page` note instead — no score deduction, no hard-fail. A `noindex` on a real content page is still critical. Found by dogfooding `/ship-gate` against a live prerendered site (270 tests, +3 regression).

## [2.13.0] - 2026-06-28

### Added — Eval & regression harness for AI code (`/evals`)

- New `eval-scanner.mjs` tool: locates the AI features that need an eval harness. The 2026 reality is that AI-written code passes review but fails at runtime, and AI *features* (chatbots, RAG, classifiers) drift silently as prompts and models change. The scanner finds every real LLM call site by provider + model id across **Anthropic, OpenAI, Google Gemini, Mistral, Cohere, Ollama, the Vercel AI SDK, and LangChain** (JS/TS + Python), detects the project's test runner, and reports whether a Promptfoo / eval suite already exists. Zero false positives — detection is on real `import`/`require` of a known SDK module, so a local `./ai` import is never flagged; model ids are reported, never used as a standalone trigger. Flags `ai-features-without-evals` when AI features ship with no eval coverage.
- New `evals` skill (`/evals`): scan → **characterization tests** (lock the *current* behavior of code before an agent refactors it, so a regression is caught immediately) → **Promptfoo suite** for each AI feature (on-topic rubric, prompt-injection refusal, no-PII-echo, latency budget) → wire it into the ship-gate so a failing eval fails CI. Model ids are verified against current sources (Currency Guard) before being pinned.
- Surfaced as the `ultraship evals .` CLI command. 10 unit tests in `tests/eval-scanner.test.mjs` (267 total).

## [2.12.0] - 2026-06-28

### Added — Vibe-Coding Security Sentinel

- New `vibe-security-scanner.mjs` tool: catches the 2026 "shipped-fast, leaked-everything" breach class (the Moltbook class) that generic secret scanning misses, by looking at **context** rather than raw secret patterns. Zero false positives — every finding is a categorical mistake or carries decoded proof:
  - **`public-prefixed-secret-name` / `public-prefixed-secret-value`** — a server-only secret (`SERVICE_ROLE`/`SECRET`/`PRIVATE_KEY`/`PASSWORD`, or a real `sk_live`/`AKIA`/private-key value) behind a `NEXT_PUBLIC_`/`VITE_`/`EXPO_PUBLIC_`/etc. prefix, i.e. bundled into the browser.
  - **`public-supabase-service-role-key`** — decodes JWTs behind a public prefix and flags only those whose role is `service_role` (the anon key, public by design, is never flagged).
  - **`service-role-in-client`** — a Supabase service_role key referenced inside a `"use client"` component.
  - **`supabase-table-without-rls`** — tables created without Row Level Security in `.sql` migrations (gated on a Supabase signal so plain-Postgres projects aren't falsely flagged).
  - **`mutation-routes-no-auth-lib`** (advisory) — mutation endpoints found with no auth library in dependencies.
- Surfaced via the `security-audit` skill (`/secure`) with per-rule fixes, and as the `ultraship vibe-check .` CLI command. 14 unit tests in `tests/vibe-security-scanner.test.mjs` (257 total).

## [2.11.0] - 2026-06-28

### Added — Deterministic ship-gate (blocking quality gate)

- New `ship-gate.mjs` tool: promotes the `/ship` scorecard from advisory to a **blocking, config-as-code gate**. `init` writes `.ultraship/ship-gate.json` (per-category score thresholds + hard-fail rules); `run` scores all six auditors and **exits 1** if any category is below threshold, a secret is leaked, or a critical finding exists; `ci` writes `.github/workflows/ship-gate.yml`; `hook` writes a `.git/hooks/pre-push`. Reports a "merge confidence" score.
- New `tools/lib/ship-scoring.mjs`: extracted the scorecard math into one shared module that both `bin/ultraship.mjs` (the `/ship` scorecard) and `ship-gate.mjs` import — so the advisory scorecard and the blocking gate can never disagree. `/ship` behavior is unchanged (verified by the existing scorecard tests).
- New `ship-gate` skill (`/ship-gate`): init → tune thresholds → run → install CI + pre-push → explain and fix failures.
- `ultraship ship-gate .` CLI command propagates the gate's exit code (unlike the always-0 scorecard) so it can block CI and pushes.
- 12 unit tests in `tests/ship-gate.test.mjs`.

### Added — Accessibility audit + auto-fix (WCAG 2.2)

- New `a11y-scanner.mjs` tool: zero-dependency static accessibility scanner using the inline SAX parser. Flags the deterministic, source-visible WCAG 2.2 A/AA failures with zero false positives — missing alt text, unlabeled form controls (placeholders don't count), icon-only buttons/links, missing `lang`/`title`/`main`, empty headings, skipped heading levels, positive `tabindex`, zoom-disabled viewport, duplicate ids, and broken `aria-labelledby`/`aria-describedby`/`for` references. JSON output, exit 0.
- New `a11y` skill (`/a11y`): scan → report → auto-fix the deterministic issues → escalate to a rendered scan (`npx pa11y` / `npx @axe-core/cli`) for contrast, focus, and reading order → verify. Derives alt text and labels from context; never invents content for decorative images.
- New `a11y-auditor` agent: report-only WCAG scan dispatched by `/ship`.
- `/ship` now scores **5 categories from 6 tools** (added Accessibility). `ultraship a11y .` available standalone.
- 20 unit tests in `tests/a11y-scanner.test.mjs` (243 total).

### Changed — consolidated commands into skills

- Removed 21 redundant command launchers (`architecture, canary, clone-patterns, compete, cost, demo, deploy, grow, guard, index-fix, investigate, launch, learn, onboard, pentest, release, rescue, retro, seo-strategy, sprint, visual-diff`) that only said "invoke the X skill". Claude Code merged commands into skills, so every one of those slash commands still works — it now resolves to its same-named skill (with richer features: argument hints, auto-activation). 16 dedicated command files remain.
- Counts: **38 tools, 43 skills, 13 agents, 16 commands** across `plugin.json`, `marketplace.json`, `package.json`, README, and CLAUDE.md.

## [2.10.0] - 2026-06-13

### Added — Currency Guard (keep Claude on current docs, not stale training data)

- New `UserPromptSubmit` hook (`hooks/currency-guard.sh`): fires on every prompt, detects version-sensitive language (library/framework/SDK APIs, version numbers, pricing, model IDs, "latest/newest/deprecated/migrate") and injects a deterministic directive to verify against current sources (context7 MCP for library docs, WebSearch/WebFetch for everything else, the lockfile for installed versions) before answering. Stays silent on non-version-sensitive prompts. Exits 0, JSON-safe.
- New `staying-current` skill: the full policy — what's version-sensitive, where to verify, how to apply, anti-patterns.
- `using-ultraship` master skill now carries a currency-first rule alongside the memory-first rule.
- 15 unit tests in `tests/currency-guard.test.mjs`.

### Added — June 2026 platform features

- `disallowed-tools` frontmatter: `code-review` and `investigate` now hard-remove `Edit`/`Write`/`NotebookEdit` while active, making "reviews don't mutate code" and investigate's "no fixes until root cause" real constraints rather than requests.
- Nested-subagents (5 levels) + dynamic Workflows guidance added to `sprint`, `dispatching-parallel-agents`, and `seo-audit` for codebase-wide work.

### Added — Ops integrations (detect-if-present, nothing bundled)

- `rescue` + `canary` use a connected **Sentry** MCP to pull live errors and map stack traces to code / confirm post-deploy spikes.
- `deploy` uses connected **Vercel** (deployment status, build logs, live commit) and **Supabase** (migration drift) MCPs when present. Falls back to static checks otherwise. Documented in the README.

### Added — Stronger persistent memory

- `learnings-manager.mjs` gains `digest` (compact grouped-by-topic snapshot for cheap context injection) and `recall` (relevance-ranked top-N, title>tag>body, recency tiebreak). `/learn` skill documents the digest-then-recall long-session pattern. Tests extended (18 total).

### Added — LSP awareness

- `code-review` and `/profile` now use a connected LSP (find references / go to definition) to verify call sites and impact instead of grep-guessing, falling back to text search when no language server is connected.

### Added — Distribution

- `docs/MARKETPLACE.md`: verified submission guide for the Anthropic community marketplace, ClaudePluginHub, and claudemarketplaces.com, plus the live self-hosted install path. `claude plugin validate` passes.

### Changed

- Counts: 42 skills (added `staying-current`), 37 tools, 12 agents, 37 commands. Stale README stats corrected (0 dependencies, 211 tests — was "1 dependency, 180 tests").

## [2.9.0] - 2026-06-13

### Added — `/codex` Codebase Index

- New `/codex` command + `codex-generator.mjs` tool: generates a compact markdown index of a codebase (routes, DB schema, components, lib exports, project structure) so AI assistants don't burn tokens re-exploring project structure
- Stack-agnostic: detects and extracts from JS/TS (Hono, Express, Fastify, Next.js app router, NestJS, SvelteKit, Nuxt), Python (FastAPI, Flask, Django), Go (Gin, Echo, Chi), Ruby (Rails), PHP (Laravel), Rust (Actix, Axum), Java/Kotlin (Spring)
- ORMs supported: Drizzle, Prisma, Mongoose, Sequelize, TypeORM, SQLAlchemy, Django ORM, GORM, ActiveRecord, Eloquent
- Skips noise: audit fields (`createdAt`/`updatedAt`/`deletedAt`), shadcn/radix UI primitives, test files, generated/build dirs
- Writes `.ultraship/codex.md` (mode 0600), caps scanned files at 100KB, never crashes Claude Code (always exits 0 with JSON)
- 11 unit tests in `tests/codex-generator.test.mjs`

### Fixed — Route extraction false positives

- The generic route matcher could capture non-route code (e.g. a string with spaces or operators after `.get(`/`.post(`) and emit garbage "routes". Route paths are now validated — anything containing whitespace, `<>;` backtick, or `||`/`&&`/`=>` is dropped

### Changed

- `.ultraship/` and `.codesight/` are now gitignored (generated artifacts)
- Counts corrected across docs to filesystem truth: 37 tools, 41 skills, 12 agents, 37 commands

### Improved — Subagent skills

- `subagent-driven-development`: added task sizing (Small/Medium/Large) so small tasks skip unnecessary review rounds, raised implementer tool budget from 15 to 25 with permission to read adjacent files, and now defaults implementers to opus (sonnet failures the controller must fix cost more than opus would have)
- `dispatching-parallel-agents`: added guidance that context starvation is the #1 cause of subagent failure — paste real errors and code inline, grant permission to explore, give a reasonable tool budget

## [2.8.1] - 2026-05-18

### Fixed — Plugin Install Schema Compliance

- Added required `type: "string"` and `title` fields to all five `userConfig` entries in `.claude-plugin/plugin.json` (`gsc_credentials`, `gsc_access_token`, `ga4_credentials`, `ga4_access_token`, `bing_key`)
- Fixes `claude plugin install ultraship` failing with `userConfig.<key>.type: Invalid option` and `userConfig.<key>.title: expected string, received undefined`
- No behavior change — existing `description` and `sensitive: true` preserved
- Thanks to @anderson-0 (#5)

## [2.8.0] - 2026-04-18

### Changed — Zero Dependencies

- Replaced `htmlparser2` (and its transitive deps `entities@4.5.0`, `domutils@3.2.2`) with a zero-dependency inline SAX-style HTML parser (`tools/lib/html-parser.mjs`)
- Eliminates the Socket.dev supply chain risk alerts: obfuscated code (entities generated decode table), network access (domutils globalThis fetch), and URL strings
- Same Parser API (write/end + onopentag/ontext/onclosetag handlers + decodeEntities option) — no behavior change
- All 180 tests pass

## [2.7.1] - 2026-04-01

### Fixed — Honest Marketing Claims

- Replaced all "SEO/GEO/AEO" branding with "SEO + AI visibility" across user-facing files
- "60+ rules" → "63 rules: 39 SEO, 20 GEO, 4 AEO" with exact breakdowns
- AEO described as "4 schema presence checks" not a full audit
- GEO described as "verifiable technical signals" not ranking factor claims
- Every claim now backed by exact rule counts from the source code

## [2.7.0] - 2026-04-01

### Added — Full Plugin Spec Compliance (Marketplace-Ready)

**Skill frontmatter — `argument-hint` for 20+ skills:**
- Skills that accept arguments now show autocomplete hints (e.g., `/compete <competitor-url>`, `/release <major|minor|patch>`, `/learn <save|search|list|prune|export> [query]`)
- Added to: compete, rescue, canary, pentest, learn, index-fix, retro, grow, guard, investigate, seo-audit, perf-audit, seo-strategy, sprint, deploy, release, brainstorming, clone-patterns, frontend-design, systematic-debugging

**Skill frontmatter — `allowed-tools` for 20+ skills:**
- Each skill now restricts which tools it can use (prevents misuse, improves safety)
- Audit skills: Bash + Read + Grep + Glob (read-only)
- Fix skills: Bash + Read + Edit + Grep + Glob (can modify)
- Knowledge skills: Bash + Read + Write + Grep (can persist)
- Added to: compete, canary, pentest, learn, index-fix, retro, grow, guard, seo-audit, security-audit, perf-audit, seo-strategy, clone-patterns, architecture, onboard, demo, cost

**Skill frontmatter — `paths` for context-aware auto-activation:**
- seo-audit: activates for `**/*.html`, `**/*.htm` files
- security-audit: activates for `**/package.json`, `**/.env*`, `**/requirements.txt`
- frontend-design: activates for `**/*.tsx`, `**/*.jsx`, `**/*.css`

**Agent frontmatter — `tools` restriction for all 12 agents:**
- Each agent now lists only the tools it needs (prevents wasted turns on irrelevant tools)
- Code-reviewer: Read, Grep, Glob, Bash
- Browser-verifier: Bash, Read, Playwright MCP tools
- All others: Bash, Read, Grep, Glob (+ Write for launch-auditor)

**Agent frontmatter — `skills` preload for all 12 agents:**
- Each agent preloads its domain skill at startup (no context wasted discovering skills)
- code-reviewer → code-review, seo-auditor → seo-audit, pentest-auditor → pentest, seo-strategist → seo-strategy, incident-responder → rescue, canary-monitor → canary, compete-analyzer → compete, growth-tracker → grow, launch-auditor → launch, security-auditor → security-audit, perf-auditor → perf-audit

**PostCompact hook — context re-injection after compaction:**
- New `post-compact.sh` hook that fires after conversation compaction
- Re-injects: active guard state, available commands list, CLAUDE.md freshness check
- Prevents ultraship context loss in long sessions

**Hook `statusMessage` — UX feedback during hook execution:**
- SessionStart: "Ultraship: checking project context..."
- PostCompact: "Ultraship: restoring context after compaction..."

## [2.6.0] - 2026-04-01

### Added — Marketplace-Ready Plugin Architecture

**Agent frontmatter — official Claude Code fields:**
- All 12 agents now use `maxTurns` to enforce hard tool call limits at the system level (prevents timeouts)
- All 12 agents now use `effort` field (high for Opus agents, medium for Sonnet agents)
- Opus agents (code-reviewer, pentest-auditor, seo-strategist, incident-responder): `effort: high`, `maxTurns: 10-15`
- Sonnet agents (seo-auditor, security-auditor, perf-auditor, browser-verifier, canary-monitor, compete-analyzer, growth-tracker, launch-auditor): `effort: medium`, `maxTurns: 6-8`

**`userConfig` — plugin credential setup at install time:**
- Users are now prompted for API credentials when enabling ultraship (no more manual env var setup)
- Supported credentials: GSC service account, GSC access token, GA4 service account, GA4 access token, Bing API key
- All sensitive values stored in system keychain (not settings.json)
- All 5 credential-using tools (gsc-client, ga4-client, bing-webmaster, keyword-intelligence, index-doctor) now read from both `ULTRASHIP_*` env vars and `CLAUDE_PLUGIN_OPTION_*` env vars
- Error messages now suggest `/plugin configure ultraship` as alternative setup method

### Changed
- Removed prose "Time Budget" sections from agents — `maxTurns` enforces this at the system level now
- Bumped version across plugin.json, marketplace.json, package.json

## [2.5.2] - 2026-04-01

### Fixed — Sub-agent Timeout Prevention

**All 12 agents — model assignment overhaul:**
- Replaced `model: inherit` (which inherited Opus from parent, causing slow execution and timeouts)
- Opus assigned to agents requiring deep reasoning: code-reviewer, pentest-auditor, seo-strategist, incident-responder
- Sonnet assigned to tool-runner agents: seo-auditor, security-auditor, perf-auditor, browser-verifier, canary-monitor, compete-analyzer, growth-tracker, launch-auditor

**Heavy agents — parallel execution + tool call budgets:**
- seo-strategist: Run all 4 data tools in parallel (was sequential), 10 call budget
- pentest-auditor: Run scanner + local grep + GitHub check in parallel, batch 8 grep patterns into one regex, 12 call budget
- code-reviewer: Use `git diff` first, read only changed files (max 8), cap at 10 issues, 8 call budget
- security-auditor: Run dep audit + secret scanner + OWASP grep in parallel, single alternation regex, 6 call budget
- seo-auditor: Lean 3-step process, 4 call budget
- canary-monitor: Skip Playwright unless explicitly requested, 6 call budget

**subagent-driven-development skill:**
- Model table: opus for code-quality-reviewer and final-reviewer, sonnet for implementer (simple tasks) and spec-reviewer
- Implementer prompt: 15 tool call budget, no codebase exploration
- Spec reviewer prompt: 5 tool call budget, read only changed files

## [2.5.1] - 2026-04-01

### Fixed — Safety & Best Practices Hardening

**index-fix SKILL.md**
- Added safety checks before removing noindex tags (verify intent — staging, admin, privacy, legal pages may need noindex)
- Added safety checks before removing robots.txt Disallow rules (may protect sensitive paths)
- Added "only resubmit pages you've SUBSTANTIALLY fixed" guidance to prevent quota waste and spam flags
- Added rollback plan for when fixes cause unexpected issues
- Changed goal from "100% index coverage" to "100% for pages that SHOULD be indexed"

**seo-strategy SKILL.md**
- Changed AI bot "MUST be allowed" mandate to "recommended — verify against privacy policy and content licensing"
- Added FAQPage schema caveat: only for pages with genuine user-asked questions
- Fixed canonical + redirect contradiction: use one or the other, not both
- Softened AI bot unblocking to respect user's content protection decisions

**seo-scanner.mjs**
- Reduced nosnippet findings from severity 'high' to 'medium' with "if intentional, ignore" caveat
- Reduced max-snippet AI finding from 'medium' to 'low' with "may be intentional" caveat
- Reduced AI bot blocked findings from 'high' to 'medium' with privacy policy caveat
- Added "if intentional (staging, admin, private pages), this is expected" to noindex AI finding
- All snippet/bot findings now acknowledge legitimate business reasons for restrictions

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
