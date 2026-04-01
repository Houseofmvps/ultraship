---
name: deploy
description: Pre-flight checks then deploy. Validates env vars, migrations, bundle size, runs /ship audit, then deploys via git push or platform CLI.
argument-hint: "<environment>"
---

# Deploy

Full pre-flight validation → deploy pipeline. Closes the audit-to-production loop.

## Process

### Step 1: Detect Deploy Target

Check project for deploy configuration:
- `vercel.json` or `.vercel/` → Vercel (git push)
- `railway.toml` or `railway.json` → Railway
- `fly.toml` → Fly.io
- `wrangler.toml` → Cloudflare Workers
- `.github/workflows/` with deploy steps → CI/CD pipeline
- `Dockerfile` → Container-based deploy
- None found → ask user for deploy target

### Step 2: Pre-Flight Checks

Run these checks BEFORE deploying (fail fast):

**2a. Environment Validation**
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/env-validator.mjs <project-directory>
```
If `deploy_ready: false` → STOP. Show missing vars. Do not deploy.

**2b. Migration Safety**
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/migration-checker.mjs <project-directory>
```
If `deploy_safe: false` → WARN. Show pending migrations. Ask user to confirm.

If there are pending migrations, verify they are reversible:
- For Drizzle: check that corresponding `down` SQL or rollback logic exists
- For Prisma: confirm `prisma migrate resolve` can undo the migration
- For Knex: verify the `down()` function exists and is not empty
- If the migration is destructive (dropping columns, renaming tables, deleting data) and has no rollback path → STOP. This is not safe to deploy without a manual rollback plan.

**2c. Bundle Size Check**
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bundle-tracker.mjs <project-directory> --save
```
If bundle grew >50KB since last check → WARN. Show diff.

**2d. Git Status**
Check for uncommitted changes:
```bash
git status --porcelain
```
If dirty working tree → WARN. Suggest committing first.

**2e. Rollback Plan**

Before deploying, establish a rollback plan. Every deploy must have a way back.

Record the current production commit hash:
```bash
git rev-parse HEAD
```
Store this value — it is your safety net. If anything goes wrong after deploy, this is the commit you revert to.

Verify the rollback command is ready:
```bash
git revert <commit> --no-edit
```
Do not execute this yet. Confirm the command is syntactically correct and the commit hash is valid. The goal is to have a copy-paste rollback ready before you need it — not after you're panicking at 2am.

For database changes:
- Confirm the migration has a working `down` migration (checked in Step 2b)
- If the migration drops a column or table, the data is gone. There is no rollback. You need a backup strategy instead: `pg_dump` the affected tables before deploying, or use a feature flag to decouple the schema change from the code change
- For additive-only migrations (new columns, new tables), rollback is safe — the old code simply ignores the new schema

For breaking API changes:
- Confirm that API consumers can handle both the old and new response shapes during the transition window
- If the API serves mobile clients or third-party integrations, a breaking change without versioning is not a rollback — it is a second outage
- Prefer additive changes (new fields) over destructive changes (removed/renamed fields)

Document the rollback steps in a format that can be executed under pressure:
```
ROLLBACK PLAN:
1. git revert <new-commit-hash> --no-edit
2. git push origin main
3. [If DB migration]: run down migration or restore from backup
4. Verify health check passes after rollback
```

### Step 3: Run Ship Audit

Run the full `/ship` scorecard. If overall score < 60 → WARN but don't block (user decides).

A score below 60 means there are known issues going to production. That is a conscious decision, not an accident. Log it so the post-deploy summary reflects the risk accepted.

### Step 4: Deploy

Based on detected target:

**Vercel (git push — REQUIRED for this user):**
```bash
git push origin main
```
NEVER use `vercel` CLI. Always git push.

**Railway:**
```bash
railway up
```

**Fly.io:**
```bash
fly deploy
```

**Cloudflare Workers:**
```bash
npx wrangler deploy
```

**CI/CD:**
```bash
git push origin main
```
Then check CI status:
```bash
gh run list --limit 1 --json status,conclusion
```

Record the deploy start time. You will need this for the post-deploy summary.

### Step 4b: Smoke Tests

After deploy lands but before declaring success, verify the application actually works for real users. A successful `git push` is not a successful deploy — it is a successful file transfer.

Hit 3-5 critical user paths against the production URL:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/api-smoke-test.mjs <production-url>
```

