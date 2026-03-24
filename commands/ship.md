---
description: Run all auditors and produce a ship-readiness scorecard
---

# /ship — Pre-Deploy Quality Gate

Run all Ultraship auditors and produce a screenshot-shareable scorecard.

## Step 1: Detect Project Type

Examine the project to determine type:
- **API-only**: No HTML files, no index.html, no frontend framework config (next.config, vite.config, astro.config) → skip SEO and browser test
- **Landing page**: Static HTML or SSG config, minimal backend logic → emphasize SEO + perf
- **Full-stack**: Both frontend and backend code → run everything

## Step 2: Dispatch Auditors

Use the ultraship:dispatching-parallel-agents skill to run these agents:

1. **seo-auditor** — Scan all HTML files for SEO/GEO/AEO issues (skip for API-only)
2. **perf-auditor** — Run Lighthouse against the running app
3. **security-auditor** — Run dep audit + secret scan + OWASP pattern check
4. **code-reviewer** — Review staged changes or recent commits for quality
5. **browser-verifier** — Smoke-test the running app with Playwright (skip for API-only)

## Step 3: Collect & Score

Each agent returns JSON with category, scores, and findings.

**Scoring algorithm:**
- Start at 100 per category
- Deduct per finding: critical=-20, high=-10, medium=-5, low=-2, info=0
- Floor at 0
- Browser test is pass/fail (not scored numerically)

**Weight distribution by project type:**
- **Full-stack**: SEO 25%, Performance 25%, Security 25%, Code Quality 25%
- **API-only**: Security 40%, Code Quality 40%, Performance 20%
- **Landing page**: SEO 40%, Performance 40%, Security 20%

**Overall** = weighted average of category scores (rounded to nearest integer)

## Step 4: Auto-Fix

Apply fixes for SEO, security, and code quality findings:
- Use the ultraship:seo-audit skill for SEO fixes
- Use the ultraship:security-audit skill for security fixes
- Performance fixes require manual review (don't re-run Lighthouse)

Count total fixes applied.

## Step 5: Output Scorecard

Format the scorecard exactly like this (adjust numbers to actual scores):

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

**Progress bar**: each `=` represents ~9 points on an 11-character bar. Calculate: `Math.round(score / 9)` filled chars, rest are `-`.

**Status thresholds:**
- >= 80: "READY TO SHIP"
- 60-79: "NEEDS WORK"
- < 60: "NOT READY"

For API-only projects, omit the SEO and Browser Test lines. Adjust weights accordingly.

## Step 6: CI Check (Optional)

If `.github/workflows/` exists, check CI status:
```bash
gh run list --limit 1 --json status,conclusion
```
If CI is failing, add a warning below the scorecard:
```
  ⚠ CI: Latest run FAILED
```

## Key Principles

- **Fix, don't just audit** — auto-resolve everything possible
- **Never block on missing tools** — if Chrome is missing, skip Lighthouse gracefully
- **Scorecard is the product** — make it beautiful and screenshot-worthy
