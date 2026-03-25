<div align="center">

<img src="assets/hero-banner.jpg" alt="Ultraship — All-in-one Claude Code Plugin" width="100%"/>

### The only Claude Code plugin you need. 22 skills. 20 tools. 5 agents. Ship production-ready SaaS with one command.

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

</div>

---

<div align="center">

<img src="assets/demo.gif" alt="Ultraship CLI Demo — SEO audit, secret scanning, scorecard" width="100%"/>

*SEO audit, secret scanning, and the /ship scorecard — all from your terminal.*

</div>

---

## Quick Start

```bash
# As a Claude Code plugin (recommended)
claude plugin add ultraship

# Or try standalone — no plugin install needed
npx ultraship seo .
npx ultraship security .
npx ultraship health https://yourapp.com
```

Then in Claude Code:

```bash
/ship          # Full pre-deploy audit + scorecard
/seo           # SEO/GEO/AEO audit with auto-fix
/secure        # Security scan with auto-fix
/perf          # Lighthouse performance audit
/deploy        # Build -> audit -> deploy -> health check
```

---

## What /ship Produces

Run `/ship` and get a scorecard across 5 dimensions:

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

5 parallel agents. 60+ rules. Auto-fixes what it can. Score >= 80? Ship it.

---

## Dogfooded in Production

Ultraship is built with Ultraship. First `/ship` run on [houseofmvps.com](https://houseofmvps.com):

| Metric | Before | After |
|---|---|---|
| SEO/GEO/AEO | 38/100 | 78/100 |
| Performance | 53/100 | 71/100 |
| Security | 71/100 | 92/100 |
| Code Quality | 59/100 | 81/100 |
| Overall | **56/100** | **80/100** |

10 critical/high issues auto-fixed in two commits: CORS lockdown, unused deps removed (-400KB), OG tags added, error leakage plugged, vendor splitting enabled, Lighthouse blockers deferred.

---

## What's Inside

| Category | Count | Highlights |
|---|---|---|
| **Skills** | 22 | Brainstorming, TDD, debugging, planning, code review, frontend design, verification |
| **Tools** | 20 | SEO scanner (60+ rules), Lighthouse runner, secret scanner, bundle tracker, code profiler |
| **Agents** | 5 | Ship orchestrator, SEO auditor, security auditor, perf auditor, browser verifier |
| **Commands** | 17 | `/ship` `/seo` `/secure` `/perf` `/deploy` `/review` `/health` `/bundle` `/profile` `/deps` and more |
| **MCP Servers** | 2 | Live library docs (Context7), browser automation (Playwright) |

<details>
<summary><strong>All 17 commands</strong></summary>

| Command | What it does |
|---|---|
| `/ship` | Pre-deploy quality gate — 5 agents, 60+ rules, scorecard |
| `/seo` | SEO/GEO/AEO audit with auto-fix |
| `/secure` | Security scan — deps, secrets, OWASP, headers |
| `/perf` | Lighthouse performance audit |
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

## How It Works

1. **You describe what you want.** Brainstorming skill asks questions, proposes approaches, writes a spec.
2. **Planning breaks it down.** Exact file paths, code, test commands, commit messages. Every step is 2-5 minutes.
3. **TDD is enforced.** Write the failing test. Implement. Refactor. Commit.
4. **When you're ready:** `/ship` dispatches 5 agents, runs 60+ rules, auto-fixes issues, produces the scorecard.
5. **Score >= 80?** Ship it. Below 80? Fix the remaining items and run again.

Skills activate automatically based on what you're doing. Zero configuration.

---

## Security

| Protection | How |
|---|---|
| **No shell injection** | `execFileSync` with array args everywhere |
| **SSRF protection** | Blocks private IPs, cloud metadata, non-HTTP schemes |
| **No telemetry** | Zero data collection. No phone-home. Ever. |
| **1 dependency** | `htmlparser2` only (30KB). No native bindings. |
| **42 unit tests** | Security module, secret scanner, SEO scanner all tested |
| **Secret redaction** | Found secrets truncated in output |

See [SECURITY.md](SECURITY.md) for the full details.

---

## Philosophy

**Test-Driven, Not Vibe-Driven.** Red-green-refactor is enforced, not suggested.

**Think First, Build Second.** Brainstorming and planning before code. The spec gets reviewed before the first line is written.

**Evidence Before Assertions.** Never claims "it works" without proof. The scorecard is evidence, not opinion.

**1 Dependency.** `htmlparser2` (30KB). No `node-gyp`. No supply chain surface area.

---

## Contributing

Found a bug? Want a new auditor? [Open an issue](https://github.com/Houseofmvps/ultraship/issues) or PR.

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm test              # 42 tests, node:test
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
