---
name: compete
description: "Competitive X-Ray — analyze any competitor URL vs your site. Use when user wants to compare their site against a competitor, benchmark performance, or understand competitive positioning."
---

# Competitive X-Ray

Point at any competitor and get a full comparison: tech stack, performance, SEO, security. Output includes a shareable comparison card.

## Process

### Phase 1: Gather URLs

Ask the user for:
1. **Your site URL** (production URL)
2. **Competitor URL** (the site to compare against)

If the user provided both URLs already, skip asking.

### Phase 2: Run Analysis

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/compete-analyzer.mjs <your-url> <competitor-url>
```

Parse the JSON output.

### Phase 3: Present Comparison

Present results in a clear head-to-head format:

**Performance:**
- Response time comparison (who's faster, by how much)
- Content size comparison

**Tech Stack:**
- What each site is built with (framework, hosting, analytics, payments)
- Overlap and differences

**SEO:**
- Score comparison (out of 10)
- Specific wins/losses (who has better meta tags, OG tags, sitemap, etc.)

**Security:**
- Header comparison
- HTTPS status

### Phase 4: Strategic Analysis

Based on the raw data, provide actionable insights:

1. **Your advantages** — where you're ahead, how to maintain the lead
2. **Competitor advantages** — where they beat you, how to close the gap
3. **Quick wins** — low-effort improvements that would flip a loss into a win
4. **Tech insights** — what their tech choices reveal about their priorities

### Phase 5: Comparison Card

Display the ASCII comparison card from the tool output. This is designed to be screenshot-shareable on Twitter/X.

### Phase 6: Action Items

Create a prioritized list of improvements based on the comparison:
1. Critical gaps (competitor has it, you don't)
2. Easy wins (small changes for big improvement)
3. Strategic investments (longer-term improvements)

## Key Principle

**Know thy enemy.** This isn't just about scores — it's about understanding what a competitor prioritizes and finding your unfair advantage.
