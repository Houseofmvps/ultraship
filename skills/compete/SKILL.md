---
name: compete
description: "Competitive X-Ray — analyze any competitor URL vs your site. Use when user wants to compare their site against a competitor, benchmark performance, or understand competitive positioning."
argument-hint: "<competitor-url>"
allowed-tools: Bash, Read, Grep, Glob
---

# Competitive X-Ray

Know what you're up against. Understand where you win, where you lose, and where the gaps are. This isn't just a technical comparison — it's a strategic assessment.

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
- What the speed difference means for user experience and SEO

**Tech Stack:**
- What each site is built with (framework, hosting, analytics, payments)
- What their tech choices reveal about their stage and priorities
- Overlap and differences

**SEO:**
- Score comparison (out of 10)
- Specific wins/losses (who has better meta tags, OG tags, sitemap, etc.)
- GEO readiness comparison (llms.txt, AI-friendly robots.txt, structured data)
- AEO readiness comparison (FAQPage schema, answer formatting)

**Security:**
- Header comparison
- HTTPS status
- What missing headers reveal about their security posture

### Phase 4: Strategic Analysis

Go beyond raw data. A principal-level competitive analysis answers:

**1. Moat Assessment**
- What is their defensible advantage? (network effects, data, integrations, brand, switching costs)
- What is YOUR defensible advantage?
- Which moat is stronger, and what would it take to erode theirs?

**2. Positioning Gap Analysis**
- What market segment are they targeting? (enterprise, SMB, developer, consumer)
- Is there an underserved segment between you? (e.g., they target enterprise, you target solo founders — is there an SMB gap?)
- Where do they over-serve (features their users don't need) or under-serve (features their users wish they had)?

**3. Pricing & Value Perception**
- If pricing is visible, compare positioning: are they premium or budget? Is there room above, below, or between?
- What does their pricing structure tell you? (per-seat = team play, usage-based = API/developer, flat = SMB simplicity)

**4. Technical Debt Signals**
- Slow response time = legacy stack or unoptimized infrastructure
- Missing security headers = early stage or no security focus
- No structured data = SEO is an afterthought
- Heavy bundle = frontend debt accumulating
- These are exploitable advantages if you're faster, more secure, or more SEO-optimized

**5. Your Advantages** — where you're ahead, how to maintain and widen the lead
**6. Their Advantages** — where they beat you, how to close the gap
**7. Quick Wins** — low-effort improvements that would flip a loss into a win

### Phase 5: Comparison Card

Display the ASCII comparison card from the tool output. This is designed to be screenshot-shareable on Twitter/X.

Suggest the user share it with context like: "Ran a competitive analysis of [my product] vs [competitor]. Here's what the data shows:" — factual, not adversarial.

### Phase 6: Action Items

Create a prioritized action plan:

**This week (quick wins):**
- Technical gaps you can close in hours (add missing headers, optimize images, fix meta tags)
- Low-effort improvements that flip a score

**This month (strategic):**
- Feature or content gaps that require development work
- SEO + AI visibility improvements that compound over time

**This quarter (moat building):**
- Structural advantages to invest in (integrations, community, content library)
- Things that get harder to replicate the earlier you start

## Key Principles

- **Know thy enemy.** This isn't about scores — it's about understanding what a competitor prioritizes and finding your unfair advantage.
- **Compete on strengths, not weaknesses.** Don't try to match every feature — find where you win and amplify it.
- **Data over opinion.** Every recommendation should be backed by the comparison data. No "I feel like you should" — only "the data shows X, so do Y."
- **Share the card.** The comparison card is designed for virality. Factual competitive analysis gets engagement on Twitter.
