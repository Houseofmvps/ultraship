# Reddit r/ClaudeAI Post

## Title
I built a Claude Code plugin that scans your entire SaaS in parallel and tells you if it's ready to ship

## Body

I'm a solo founder building SaaS products. Every time I shipped, I'd manually check SEO, run security scans, review code quality — all with different tools.

So I built **Ultraship** — a single Claude Code plugin that does all of it with one command.

### What `/ship` does:

Type `/ship` in Claude Code. 5 tools scan your project in parallel:

- **SEO/GEO/AEO** — 60+ rules. Meta tags, structured data, llms.txt, AI crawler access, canonical URLs, orphan page detection
- **Security** — Secret scanning (AWS, Stripe, GitHub tokens, private keys, DB URLs)
- **Code Quality** — N+1 queries, sync I/O in handlers, memory leaks, unused dependencies (traces import graphs to catch dead wrapper files)
- **Bundle Size** — Build output analysis, heavy dependency detection with lighter alternatives

You get a scorecard. Score >= 80? Ship it.

### But it's not just auditing

Ultraship also enforces structured development:

- **Brainstorming** — asks clarifying questions, proposes approaches, writes a spec before any code
- **Planning** — breaks specs into bite-sized tasks with exact file paths and test commands
- **TDD** — red-green-refactor enforced, not suggested
- **Systematic debugging** — reproduce, isolate, trace, verify. No guessing.
- **Code review** — confidence scoring, severity tagging, test gap analysis

### Dogfooding on a real production app

Ran `/ship` on [SaveMRR](https://savemrr.co) (AI retention platform — Hono + React + Drizzle pnpm monorepo, 5 workspace packages):

- **Backend:** 83/100 READY TO SHIP — found 1 real N+1 in a background job, 9 seed-data loops correctly downgraded to low priority, 1 memory leak
- **Landing page:** 78/100 NEEDS WORK — found 33 unused dependencies (dead shadcn/ui wrappers detected via import graph), 153 SEO issues

It automatically detected the monorepo structure, scanned all workspace packages, and even checked SSL certificates (valid, Let's Encrypt, 84 days until expiry).

### Try it

```bash
# As plugin
claude plugin add ultraship

# Or standalone
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

### Stats

- 22 skills, 20 tools, 17 commands
- 1 dependency (htmlparser2, 30KB)
- 113 unit tests
- Full monorepo support (pnpm, npm, yarn, lerna)
- MIT license, free forever
- No telemetry

GitHub: https://github.com/Houseofmvps/ultraship

Would love feedback from other Claude Code users. What audits would you add?
