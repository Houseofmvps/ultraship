# Hacker News Launch

## Title
Show HN: Ultraship – One-command pre-deploy quality gate for Claude Code (1 dep, 113 tests)

## URL
https://github.com/Houseofmvps/ultraship

## Comment (post immediately after submitting)

Hey HN, I'm the author. Ultraship is a Claude Code plugin that runs 5 tools in parallel (SEO scanner, secret scanner, code profiler, dependency doctor, bundle tracker) and produces a ship-readiness scorecard.

The problem it solves: as a solo founder, I was deploying without checking anything. I'd forget meta tags, leave placeholder API keys, ship N+1 queries, and have 30+ unused dependencies bloating my node_modules.

I tried using separate tools for each. They didn't coordinate, and configuring them was slower than the actual coding.

So I built one plugin that does everything. Type `/ship`, get a scorecard.

Ran it on my own production SaaS (Hono + React + Drizzle pnpm monorepo, 5 workspace packages):
- Backend: 83/100 — found 1 real N+1 in a background job, 1 memory leak, correctly identified 9 seed-data loops as low priority (not false criticals)
- Landing page: 78/100 — found 33 unused deps through import graph analysis (dead shadcn/ui wrappers)

Things I'm particularly proud of technically:

- **Import graph analysis** for unused dep detection. String matching alone produces false negatives when deps are imported in wrapper files that nothing imports. Ultraship traces reachability from entry points.
- **Context-aware code profiling.** DB queries in `for` loops inside a `/seed-demo` route get downgraded to low severity. The profiler walks backwards to find the enclosing route definition and checks for seed/demo/test keywords.
- **1 runtime dependency** (htmlparser2, 30KB SAX parser). No native bindings. No node-gyp.
- All subprocess calls use `execFileSync` with array args — no shell injection possible.
- SSRF protection on every HTTP tool. Private IPs, cloud metadata, non-HTTP schemes blocked.
- 113 unit tests across 10 test files, running on Node 18, 20, 22.
- No telemetry. No analytics. No phone-home.

It also works standalone via npx:
```
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
npx ultraship health https://yourapp.com
```

Free, MIT licensed. I don't plan to add a paid tier — this is my portfolio piece.

Happy to answer questions about the architecture or the Claude Code plugin system.
