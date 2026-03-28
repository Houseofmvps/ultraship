---
name: rescue
description: "Production Incident Commander — diagnose and recover from production incidents. Use when something is broken in production, site is down, errors spiking, or user reports a critical bug."
---

# Production Incident Commander

When production is down, every minute costs trust. This skill runs an incident like a principal SRE — fast triage, clear decision-making, structured recovery, and prevention so it never happens again.

## Severity Classification

Before doing anything, classify the incident:

| Severity | Definition | Response Time | Example |
|---|---|---|---|
| **SEV-1** | Service completely down, all users affected | Immediately | Site returns 500, database unreachable |
| **SEV-2** | Major feature broken, many users affected | Within 15 min | Auth broken, payments failing, data loss |
| **SEV-3** | Minor feature broken, some users affected | Within 1 hour | One API endpoint slow, email not sending |
| **SEV-4** | Cosmetic or edge case | Next business day | UI glitch on one browser, non-critical error log |

Severity determines urgency. SEV-1/2: restore first, investigate later. SEV-3/4: investigate first, then fix.

## Process

### Phase 1: Gather Context

Ask for:
1. **Production URL** (if not already known)
2. **What's happening?** (down, slow, errors, specific feature broken)
3. **When did it start?** (narrows the commit search window)
4. **What changed recently?** (deploy, config change, dependency update, traffic spike)

If the user is panicking, skip questions and use whatever info is available. Speed > completeness for SEV-1.

### Phase 2: Run Diagnostics

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/incident-commander.mjs <project-directory> --url=<production-url>
```

Parse the JSON output.

### Phase 3: Triage

Present findings in order of urgency:

**Site Status:**
- UP / DOWN / DEGRADED
- Response time and status code
- Health endpoint status
- SSL certificate validity

**Likely Culprit:**
- Most recent commit with significant changes
- Files changed in that commit
- When it was deployed
- Correlation: did the issue start after this deploy?

**Error Patterns Found:**
- Unhandled promises, missing error handlers
- Environment variable issues (missing, placeholder values)
- Database connection problems
- Third-party service failures

**Resource Issues:**
- Memory pressure signals (process.memoryUsage patterns in code)
- Unbounded data growth (arrays that grow without cleanup)
- Connection pool exhaustion (too many DB connections)

### Phase 4: Recovery Options

Present in order of speed — for SEV-1/2, always recommend Option 1 first:

**Option 1: Rollback (fastest — 2-5 min)**
```bash
git revert <culprit-hash> --no-edit && git push
```
This is almost always the right first move. Restore service, then investigate.

**When NOT to rollback:**
- The rollback would cause data loss (destructive migration already ran)
- The issue isn't in the latest deploy (pre-existing problem that suddenly surfaced)
- The rollback is bigger than the fix (e.g., reverting 50 files when the fix is 1 line)

**Option 2: Hot Fix (5-15 min)**
If the error pattern is clear and the fix is small:
- Apply the fix using Edit tool
- Run tests locally
- Push the fix with a clear commit message: `fix: [what was broken] — incident [date]`
- Verify with health check

**Option 3: Traffic Management (immediate)**
If the issue is load-related:
- Enable maintenance mode if available
- Scale up infrastructure if possible (Railway: increase instance count)
- Add rate limiting to affected endpoints
- Redirect traffic away from broken feature

**Option 4: Investigate Further**
If the cause isn't clear:
- Check application logs (Railway: `railway logs`, Vercel: function logs)
- Check database connectivity and query performance
- Check third-party service status pages (Stripe, Resend, Supabase, etc.)
- Check recent environment variable changes
- Check if DNS/SSL certificate expired

### Phase 5: Verify Recovery

After applying a fix:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Confirm the site is back to healthy status. Check:
- Status code 200
- Response time within normal range
- SSL still valid
- Key functionality working (not just the homepage)

### Phase 6: Communication

For SEV-1/2, the user needs to communicate with their users:

**Status page update template:**
```
[Investigating] We're aware of [issue description] and are actively working on a fix.
[Identified] We've identified the cause and are deploying a fix.
[Resolved] The issue has been resolved. [Brief explanation]. We apologize for the disruption.
```

**If the user has a status page:** help them post the update.
**If they don't:** suggest setting up a simple one (Instatus, Betteruptime, or a static page).

### Phase 7: Post-Mortem

Generate a post-mortem document from the incident-commander output:

```markdown
# Incident Post-Mortem — [Date]

## Summary
- **What happened:** [One sentence]
- **Severity:** SEV-[N]
- **Duration:** [start time] to [end time] ([N] minutes)
- **Impact:** [Who was affected, what they experienced]
- **Root cause:** [One sentence]

## Timeline
| Time | Event |
|---|---|
| HH:MM | Issue detected (how: monitoring/user report/deploy) |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service restored |

## Root Cause Analysis
[Detailed explanation of what went wrong and why]

## What Went Well
- [Fast detection, quick recovery, etc.]

## What Went Wrong
- [Missed in review, no test coverage, no monitoring, etc.]

## Action Items
| Action | Priority | Owner | Deadline |
|---|---|---|---|
| Add test for this failure case | High | [user] | This week |
| Add monitoring for [pattern] | High | [user] | This week |
| Add pre-deploy check that would have caught this | Medium | [user] | This sprint |
| [Update runbook/docs] | Low | [user] | This month |
```

Save to `docs/incidents/YYYY-MM-DD-incident.md`.

### Phase 8: Prevention

Based on the incident, suggest concrete preventive measures:

**Immediate (today):**
- Add a test that reproduces the exact failure
- Add the specific check to the `/ship` pre-deploy audit

**This week:**
- Set up uptime monitoring (Betteruptime, UptimeRobot — free tiers available)
- Add health check endpoint if one doesn't exist (`/health` or `/api/health`)
- Set up error alerting (Sentry free tier, or a simple error webhook)

**This month:**
- Add the failure pattern to code review checklist
- Document the runbook for this type of incident
- If this was a database issue: add connection pool monitoring
- If this was a deployment issue: add canary deployments or staged rollouts

## Key Principles

- **Speed over perfection.** Restore service FIRST, investigate AFTER. Rollback is almost always the right first move.
- **No blame.** Post-mortems are about systems, not people. "The deploy process didn't catch this" not "Developer X broke production."
- **Every incident is a gift.** It reveals a gap in your system. The post-mortem action items are how you prevent the next incident.
- **Communicate early and often.** Silence during an outage erodes trust faster than the outage itself.
