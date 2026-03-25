# X (Twitter) Launch Thread

## Tweet 1 (Hook)
I built a Claude Code plugin that replaced 6 tools I was paying for.

22 skills. 20 tools. 5 agents. 1 dependency.

One command tells you if your SaaS is ready to ship.

It's free. Here's the thread:

🧵👇

## Tweet 2 (The Problem)
The problem with AI coding:

Claude jumps straight into code. No spec. No plan. No tests.

You deploy and pray. No SEO check. No secret scan. No performance audit.

I was using 6 different plugins to fix this. None of them talked to each other.

## Tweet 3 (The Solution)
So I built Ultraship.

Type `/ship` in Claude Code.

5 agents run in parallel:
→ SEO/GEO/AEO (60+ rules)
→ Security (secrets, deps, OWASP)
→ Performance (Lighthouse, bundle size)
→ Code Quality (N+1, sync I/O, leaks)
→ Browser testing

You get a scorecard. >= 80? Ship it.

[attach demo.gif]

## Tweet 4 (Auto-fix)
It doesn't just find issues — it FIXES them.

→ Missing meta tags? Added.
→ Security headers? Generated.
→ .env in git? Blocked.
→ Unused 400KB dependency? Flagged.

My first run on houseofmvps.com: 56/100 → 80/100 in two commits.

## Tweet 5 (Workflow)
But /ship is just the end.

Ultraship rewires the ENTIRE workflow:

1. Brainstorming → spec before code
2. Planning → bite-sized tasks
3. TDD → tests before implementation
4. Debugging → systematic, not guessing
5. Code review → N+1s, auth bypasses
6. /ship → pre-deploy gate
7. Deploy → health check

## Tweet 6 (Technical flex)
Technical details for the nerds:

→ 1 dependency (htmlparser2, 30KB)
→ No telemetry, no phone-home
→ SSRF protection on every HTTP tool
→ execFileSync everywhere (no shell injection)
→ 59 unit tests
→ CI on Node 18, 20, 22
→ MIT license

## Tweet 7 (Standalone CLI)
Don't use Claude Code? Try it anyway:

```
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
npx ultraship init
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
