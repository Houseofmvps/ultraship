---
name: deploy
description: Pre-flight checks then deploy. Validates env vars, migrations, bundle size, runs /ship audit, then deploys via git push or platform CLI.
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

### Step 3: Run Ship Audit

Run the full `/ship` scorecard. If overall score < 60 → WARN but don't block (user decides).

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

### Step 5: Post-Deploy Health Check

After deploy completes, run health check against production URL:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Report: status code, response time, SSL status, security headers.

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
```

## Key Principles

- **Never deploy with missing env vars** — this is the #1 production failure
- **Always health check after deploy** — catch issues before users do
- **Save history** — track improvement over time
- **Respect user preferences** — Vercel = git push only, never CLI
