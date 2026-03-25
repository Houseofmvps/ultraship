# X (Twitter) Launch Thread

## Tweet 1 (Hook)
I built a Claude Code plugin that replaced my entire pre-deploy checklist.

22 skills. 20 tools. 1 dependency. 113 tests.

One command tells you if your SaaS is ready to ship.

It's free. Here's the thread:

🧵👇

## Tweet 2 (The Problem)
The problem with AI coding:

You build fast. But you ship blind.

No SEO check. No secret scan. No dependency audit.

You find out your OG tags are broken when your launch post shows a grey box for 6 hours.

## Tweet 3 (The Solution)
So I built Ultraship.

Type `/ship` in Claude Code.

5 tools run in parallel:
→ SEO/GEO/AEO (60+ rules)
→ Security (secret scanning)
→ Code Quality (N+1 queries, dead deps, memory leaks)
→ Bundle Size (heavy deps, build analysis)

You get a scorecard. >= 80? Ship it.

[attach demo.gif]

## Tweet 4 (Smart detection)
It doesn't just scan — it understands context.

→ Seed/demo data loops? Downgraded to low priority, not false "critical"
→ Dead shadcn/ui wrapper files? Detected via import graph analysis
→ Pre-rendered dist/ HTML? Included automatically
→ pnpm monorepo? Scans all workspace packages

My SaaS scored 83/100 READY TO SHIP.

## Tweet 5 (Workflow)
But /ship is just the end.

Ultraship rewires the ENTIRE workflow:

1. Brainstorming → spec before code
2. Planning → bite-sized tasks
3. TDD → tests before implementation
4. Debugging → systematic, not guessing
5. Code review → N+1s, auth bypasses
6. /ship → pre-deploy gate
7. Deploy → health check + SSL verification

## Tweet 6 (Technical flex)
Technical details for the nerds:

→ 1 dependency (htmlparser2, 30KB)
→ No telemetry, no phone-home
→ SSRF protection on every HTTP tool
→ execFileSync everywhere (no shell injection)
→ 113 unit tests
→ CI on Node 18, 20, 22
→ Full monorepo support (pnpm/npm/yarn/lerna)
→ MIT license

## Tweet 7 (Standalone CLI)
Don't use Claude Code? Try it anyway:

```
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
npx ultraship health https://yourapp.com
```

Works in any terminal. No plugin install needed.

## Tweet 8 (CTA)
Install it in 5 seconds:

```
claude plugin add ultraship
```

Or try standalone:
```
npx ultraship ship .
```

Star: github.com/Houseofmvps/ultraship
npm: npmjs.com/package/ultraship

Free forever. No pro tier. No paywalls.

Built solo by @kaileskkhumar

If this saves you time, RT tweet 1.
