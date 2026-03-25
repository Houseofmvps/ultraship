# Reddit r/ClaudeAI Post

## Title
I built a Claude Code plugin that runs 5 agents in parallel to tell you if your SaaS is ready to ship

## Body

I'm a solo founder building SaaS products. Every time I shipped, I'd manually check SEO, run security scans, test performance, review code quality — all with different tools.

So I built **Ultraship** — a single Claude Code plugin that does all of it with one command.

### What `/ship` does:

Type `/ship` in Claude Code. 5 agents run in parallel:

- **SEO/GEO/AEO** — 60+ rules. Meta tags, structured data, llms.txt, AI crawler access, canonical URLs
- **Security** — Secret scanning, dependency audit, OWASP patterns, HTTP headers
- **Performance** — Lighthouse via headless Chrome, bundle size, heavy dep detection
- **Code Quality** — N+1 queries, sync I/O in handlers, memory leaks, unused deps
- **Browser** — Automated smoke tests on your running app

You get a scorecard. Score >= 80? Ship it.

### But it's not just auditing

Ultraship also enforces structured development:

- **Brainstorming** — asks clarifying questions, proposes approaches, writes a spec before any code
- **Planning** — breaks specs into bite-sized tasks with exact file paths and test commands
- **TDD** — red-green-refactor enforced, not suggested
- **Systematic debugging** — reproduce, isolate, trace, verify. No guessing.
- **Code review** — confidence scoring, severity tagging, test gap analysis

### Dogfooding

First `/ship` on my own site (houseofmvps.com): **56/100 → 80/100** in two commits. It found CORS wildcards, unused 400KB deps, missing OG tags, error leakage, and Lighthouse blockers.

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

- 22 skills, 20 tools, 5 agents, 17 commands
- 1 dependency (htmlparser2)
- 108 unit tests
- MIT license, free forever
- No telemetry

GitHub: https://github.com/Houseofmvps/ultraship

Would love feedback from other Claude Code users. What audits would you add?
