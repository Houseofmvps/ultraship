---
name: rescue
description: "Production Incident Commander — diagnose and recover from production incidents. Use when something is broken in production, site is down, errors spiking, or user reports a critical bug."
---

# Production Incident Commander

When prod is on fire, this turns panic into a checklist. Diagnose, recover, prevent.

## Process

### Phase 1: Gather Context

Ask for:
1. **Production URL** (if not already known)
2. **What's happening?** (down, slow, errors, specific feature broken)

If the user is panicking, skip questions and use whatever info is available.

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

**Likely Culprit:**
- Most recent commit with significant changes
- Files changed in that commit
- When it was deployed

**Error Patterns Found:**
- Unhandled promises, missing error handlers
- Environment variable issues
- Database connection problems

### Phase 4: Recovery Options

Present recovery options in order of speed:

**Option 1: Rollback (fastest)**
```bash
git revert <culprit-hash> --no-edit && git push
```
Estimated recovery: 2-5 minutes (Vercel/Railway auto-deploy)

**Option 2: Hot Fix**
If the error pattern is clear, fix the specific issue:
- Apply the fix using Edit tool
- Test locally if possible
- Push the fix

**Option 3: Investigate Further**
If the cause isn't clear:
- Check application logs
- Check database connectivity
- Check third-party service status
- Check recent environment variable changes

### Phase 5: Verify Recovery

After applying a fix:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Confirm the site is back to healthy status.

### Phase 6: Post-Mortem

Generate a post-mortem document from the incident-commander output:

1. **Incident Summary** — what happened, when, impact
2. **Timeline** — detection → investigation → fix → recovery
3. **Root Cause** — what actually went wrong
4. **What Went Well** — fast detection, quick recovery
5. **What Went Wrong** — missed in review, no test coverage
6. **Action Items** — preventive measures with owners and deadlines

Save the post-mortem to `docs/incidents/YYYY-MM-DD-incident.md`.

### Phase 7: Prevention

Based on the incident, suggest preventive measures:
- Add tests for the specific failure case
- Add monitoring for the failure pattern
- Add a pre-deploy check that would have caught this
- Update the deployment process if needed

## Key Principle

**Speed over perfection.** In an incident, the goal is to restore service FIRST, then investigate. Rollback is almost always the right first move. Root cause analysis comes after the fire is out.
