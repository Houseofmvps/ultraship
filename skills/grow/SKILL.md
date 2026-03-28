---
name: grow
description: "Post-Ship Growth Intelligence — track how your shipped product is performing. Use when user wants to check growth metrics, SEO trajectory, uptime, deploy frequency, or overall project health over time."
---

# Post-Ship Growth Intelligence

Ultraship doesn't stop at deploy. Track how your product grows after shipping.

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

**Development Velocity:**
- Commits this week vs last week
- Deploy frequency (30-day trend)
- Active development days
- Lines added vs removed (net growth)

**SEO Trajectory:**
- Current SEO/GEO/AEO scores
- Change since last check
- Trend direction (improving/declining/stable)

**Dependency Health:**
- Outdated packages count
- Security vulnerabilities
- Action needed?

**Code Health:**
- Quality score trend
- Improving or declining?

### Phase 3: Growth Insights

Based on the data, provide strategic insights:

1. **What's going well** — metrics that are improving
2. **What needs attention** — metrics that are declining or stagnant
3. **Benchmarks** — how these metrics compare to typical SaaS projects

### Phase 4: SEO Deep Dive (if GSC credentials available)

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs query <site-url> 28
```

Show:
- Top keywords you rank for
- Ranking changes (up/down movers)
- New keywords discovered
- Click-through rates

### Phase 5: Bing Indexing Status (if Bing key available)

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs url-info <site-url> <page-url>
```

Show indexing status across Bing (which also powers ChatGPT Search and DuckDuckGo).

### Phase 6: Action Items

Generate a prioritized list of growth actions:
1. **Quick wins** — things you can do today to improve metrics
2. **This week** — improvements that take a few hours
3. **This month** — strategic investments for long-term growth

### Phase 7: Weekly Digest Format

If the user wants a recurring check, format the output as a weekly digest:

```
📊 Weekly Growth Report — [Project Name]
Week of [date]

Uptime: 99.9% | Avg Response: 230ms (↓15ms)
SEO: 85 (+3) | GEO: 72 (+2) | AEO: 68 (+5)
Commits: 15 | Deploys: 3 | Active Days: 5
Vulnerabilities: 0 critical, 1 high

Top Action: Update 3 outdated dependencies
```

## Key Principle

**What gets measured gets improved.** Most indie builders ship and forget. This skill makes growth visible, trackable, and actionable. Run it weekly.