At minimum, verify:
1. **Homepage** returns 200 (not 500, not a redirect loop, not a blank page)
2. **Login/auth endpoint** responds (does not need to complete auth — just confirm it is not crashing)
3. **Core feature endpoint** returns valid JSON with the expected shape
4. **API health endpoint** (if one exists) returns 200 with a response body
5. **Static assets** load (CSS/JS files return 200, not 404 — a broken asset build is invisible to health checks but catastrophic to users)

Verify response codes and content types:
- 200 responses should return the expected `Content-Type` (HTML for pages, JSON for APIs)
- Watch for soft failures: a 200 that returns an error page, or a JSON response with `{ "error": true }` inside a 200 status code
- Check that responses are not empty (a 200 with a 0-byte body is not healthy)

If Playwright MCP is available, run a quick browser check on the production URL:
- Navigate to the homepage, confirm it renders (not a white screen)
- Click one critical CTA and confirm navigation works
- Check the browser console for JavaScript errors — a deploy that throws uncaught exceptions on load is broken even if the server returns 200

**If any smoke test fails, execute the rollback plan immediately.** Do not debug in production. Do not "just check one more thing." Roll back, confirm the rollback is healthy, then investigate the failure from safety. The cost of a 5-minute rollback is always less than the cost of a 30-minute production outage while you debug.

### Step 5: Post-Deploy Health Check

After deploy completes, run health check against production URL:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Report: status code, response time, SSL status, security headers.

If the health check fails on the first attempt, wait 30 seconds and retry once. Some platforms (Vercel, Railway) have a cold-start window where the first request after deploy is slow or fails. Two consecutive failures means the deploy is broken — trigger rollback.

### Step 5b: Performance Baseline

After confirming the deploy is healthy, record performance metrics as the new baseline.

Record the response time from the health check as the post-deploy baseline:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Compare to the pre-deploy baseline:
- If response time is **>50% slower** than the previous deploy → flag as a performance regression. This does not necessarily mean rollback, but it means something changed that deserves investigation before the next deploy.
- If response time is **>200% slower** (3x the previous baseline) → treat this as a deploy failure. Something is fundamentally wrong — likely an unoptimized query, a missing index on a new migration, or a cold-start loop.

Check platform-level metrics if available:
- **Railway**: check the dashboard for memory usage and CPU spikes in the minutes after deploy
- **Fly.io**: `fly status` and `fly logs` for health check failures or OOM kills
- **Vercel**: check function execution duration in the Vercel dashboard — serverless cold starts can mask real performance regressions
- **Cloudflare Workers**: check CPU time in the dashboard (Workers have a 50ms CPU limit on the free plan)

Store the performance baseline for comparison on the next deploy:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> response_time <ms>
```

### Step 6: Save Audit History

Save all scores for before/after comparison:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> seo <score>
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> performance <score>
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> security <score>
```

### Step 7: Post-Deploy Summary

Output deployment summary:
```
====================================
  DEPLOY COMPLETE
====================================
  Target:     Vercel (git push)
  Branch:     main
  Commit:     abc1234
  URL:        https://example.com
  Health:     HEALTHY (247ms)
  SSL:        Valid (89 days remaining)
====================================
  Pre-flight: 3/3 passed
  Ship Score: 90/100
====================================
  Response Time:  247ms (prev: 210ms, +17%)
  Deploy Duration: 2m 14s (push → health check pass)
====================================
  ROLLBACK COMMAND (ready to copy-paste):
  git revert abc1234 --no-edit && git push origin main
====================================
```

Include in every post-deploy summary:
- **Rollback command**: ready to copy-paste, no thinking required. If something breaks in the next 30 minutes, the person responding should be able to roll back without understanding the change.
- **Time from deploy start to health check pass**: this is your deploy duration. Track it over time. If deploys are getting slower, your build pipeline needs attention.
- **Response time comparison**: current vs. previous deploy. A consistent upward trend across deploys means you are accumulating technical debt in your runtime, not just your codebase.
- **Risk accepted**: if any pre-flight check was overridden or the ship score was below 60, note it here. Future-you deserves to know what past-you decided to ship anyway.

## Deploy Checklist for Different Stages

Not all deploys carry the same risk. A staging deploy that breaks is a Slack message. A production deploy that breaks is revenue loss and user trust damage. Treat them differently.

### Staging Deploys

