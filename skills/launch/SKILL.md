---
name: launch
description: "Launch Day Autopilot — prepare everything for a product launch. Use when user wants to launch, go live, announce, or prepare for Product Hunt / Hacker News / social media launch."
---

# Launch Day Autopilot

A launch is not a deploy. A deploy puts code on a server. A launch puts a product in front of people who need it, at the right time, with the right message, on the right channels. This skill treats launch as a coordinated campaign, not a checkbox.

## Process

### Phase 1: Analyze Project

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/launch-prep.mjs <project-directory> --url=<production-url>
```

Parse the JSON output for project info, launch copy, checklist, and press kit.

### Phase 2: Audience & Positioning

Before writing a single word of copy, nail the positioning:

**Who is this for?**
- Define the target user in one sentence (e.g., "Solo SaaS founders with $5K-50K MRR who are losing customers to churn")
- What is their current pain? What do they do today without this product?
- What is the single most compelling thing this product does for them?

**Positioning statement:**
> For [target user] who [pain point], [product] is a [category] that [key benefit]. Unlike [alternatives], it [differentiator].

This positioning statement drives ALL copy below. Every piece of content should map back to it.

**Competitive angle:**
- What exists today that partially solves this? Why is it insufficient?
- What is the "wedge" — the one thing that makes someone try this instead? Lead with that.

### Phase 3: Launch Checklist

Present the launch checklist with pass/fail/warn status:

**Product Ready:**
- Landing page live and fast (Lighthouse 90+)
- Signup/onboarding flow tested end-to-end
- Pricing page clear with CTA
- No console.logs, TODOs, or placeholder text visible
- Error states handled (404, 500, empty states)

**SEO + AI visibility Ready:**
- Meta description, OG tags, favicon, sitemap, robots.txt
- `llms.txt` for AI discoverability
- Structured data (JSON-LD) on key pages
- AI-friendly robots.txt (GPTBot, PerplexityBot allowed)

**Analytics Ready:**
- Event tracking on signup, activation, and payment
- UTM parameters working for campaign attribution
- Goal/conversion tracking configured

**Legal Ready:**
- Privacy policy and terms of service linked in footer
- Cookie consent if serving EU users
- GDPR/data deletion path documented

**Social Proof Ready:**
- At least one testimonial, beta user quote, or dogfood result
- GitHub stars, npm downloads, or other traction signal visible
- Author/founder bio with credibility signals

For any FAIL items, fix them immediately.

### Phase 4: Launch Copy — Platform by Platform

**Product Hunt:**
- **Tagline** (max 60 chars): Punchy, specific, no buzzwords. Lead with what it does, not what it is.
  - Bad: "AI-powered productivity platform"
  - Good: "Find which customers are about to churn before they cancel"
- **Description** (2-3 sentences): Problem → solution → proof. Include a number (users, rules, time saved).
- **Maker's first comment**: Personal, authentic. Why you built this. What surprised you. What's next. End with a question to drive comments.
- **Gallery images** (5-6): Hero screenshot, key feature 1-3, before/after or comparison, social proof. Each image should stand alone and tell a story.

**Twitter/X Thread (5-7 tweets):**
- Tweet 1: Hook — state the problem in a way your target user feels. No "I'm excited to announce." Start with the pain.
- Tweet 2: The aha moment — what you realized that led to building this.
- Tweet 3-4: Show, don't tell — screenshot, GIF, or concrete example of the product working.
- Tweet 5: Social proof — beta results, dogfood data, a specific number.
- Tweet 6: The ask — try it (link), star it, share it. One clear CTA.
- Tweet 7: Bonus — what's coming next. Creates anticipation for followers.

**LinkedIn Post:**
- Professional tone but not corporate. Focus on the journey and the problem space.
- Lead with insight about the industry, not about your product.
- Include 3-5 hashtags (industry-specific, not generic).
- End with a question that invites comments.

**Hacker News (Show HN):**
- Title: "Show HN: [Product] – [What it does in plain English]"
- Body: Technical, honest, no marketing. Explain: What it does. Why you built it. How it works technically. What's interesting about the implementation. What you learned. Link to demo/repo.
- HN values: technical depth, honesty about limitations, open source, responding to every comment.

### Phase 5: Community Seeding Strategy

Launching on platforms is necessary but not sufficient. The products that break through have community presence before launch day:

**Pre-launch (1-2 weeks before):**
- Post in 3-5 relevant communities about the problem you're solving (not your product)
- Share a "building in public" update showing progress
- DM 10-20 people in your target audience for early feedback
- Ask 5 people to be ready to upvote/comment on launch day

**Launch day amplification:**
- Ask every early user to share on their preferred platform
- Cross-post between platforms (PH post links to Twitter thread, Twitter links to HN)
- Respond to every comment within 1 hour — engagement velocity matters for algorithms
- Share real-time metrics updates ("50 signups in the first 2 hours") — progress updates drive curiosity

**Post-launch (3-7 days after):**
- Follow up with everyone who signed up but didn't activate
- Publish a "launch retrospective" blog post with real numbers
- Submit to newsletters and curated lists in your niche
- Update the product based on launch day feedback and announce the updates

### Phase 6: Press Kit

Present the press kit components:
- One-liner description (from positioning statement)
- Elevator pitch (3 sentences: problem, solution, proof)
- Tech highlights (for technical publications)
- Key features list (5-7 bullet points, benefit-led)
- Founder bio with relevant credentials
- High-res logo and screenshot assets

### Phase 7: Pre-Launch Health Check

If a production URL was provided:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Verify the site is up, fast, and SSL is valid. Run `/seo` to ensure all SEO + AI visibility signals are in place. Nothing worse than going viral with a broken OG image or a 4-second LCP.

### Phase 8: Launch Day Timeline

Generate a suggested launch day timeline (all times in user's timezone):

| Time | Action | Why |
|---|---|---|
| **6:00 AM PT** | Submit to Product Hunt | Optimal for full-day upvote accumulation |
| **6:15 AM PT** | Post maker's first comment on PH | Sets the tone, shows you're responsive |
| **7:00 AM PT** | Tweet the announcement thread | Catches morning scrollers |
| **7:30 AM PT** | Post in 2-3 Slack/Discord communities | Warm audiences convert best |
| **8:00 AM PT** | Post on LinkedIn | Professional audience online |
| **9:00 AM PT** | Submit to Hacker News (Show HN) | HN peaks mid-morning ET |
| **12:00 PM PT** | Engage with all platform comments | Engagement velocity signals quality |
| **3:00 PM PT** | Share progress update with real numbers | Social proof drives late-day interest |
| **6:00 PM PT** | Thank early users, share key metrics | Gratitude posts perform well |
| **Next day** | Follow up everywhere, respond to all comments | Sustained engagement > launch-day spike |

## Key Principles

- **Launch is a performance, not a deploy.** Every piece of copy, every checklist item, every timing decision matters.
- **Specificity beats superlatives.** "63 SEO rules" beats "comprehensive SEO." "Catches N+1 queries" beats "improves performance."
- **Show, don't tell.** Screenshots, GIFs, and real data outperform description text.
- **The launch week matters more than launch day.** Sustained follow-up converts more than a single spike.
