---
name: ship-gate
description: Turn the /ship scorecard into a blocking, config-as-code quality gate. Sets per-category score thresholds, hard-fails on leaked secrets or critical findings, and wires the gate into a pre-push hook and CI so nothing below the bar merges. Use when the user wants a merge gate, CI quality gate, pre-push check, or to enforce ship-readiness.
argument-hint: "[init|run|ci|hook] [directory]"
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Ship-Gate — Deterministic Quality Gate

The 2026 consensus on AI-written code is "did it pass the gates," not "did a senior read every line." This skill promotes the `/ship` scorecard from advisory to a **blocking, deterministic gate**: same scoring as `/ship` (shared `tools/lib/ship-scoring.mjs`), compared against thresholds in `.ultraship/ship-gate.json`, exiting non-zero so it can fail a push or a CI job.

## When to use

The user wants a merge gate, a CI quality check, a pre-push guard, or to enforce a minimum ship-readiness score before code goes out.

## Process

### Phase 1: Initialize the config

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/ship-gate.mjs init <project-directory>
```

Writes `.ultraship/ship-gate.json`:

```json
{
  "thresholds": { "overall": 80, "seo": 70, "a11y": 80, "security": 90, "quality": 70, "bundle": 70 },
  "hardFail": { "onLeakedSecrets": true, "onCriticalFindings": true },
  "skipMissing": true
}
```

- **thresholds** — minimum score (0–100) per category and overall. Below it = fail.
- **hardFail.onLeakedSecrets** — any secret finding fails the gate regardless of score.
- **hardFail.onCriticalFindings** — any `critical`-severity finding (any audit) fails the gate.
- **skipMissing** — categories that didn't run (e.g. no HTML → SEO/a11y skipped) are ignored rather than failing. Set `false` to require every category.

Tune thresholds to the project. Sensible starting points: backend API → drop `seo`/`a11y`/`bundle` or rely on `skipMissing`; marketing site → raise `seo`/`a11y`; pre-revenue MVP → lower `overall` to 70.

### Phase 2: Run the gate

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/ship-gate.mjs run <project-directory>
# or, installed: npx ultraship ship-gate .
# machine-readable: ... run <dir> --json
```

It runs all six auditors (seo, a11y, secrets, code-profiler, deps, bundle), scores them, and prints a PASS/FAIL table with a **merge-confidence** number (the overall score). **Exit 0 = pass, exit 1 = fail.**

### Phase 3: Explain and fix failures

When the gate fails, report exactly which checks were below the bar, then fix:
- Score below a category threshold → run that category's fixer: `/a11y`, `/secure`, `/seo`, `/profile` apply fixes.
- Leaked secret → remove it, rotate the key, move it to an env var (`/secure`).
- Critical finding → resolve it before anything else.

Re-run the gate to confirm it now passes. Never lower a threshold just to pass — fix the issue, or change the threshold only with the user's explicit agreement and a reason.

### Phase 4: Enforce it (CI + pre-push)

Wire the gate in so it runs automatically:

```bash
# GitHub Actions workflow at .github/workflows/ship-gate.yml
node ${CLAUDE_PLUGIN_ROOT}/tools/ship-gate.mjs ci <project-directory>

# Local git pre-push hook (.git/hooks/pre-push) — blocks a push that fails the gate
node ${CLAUDE_PLUGIN_ROOT}/tools/ship-gate.mjs hook <project-directory>
```

Tell the user how to bypass the local hook in an emergency: `git push --no-verify`. The CI gate has no bypass by design.

## Key Principles

- **One source of truth.** The gate and `/ship` share the same scoring module — the gate can never disagree with the scorecard.
- **Deterministic.** Same input → same verdict. Auditable for SOC2/ISO/HIPAA, unlike an LLM-only "looks fine."
- **Fix, don't dodge.** Failing the gate means fixing the code, not weakening the threshold.
- **Never block on a missing tool.** A tool that can't run leaves its category skipped (or fails only if `skipMissing:false`), never crashes the gate.