Staging exists to catch what pre-flight checks cannot — integration issues, data-dependent bugs, and UX regressions that only appear with real-ish data.

- Run the full test suite before deploying to staging. If tests fail, fix them. Staging is not where you go to "see if it works" — it is where you go to confirm it works.
- Skip audit score thresholds. Staging does not need a perfect Lighthouse score. It needs functional correctness.
- Test with production-like data if possible. A staging environment with 3 rows in the database will not catch the N+1 query that takes down production with 30,000 rows.
- Staging deploys do not need a rollback plan. If staging breaks, redeploy. The blast radius is zero.

### Production Deploys

Production is where your reputation lives. Every production deploy is a promise to your users that the product still works.

- **All pre-flight checks must pass.** No overrides. If the env validator says a variable is missing, it is missing. If the migration checker says a migration is unsafe, it is unsafe. Pre-flight checks exist because someone got burned by the thing they check for.
- **Deploy during low-traffic windows when possible.** Check your analytics for the quietest hour. For most B2B SaaS, that is 2-4am in your primary user timezone. For global products, there is no quiet hour — use feature flags instead.
- **Have monitoring dashboards open during deploy.** You should be watching error rates, response times, and active user counts in real-time. If you do not have monitoring, the health check and smoke tests are your only safety net — do not skip them.
- **Keep the rollback command ready for 30 minutes post-deploy.** Most deploy failures manifest within 15 minutes (the first request cycle). Some take longer — a memory leak that only shows up under sustained load, a cache expiry that triggers a stampede. 30 minutes is the minimum safe window.
- **Never deploy on Friday afternoon unless it is a critical fix.** This is not superstition. It is resource planning. If a deploy breaks production at 4pm Friday, you are debugging through dinner and into the weekend. If it can wait until Monday, it should.

### Hotfix Deploys

A hotfix is production on fire. Speed matters, but not more than making things worse.

- **Skip non-critical pre-flight checks** (bundle size, audit score). These are valuable for planned deploys. For a hotfix, they are noise.
- **Never skip env validation and migration checks.** These are never optional. A hotfix that deploys with a missing database URL does not fix the outage — it creates a second one.
- **Deploy immediately, but still health check after.** The hotfix might fix the original issue but introduce a new one. Confirm with the health check. Confirm with the smoke tests. A hotfix that makes things worse is the worst possible outcome.
- **Write a post-mortem within 24 hours.** Not because process matters, but because memory decays. In 24 hours you will forget why the migration was unsafe, what the error message actually said, and what you tried before the thing that worked. Write it down while it is fresh. The post-mortem is not for your manager — it is for future-you the next time production is on fire.

## Key Principles

- **Never deploy without a rollback plan** — the deploy that cannot be undone is the deploy that breaks production for hours. Every minute you spend writing a rollback plan before deploying is ten minutes you save when you need to execute it at 2am with your heart racing. Rollback is not a sign of failure. It is the mark of an engineer who builds safety nets before walking the wire.

- **Smoke test before celebrating** — a successful deploy is not a 200 from the health endpoint. It is users completing their core workflow. Health checks confirm the server is running. Smoke tests confirm the product is working. These are different things, and the gap between them is where production incidents live.

- **Deploy is not done when the code lands** — it is done when you have confirmed it works, recorded the metrics, and the rollback window has passed. A deploy without post-verification is a coin flip you made with your users' experience. Close the loop: deploy, verify, measure, document.

- **Respect the blast radius** — database migrations, API changes, and infrastructure updates are higher risk than UI changes. Treat them differently. A CSS fix that breaks a button color is a 5-minute fix. A migration that drops a column is a restore-from-backup event. The pre-flight checks, the rollback plan, the smoke tests — they are proportional to the blast radius, not the line count.

- **Never deploy with missing env vars** — this is the #1 production failure. It is also the most preventable. The env validator exists for a reason. If it says something is missing, something is missing.

- **Always health check after deploy** — catch issues before users do. Your monitoring should tell you about problems before your users do. If your users are telling you the site is down, your deploy process failed twice: once when it broke, and once when it did not catch the break.

- **Save history** — track improvement over time. Deploy metrics without history are just numbers. Deploy metrics with history are a trendline. Trendlines tell you whether your deploys are getting safer or riskier, faster or slower, more reliable or less.

- **Respect user preferences** — Vercel = git push only, never CLI.
