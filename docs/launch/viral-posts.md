# Ultraship Viral Launch Posts

Copy-paste ready. Attach `assets/demo.gif` wherever noted.

---

## X (Twitter) — Main Launch Thread

### Tweet 1 (THE HOOK — this is the only tweet that matters)

I mass-deleted 6 Claude Code plugins yesterday.

Replaced all of them with one command:

`/ship`

[attach demo.gif]

### Tweet 2

Here's what that one command does:

→ 5 AI agents launch in parallel
→ 60+ rules scan your entire project
→ SEO, security, performance, code quality, browser testing
→ Auto-fixes 10-15 issues per run
→ Gives you a scorecard

Score ≥ 80? Ship it.
Score < 80? It tells you exactly what to fix.

### Tweet 3

My first run on my own site:

Before: 56/100 ❌
After: 80/100 ✅

Two commits. That's it.

What it found:
- CORS set to wildcard (security hole)
- 400KB unused dependency (recharts)
- Missing OG tags (broken social previews)
- API leaking error stack traces
- 4.2s LCP (Google was de-ranking me)

I'd been shipping all of this to production for months.

### Tweet 4

But /ship is just the exit.

The real magic is how it rewires your ENTIRE Claude Code workflow:

You say "build me a pricing page"

Old Claude: immediately writes 400 lines of wrong code

Ultraship Claude:
1. Asks you 5 clarifying questions
2. Proposes 3 approaches with trade-offs
3. You approve a spec
4. Breaks it into 2-5 min tasks
5. Writes failing test first
6. Implements minimum to pass
7. Reviews its own code
8. /ship before deploy

### Tweet 5

The part that makes engineers trust it:

- 1 dependency (htmlparser2, 30KB)
- No telemetry. Zero. None. Ever.
- 59 unit tests
- execFileSync everywhere (no shell injection)
- SSRF protection on every HTTP tool
- MIT license

I have more security protections than most enterprise SaaS tools.

And it's free.

### Tweet 6

Don't use Claude Code? Try it right now:

```
npx ultraship ship .
```

That's it. No install. No config. No account.

Run it on your project. I dare you.

### Tweet 7

```
claude plugin add ultraship
```

or

```
npx ultraship ship .
```

Star it if it saves you time:
github.com/Houseofmvps/ultraship

Free forever. Built solo by me.

RT tweet 1 if you think every developer needs this.

---

## X (Twitter) — Alternate Bangers (standalone tweets, post throughout launch week)

### Banger 1 (controversial)

Hot take: if you're using Claude Code without a pre-deploy quality gate, you're shipping bugs to production with extra confidence.

I built the quality gate. It's free.

`npx ultraship ship .`

### Banger 2 (specific pain)

"My OG tags are broken"
"My .env is in git"
"My LCP is 4 seconds"
"I have a CORS wildcard"
"recharts is 400KB and I don't use it"

I found ALL of these on my own production site.

One command found them all:

`/ship`

### Banger 3 (before/after)

6 plugins before:
- $0 but 6 configs
- None of them talk to each other
- 3 different hooks fighting
- Context window bloated

1 plugin after:
- 22 skills, 20 tools, 5 agents
- 1 dependency
- 0 configs
- One command: /ship

### Banger 4 (the dare)

Run this on your project right now:

```
npx ultraship security .
```

If it finds zero issues, I'll mass-delete this tweet.

