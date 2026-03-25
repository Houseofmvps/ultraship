# Hacker News Launch

## Title (pick one)
Show HN: Ultraship – One-command pre-deploy quality gate for Claude Code (free, 1 dep)

Show HN: I built a Claude Code plugin with 5 parallel agents that audit your SaaS before deploy

## URL
https://github.com/Houseofmvps/ultraship

## Comment (post immediately after submitting)

Hey HN, I'm the author. Ultraship is a Claude Code plugin that runs 5 parallel agents (SEO, security, performance, code quality, browser testing) and produces a ship-readiness scorecard.

The problem it solves: as a solo founder, I was deploying without checking anything. I'd forget meta tags, leave placeholder API keys in .env, ship 4s LCP pages, and discover leaked secrets from Stripe emails.

I tried using separate tools for each — 6 different Claude Code plugins. They didn't coordinate, and configuring them was slower than the actual coding.

So I built one plugin that does everything. Type `/ship`, get a scorecard.

Technical decisions:
- 1 runtime dependency (htmlparser2, 30KB SAX parser). I wanted zero supply chain surface area.
- All subprocess calls use execFileSync with array args — no shell injection possible.
- SSRF protection on every HTTP tool. Private IPs, cloud metadata endpoints, and non-HTTP schemes are blocked.
- 108 unit tests running on Node 18, 20, 22.
- No telemetry. No analytics. No phone-home.

It also works standalone via npx:
```
npx ultraship ship .
npx ultraship seo .
npx ultraship security .
```

Free, MIT licensed. I don't plan to add a paid tier — this is my portfolio piece as a solo founder.

Happy to answer any questions about the architecture or the Claude Code plugin system.
