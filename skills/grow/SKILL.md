---
name: grow
description: "Post-Ship Growth Intelligence — track how your shipped product is performing. Use when user wants to check growth metrics, SEO trajectory, uptime, deploy frequency, or overall project health over time."
argument-hint: "<production-url>"
allowed-tools: Bash, Read, Grep, Glob
---

# Post-Ship Growth Intelligence

Most indie builders ship and forget. The ones who win ship and measure. This skill makes growth visible, trackable, and actionable — like having a growth-stage CTO and a marketing analyst looking at your dashboards every week.

## Process

### Phase 1: Collect Metrics

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/growth-tracker.mjs <project-directory> --url=<production-url> --save
```

Parse the JSON output for current snapshot and historical trends.

### Phase 2: Growth Dashboard

Present a clear growth report:

**Uptime & Performance:**
- Current status (up/down/degraded)
- Response time trend (faster? slower?)
- Compare to previous snapshot
- Context: response time under 500ms is good, under 200ms is excellent, over 1s is a problem

**Development Velocity:**
- Commits this week vs last week
- Deploy frequency (30-day trend)
- Active development days
- Lines added vs removed (net growth)
- Context: healthy velocity for a solo founder is 3-5 deploys/week. Less than 1 deploy/week means either the project is stable or stalling — check which.

**SEO + AI visibility Trajectory:**
- Current SEO + AI visibility scores
- Change since last check
- Trend direction (improving/declining/stable)
- Context: SEO score above 80 is solid, GEO above 70 means AI search engines can find and cite you, below 50 means you're invisible to AI search

**Dependency Health:**
- Outdated packages count
- Security vulnerabilities
- Action needed?

**Code Health:**
- Quality score trend
- Improving or declining?

### Phase 3: Growth Insights

Based on the data, provide strategic insights — not just metrics, but what they mean:

**1. What's going well** — metrics that are improving
**2. What needs attention** — metrics that are declining or stagnant
**3. Benchmarks** — how these metrics compare to typical indie SaaS projects:

| Metric | Below Average | Average | Good | Excellent |
|---|---|---|---|---|
| Response time | >1s | 500ms-1s | 200-500ms | <200ms |
| Deploy frequency | <1/week | 1-2/week | 3-5/week | Daily |
| SEO score | <50 | 50-70 | 70-85 | 85+ |
| GEO score | <40 | 40-60 | 60-80 | 80+ |
| Vulnerabilities | >5 high | 1-5 high | 0 high | 0 total |

**4. The "One Thing" recommendation** — if you could only do one thing this week to improve growth, what is it? Prioritize ruthlessly. Solo founders don't have time for 15 action items.

### Phase 4: SEO Deep Dive (if GSC credentials available)

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs query <site-url> 28
```

Show:
- Top keywords you rank for
- Ranking changes (up/down movers)
- New keywords discovered
- Click-through rates
- **Strategic analysis**: Which keywords are worth doubling down on? Which are vanity metrics?

**Content gap identification:**
- Keywords you rank 5-20 for (striking distance — could reach page 1 with targeted content)
- Keywords competitors rank for that you don't (use with `/compete` data)
- Long-tail keywords with low competition but high intent

### Phase 5: Bing Indexing Status (if Bing key available)

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs url-info <site-url> <page-url>
```

Show indexing status across Bing (which also powers ChatGPT Search and DuckDuckGo).

**Why this matters for AI search:** If Bing hasn't indexed your pages, ChatGPT Search can't find you. Submit your sitemap to Bing and verify key pages are indexed.

### Phase 6: Growth Strategy by Stage

Tailor recommendations to where the product is:

**Pre-launch (0 users):**
- Focus: landing page SEO, GEO readiness, community building
- Key metric: email signups, waitlist size
- Action: build in public, share progress, collect early feedback

**Post-launch (1-100 users):**
- Focus: activation rate, first-week retention, user feedback loops
- Key metric: signup → activation conversion rate
- Action: talk to every user, fix the top 3 onboarding friction points

**Growth (100-1000 users):**
- Focus: organic acquisition, content marketing, SEO compounding
- Key metric: organic traffic growth rate, MRR
- Action: publish 2-4 SEO-optimized articles/month, build referral loops

**Scale (1000+ users):**
- Focus: retention, expansion revenue, operational efficiency
- Key metric: net revenue retention, churn rate, LTV/CAC
- Action: automate onboarding, build self-serve, reduce support load

### Phase 7: Action Items

Generate a prioritized list:
1. **Quick wins** — things you can do today (15 min or less)
2. **This week** — improvements that take a few hours
3. **This month** — strategic investments for long-term growth

### Phase 8: Weekly Digest Format

If the user wants a recurring check, format as a weekly digest:

```
Weekly Growth Report — [Project Name]
Week of [date]

Uptime: 99.9% | Avg Response: 230ms (-15ms)
SEO: 85 (+3) | GEO: 72 (+2) | AEO: 68 (+5)
Commits: 15 | Deploys: 3 | Active Days: 5
Vulnerabilities: 0 critical, 1 high

Top Action: Update 3 outdated dependencies

Trend: Improving (3 consecutive weeks of SEO gains)
```

## Key Principles

- **What gets measured gets improved.** Run this weekly. Growth is invisible without data.
- **One thing at a time.** Solo founders can't do 15 things. Recommend the highest-impact single action.
- **Compounding beats spikes.** A 2% weekly improvement in SEO score compounds to 180% over a year. Consistency wins.
- **GEO is the new SEO.** In 2026, AI search visibility is as important as Google ranking. Track both.
