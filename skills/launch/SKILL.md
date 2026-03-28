---
name: launch
description: "Launch Day Autopilot — prepare everything for a product launch. Use when user wants to launch, go live, announce, or prepare for Product Hunt / Hacker News / social media launch."
---

# Launch Day Autopilot

One command to prepare your entire launch: copy, checklist, press kit, social media drafts.

## Process

### Phase 1: Analyze Project

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/launch-prep.mjs <project-directory> --url=<production-url>
```

Parse the JSON output for project info, launch copy, checklist, and press kit.

### Phase 2: Launch Checklist

Present the launch checklist with pass/fail/warn status for each item:

**SEO Ready:**
- Meta description, OG tags, favicon, sitemap, robots.txt

**Analytics Ready:**
- Tracking installed, events configured

**Legal Ready:**
- Privacy policy, terms of service

**Technical Ready:**
- No console.logs, no TODOs, error handling, env vars documented

For any FAIL items, fix them immediately using the Edit tool.

### Phase 3: Launch Copy

Present the generated copy for each platform, refined for quality:

**Product Hunt:**
- Tagline (max 60 chars — punchy, clear)
- Description (2-3 sentences — what it does, who it's for, why it's different)
- Maker's first comment (personal, authentic, explains the journey)

**Twitter/X Thread:**
- 5-tweet thread optimized for engagement
- Each tweet stands alone but flows as a narrative
- Includes the production URL

**LinkedIn:**
- Professional announcement post
- Focuses on the problem solved and the journey

**Hacker News:**
- Show HN title and body text
- Technical, honest, no marketing fluff

Review each piece and refine the copy to be:
- Specific (not generic marketing speak)
- Authentic (sounds like a real person, not AI)
- Actionable (clear CTA in each piece)

### Phase 4: Press Kit

Present the press kit components:
- One-liner description
- Elevator pitch (3 sentences)
- Tech highlights
- Key features list

### Phase 5: Pre-Launch Health Check

If a production URL was provided, run a quick health check:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <production-url>
```

Verify the site is up, fast, and SSL is valid before launch.

### Phase 6: Launch Day Timeline

Generate a suggested launch day timeline:
1. **6:00 AM PT** — Submit to Product Hunt (optimal time)
2. **6:15 AM PT** — Post maker's first comment on PH
3. **7:00 AM PT** — Tweet the announcement thread
4. **8:00 AM PT** — Post on LinkedIn
5. **9:00 AM PT** — Submit to Hacker News (Show HN)
6. **12:00 PM PT** — Engage with comments on all platforms
7. **3:00 PM PT** — Share progress update on Twitter
8. **6:00 PM PT** — Thank early users, share metrics
9. **Next day** — Follow up on all platforms, respond to all comments

## Key Principle

**Launch is a performance, not just a deploy.** Every piece of copy, every checklist item, every timing decision matters. This skill ensures nothing is forgotten and every platform gets optimized content.
