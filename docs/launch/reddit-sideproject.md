# Reddit r/SideProject Post

## Title
Ultraship — one Claude Code plugin that replaced my entire pre-deploy checklist (free, open source)

## Body

Hey! Solo founder here. I kept forgetting things before deploying — SEO tags, leaked secrets, performance regressions, missing env vars. So I built a plugin that checks everything in one command.

**What it is:** Ultraship is a Claude Code plugin (also works as standalone CLI) that audits your project across SEO, security, performance, and code quality, then auto-fixes what it can.

**The workflow:**
1. Build your feature in Claude Code
2. Type `/ship`
3. Get a scorecard across 5 dimensions
4. Fix anything below 80
5. Deploy

**What I used it on:** My own site went from 56/100 to 80/100 in two commits. It caught things I'd been shipping to production for months — CORS wildcards, a 400KB unused dependency, missing OG tags.

**Try without installing:**
```bash
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

**As a Claude Code plugin:**
```bash
claude plugin add ultraship
```

Free, MIT license, no telemetry, 1 dependency.

GitHub: https://github.com/Houseofmvps/ultraship

Feedback welcome!
