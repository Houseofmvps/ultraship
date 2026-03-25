# Reddit r/SideProject Post

## Title
Ultraship — one Claude Code plugin that replaced my entire pre-deploy checklist (free, open source)

## Body

Hey! Solo founder here. I kept forgetting things before deploying — SEO tags, leaked secrets, unused dependencies, N+1 queries. So I built a plugin that checks everything in one command.

**What it is:** Ultraship is a Claude Code plugin (also works as standalone CLI) that audits your project across SEO, security, code quality, and bundle size.

**The workflow:**
1. Build your feature in Claude Code
2. Type `/ship`
3. Get a scorecard across 4 categories
4. Fix anything below 80
5. Deploy

**What I used it on:** My own production SaaS (SaveMRR — pnpm monorepo with 5 workspace packages):

- Backend scored **83/100 READY TO SHIP** — caught a real N+1 query in a background job, correctly identified 9 seed-data loops as low priority
- Landing page scored **78/100 NEEDS WORK** — found 33 unused dependencies (dead shadcn/ui wrapper files detected through import graph analysis), 153 SEO issues

It even checks your SSL certificate and shows days until expiry.

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

Full monorepo support. 1 dependency. 113 tests. Free, MIT license, no telemetry.

GitHub: https://github.com/Houseofmvps/ultraship

Feedback welcome!
