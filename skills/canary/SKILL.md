---
name: canary
description: Post-deploy canary monitoring — checks site health, detects regressions, monitors for errors after deployment. Use after deploying to verify production is healthy.
argument-hint: "<production-url>"
allowed-tools: Bash, Read, Grep
---

# Post-Deploy Canary Monitor

After every deploy, canary monitoring verifies your production site is healthy. It checks HTTP status, response time, error patterns, and compares against a baseline to detect regressions.

**Announce at start:** "I'm running post-deploy canary monitoring."

## Process

### Step 1: Run Canary Checks

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/canary-monitor.mjs <production-url> --checks 3 --interval 2
```

This runs 3 health checks with 2-second intervals. Options:
- `--checks N` — number of checks to run (default: 3)
- `--interval S` — seconds between checks (default: 2)
- `--baseline <file>` — path to baseline file for regression comparison

### Step 2: Analyze Results

The canary monitor returns a health status:

| Status | Meaning | Action |
|---|---|---|
| `healthy` | All checks pass, no regressions | Deploy succeeded |
| `degraded` | Site is up but has error patterns or issues | Investigate the specific issues |
| `regression_detected` | Performance or behavior regressed from baseline | Compare with baseline, consider rollback |
| `critical_regression` | Major regression (status code change, 3x slower) | Rollback immediately |
| `down` | Site is unreachable or returning errors | Rollback immediately, use `/rescue` |

### Step 3: Report

Present the results clearly:

```
+===========================================+
|     C A N A R Y   R E P O R T            |
+===========================================+
|  URL           savemrr.co                 |
|  Status        ✓ HEALTHY                  |
|  Response Time 234ms (avg)                |
|  Checks        3/3 passed                 |
|  Regressions   None                       |
+===========================================+
```

If issues are found, show them with severity and recommended action.

### Step 4: If Unhealthy

If the canary detects problems:

**If a Sentry MCP server is connected** (check your available tools for `sentry`), confirm the regression against live error data: compare the error/issue rate since this deploy to the prior baseline window. A post-deploy spike in a new issue is hard confirmation that the deploy caused it — and the stack trace tells you exactly what to roll back or fix. Distinguish a real regression from background noise this way before recommending a rollback.

1. **`degraded`** — Show the specific error patterns found. Check if they're pre-existing or new.
2. **`regression_detected`** — Show the before/after comparison. If response time regressed >50%, investigate.
3. **`critical_regression` or `down`** — Recommend immediate rollback:
   ```bash
   git revert HEAD --no-edit && git push
   ```
   Then use `/rescue` for full incident diagnosis.

### Step 5: Save Baseline

When the site is healthy, the canary automatically saves a baseline to `.ultraship/canary/baseline.json`. Future canary runs compare against this baseline to detect regressions.

## Continuous Monitoring Loop

For extended monitoring after a risky deploy:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/canary-monitor.mjs <url> --checks 10 --interval 30
```

This runs 10 checks over 5 minutes, catching delayed failures (connection pool exhaustion, memory leaks, cache warm-up issues).

## Integration with Other Skills

- **`/deploy`** — Run canary automatically after deploy completes
- **`/rescue`** — If canary detects `down` or `critical_regression`, escalate to incident response
- **`/retro`** — Include canary results in sprint retrospectives
- **`/learn`** — Save deployment gotchas as learnings when canary catches issues

## Playwright Browser Checks (Optional)

For deeper verification, combine canary with Playwright MCP:

1. Navigate to the production URL
2. Take a screenshot
3. Check for console errors via `browser_console_messages`
4. Verify key user flows (login, main feature) work
5. Compare screenshots with pre-deploy captures (via `/visual-diff`)

This catches JavaScript errors, broken layouts, and functional regressions that HTTP-only checks miss.