(It won't find zero issues.)

### Banger 5 (GEO angle — niche but high-value audience)

Your site is invisible to ChatGPT.

No llms.txt. No AI-friendly robots.txt. No question-format headings. No structured data.

Google is not the only search engine anymore.

`npx ultraship seo .` checks 60+ rules including GEO (Generative Engine Optimization).

It also generates the missing files for you.

---

## Reddit — r/ClaudeAI

### Title
I replaced 6 Claude Code plugins with one `/ship` command — here's what it does

### Body

I build SaaS products solo. My Claude Code setup was a mess — 6 different plugins for workflow, code review, SEO, security, performance, and browser testing. None of them coordinated. Three hooks fighting each other. Context window bloated before I wrote a single prompt.

So I spent a month building one plugin that does everything.

**The main feature:** Type `/ship` in Claude Code. Five agents run in parallel and produce a scorecard:

```
╔══════════════════════════════════════════╗
║      U L T R A S H I P   S C O R E      ║
╠══════════════════════════════════════════╣
║  SEO/GEO/AEO    92/100  ████████████░   ║
║  Security        95/100  ████████████░   ║
║  Code Quality    88/100  ███████████░░   ║
║  Performance     87/100  ██████████░░░   ║
║  Browser Test    PASS    █████████████   ║
╠══════════════════════════════════════════╣
║   OVERALL         90/100                 ║
║   STATUS          ✅ READY TO SHIP       ║
╚══════════════════════════════════════════╝
```

Score ≥ 80? Ship it. Below 80? Fix the items and run again.

**What it actually found on my own site (houseofmvps.com):**
- CORS wildcard (anyone could call my API)
- 400KB unused dependency sitting in the bundle
- Missing OG tags (my tweets showed broken previews for months)
- API returning full error stack traces to the browser
- Lighthouse LCP of 4.2 seconds

First run: 56/100. Two commits later: 80/100.

**But /ship is just the end of the workflow.** Before that, Ultraship also enforces:
- Brainstorming with spec approval before any code
- Bite-sized planning (every task is 2-5 minutes)
- TDD (red-green-refactor enforced, not suggested)
- Systematic debugging (no guessing)
- Code review with confidence scoring

**Technical details for those who care:**
- 1 runtime dependency (htmlparser2, 30KB)
- 59 unit tests on Node 18/20/22
- No telemetry, no analytics, no phone-home
- execFileSync everywhere (no shell injection possible)
- SSRF protection on all HTTP tools
- MIT license, free forever

**Try without installing as a plugin:**
```
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

**Install as plugin:**
```
claude plugin add ultraship
```

GitHub: https://github.com/Houseofmvps/ultraship

What would you add to the scorecard? Genuinely looking for ideas.

---

## Reddit — r/SideProject

### Title
My pre-deploy checklist was 23 items. I automated all of them into one command.

### Body

Every time I deployed my SaaS, I'd open the same Google Doc with 23 checkboxes. Meta tags? OG image? .env not in git? Lighthouse score? Security headers? I'd skip half of them because I was excited to ship.

Then I'd find out my OG tags were broken when someone shared my link on Twitter. Or Stripe would email me about a leaked key. Or Google would de-rank me because my LCP was 4 seconds.

So I turned the checklist into a command:

```
npx ultraship ship .
```

It runs 5 audits in parallel (SEO, security, performance, code quality, browser) and gives you a scorecard. If you're above 80, ship. If not, it tells you exactly what to fix.

I ran it on my own site and went from 56/100 to 80/100 in two commits. Found things I'd been shipping to production for months.

Works as a Claude Code plugin (`claude plugin add ultraship`) or standalone in any terminal.

Free, open source, 1 dependency, 59 tests, no telemetry.

GitHub: https://github.com/Houseofmvps/ultraship

Honest question: what's on YOUR pre-deploy checklist that this misses?

---

## Reddit — r/webdev

### Title
I built an open-source CLI that runs 60+ SEO/security/perf rules on your project and auto-fixes what it can

### Body

Not another SaaS. Just a CLI tool.

```
npx ultraship ship .
```

Runs 5 audits in parallel:

1. **SEO/GEO/AEO** (60+ rules) — meta tags, canonical URLs, heading hierarchy, alt text, structured data, llms.txt, AI-friendly robots.txt, question-format headings for ChatGPT/Perplexity extraction
2. **Security** — secret scanning (AWS keys, Stripe keys, GitHub tokens, private keys, DB URLs), OWASP patterns, HTTP headers
3. **Code Quality** — N+1 queries, sync I/O in request handlers, unbounded queries, memory leaks, sequential awaits
4. **Performance** — bundle size, heavy dependency detection (moment→dayjs, lodash→native), build output analysis
5. **Environment** — .env.example vs actual .env comparison, missing/empty/placeholder detection

Outputs a scorecard with scores per category.

Also works as a Claude Code plugin with 22 skills for brainstorming, TDD, debugging, code review, etc.

**Tech:**
- 1 dependency (htmlparser2)
- Node.js ESM, no build step
- 59 tests
- No telemetry
- MIT

Individual commands:
```
npx ultraship seo .
npx ultraship security .
npx ultraship profile .
npx ultraship deps .
npx ultraship init          # scaffolds CLAUDE.md
```

GitHub: https://github.com/Houseofmvps/ultraship

Built this because I kept shipping broken OG tags and leaked secrets. Would love feedback.

---

## Reddit — r/IndieHackers (or Indie Hackers platform)

### Title
I shipped with CORS wildcards, leaked secrets, and broken OG tags for 6 months. Then I built a tool to catch all of it.

### Body

I'm a solo founder. I was deploying my SaaS every day and feeling productive. Then I realized:

- My CORS was set to `*` (anyone could call my API)
- My bundle was 2.3MB because recharts (400KB) was still imported and I'd removed the chart component 3 months ago
- My Twitter cards were broken (missing OG tags) — every share for 6 months showed a blank preview
- My API was returning full stack traces on errors (hello, hackers)
- My LCP was 4.2 seconds (Google was silently de-ranking me)

I only found out because I built a tool to check:

```
npx ultraship ship .
```

One command. Scored me 56/100. Fixed everything in two commits. Scored 80/100.

Now I run it before every deploy. It's my quality gate.

It's free, open source, and works without any setup: https://github.com/Houseofmvps/ultraship

What's the dumbest thing you shipped to production without catching?

---

## LinkedIn

### Hook Post (short, algorithm-friendly)

I mass-deleted 6 developer tools yesterday.

Replaced them all with one command.

Here's what happened:

I'm a solo founder building SaaS products.

My pre-deploy workflow was chaos:
→ 6 different audit tools
→ None coordinated
→ Half the checks skipped because I was excited to ship

So I built Ultraship.

One command: /ship

5 AI agents run in parallel.
60+ rules scan your project.
You get a scorecard.

First run on my own site: 56/100.

It found:
- CORS wildcards
- 400KB unused dependency
- Missing OG tags (6 months of broken Twitter previews)
- API leaking error stack traces
- 4.2s load time

Two commits later: 80/100.

The tool is free. Open source. No telemetry. 1 dependency.

Try it: npx ultraship ship .

GitHub: github.com/Houseofmvps/ultraship

If you ship software, you need a quality gate.
This is mine.

#buildinpublic #opensource #indiehacker #devtools #saas #claudecode

---

## Hacker News

### Title
Show HN: Ultraship – Pre-deploy quality gate that runs 5 parallel audits (1 dep, 59 tests, 0 telemetry)

### URL
https://github.com/Houseofmvps/ultraship

### First Comment (post within 30 seconds of submission)

Author here. I'm a solo SaaS founder who was deploying without checking anything.

I built Ultraship because I found — on my own production site — CORS wildcards, a 400KB unused dependency, missing OG tags, leaked error stack traces, and a 4.2s LCP. All at the same time. All things I'd been shipping for months.

`npx ultraship ship .` runs 5 audits in parallel and produces a scorecard. Works standalone or as a Claude Code plugin.

**Architecture decisions I'm happy to discuss:**

1. **1 dependency** (htmlparser2, 30KB SAX parser). I went back and forth on this — considered zero deps with a custom parser, but htmlparser2 is battle-tested and small. Everything else is Node.js stdlib.

2. **execFileSync with array args everywhere.** No `exec()`, no template strings touching shell. Subprocess calls are the #1 injection vector in Node.js CLI tools and I wanted zero surface area.

3. **SSRF protection as a shared module.** Every HTTP-making tool imports `tools/lib/security.mjs` which blocks private IPs (127.x, 10.x, 172.16.x, 192.168.x, 169.254.x), cloud metadata endpoints, and non-HTTP schemes. This was non-negotiable since the SEO scanner, health checker, and redirect checker all fetch user-provided URLs.

4. **Tools output JSON to stdout, errors exit 0.** This seems wrong, but Claude Code treats non-zero exits as tool failures and retries. Every tool is designed to gracefully handle empty/missing inputs and report findings, not crash.

5. **No Lighthouse in CLI mode.** The Claude Code plugin runs Lighthouse via headless Chrome, but the standalone CLI can't assume Chrome is installed. CLI scorecard uses bundle analysis + env validation for the performance dimension instead.

6. **59 tests with node:test.** No test framework dependency. Tests run on Node 18, 20, 22 in CI.

7. **Skills are markdown files.** Zero runtime cost. They only load when Claude Code invokes the Skill tool. The SessionStart hook is a 15-line bash script that checks CLAUDE.md freshness — adds ~100ms on conversation start and nothing after.

Happy to go deep on any of these. Also interested in what audits people would add — the architecture makes it trivial to drop in a new `tools/<name>.mjs` that reads a directory, outputs JSON findings.

---

## Instagram — Carousel Post (10 slides)

### Slide 1 (HOOK — bold text on dark background)
I deleted 6 developer tools
and replaced them with
ONE COMMAND

### Slide 2
The problem:

You build with AI.
You deploy and pray.

No SEO check.
No security scan.
No performance audit.

You find out something's broken
when a user tells you.

### Slide 3
What I was shipping to production
WITHOUT KNOWING:

❌ CORS wildcard (anyone could call my API)
❌ 400KB unused dependency
❌ Broken Twitter card previews (6 months!)
❌ API leaking full error stack traces
❌ 4.2 second page load time

### Slide 4
One command found ALL of this:

/ship

### Slide 5
[screenshot of the scorecard terminal output]

5 AI agents run in parallel
60+ rules
Auto-fixes what it can

### Slide 6
Before: 56/100 ❌
After: 80/100 ✅

Two commits. That's it.

### Slide 7
But /ship is just the exit.

It also rewires HOW you build:

✅ Brainstorm before code
✅ Plan before implementation
✅ Test before features
✅ Debug systematically
✅ Review before merge
✅ Audit before deploy

### Slide 8
The stats:

22 skills
20 tools
5 agents
1 dependency
59 tests
0 telemetry
FREE forever

### Slide 9
Try it RIGHT NOW:

npx ultraship ship .

No install. No config. No account.
Run it on your project.

### Slide 10 (CTA)
Star on GitHub:
github.com/Houseofmvps/ultraship

Built solo by @kaileskkhumar

Save this post. You'll need it.

---

## Product Hunt — Tagline + Description

### Tagline
One command tells you if your SaaS is ready to ship

### Description
Ultraship is a free, open-source pre-deploy quality gate. Type /ship in Claude Code (or run `npx ultraship ship .` anywhere) and 5 agents audit your project in parallel — SEO, security, performance, code quality, and browser testing. You get a scorecard. Score ≥ 80? Ship it.

### First Comment
Maker here! I built Ultraship because I was deploying my SaaS products without checking anything. I found CORS wildcards, leaked secrets, broken OG tags, and a 4.2s LCP — all on my own production site.

Now I run `/ship` before every deploy. It's my quality gate.

22 skills, 20 tools, 5 agents, 1 dependency, 59 tests, MIT license.

Would love your feedback on what audits to add next.

---

## Launch Timing Strategy

| Platform | Best time | Day |
|---|---|---|
| Hacker News | 8-9 AM ET (weekday) | Tuesday or Wednesday |
| Reddit r/ClaudeAI | 10 AM ET | Any weekday |
| Reddit r/SideProject | 10 AM ET | Monday or Tuesday |
| Reddit r/webdev | 10 AM ET | Tuesday |
| X/Twitter | 8 AM ET (thread), bangers throughout week | Tuesday launch, bangers Wed-Fri |
| LinkedIn | 8 AM ET | Tuesday or Wednesday |
| Product Hunt | 12:01 AM PT | Thursday |
| Instagram | 11 AM ET | Wednesday or Thursday |

**Launch order:**
1. HN + Reddit r/ClaudeAI (same morning — these are your core audience)
2. X thread (same morning, 30 min after)
3. LinkedIn (same morning, 1 hour after)
4. Reddit r/SideProject + r/webdev (next day)
5. Instagram carousel (day 3)
6. Product Hunt (day 4-5, after you have some stars/downloads to show)
7. X bangers (spread throughout the week after launch)

**Critical:** Reply to EVERY comment in the first 2 hours. HN and Reddit algorithms heavily weight early engagement.
