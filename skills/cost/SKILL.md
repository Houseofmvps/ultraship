---
name: cost
description: "AI Build Cost Tracker — track how much AI is costing you per feature. Use when user wants to track AI spending, understand cost per feature, optimize AI usage, or budget their Claude/GPT costs."
allowed-tools: Bash, Read, Write, Grep
---

# AI Build Cost Tracker

Know exactly what each feature costs to build with AI. Budget smarter, spend less.

## Process

### Phase 1: Show Current State

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/cost-tracker.mjs <project-directory> show
```

Parse the JSON output for cost history and summary.

### Phase 2: Cost Dashboard

Present spending overview:

**Total Spend:**
- All-time total cost
- This week / this month breakdown
- Average cost per task

**By Task/Feature:**
- Ranked list of features by cost (most expensive first)
- Flag any outliers (tasks costing 3x+ the average)

**By Model:**
- Cost breakdown by AI model used
- Potential savings from model switching

**Daily Trend:**
- Last 30 days of daily spending
- Identify high-spend days

### Phase 3: Cost Insights

Generate actionable insights:

1. **Where money goes** — what types of tasks cost the most (debugging? features? refactoring?)
2. **Optimization opportunities** — tasks that could use a cheaper model
3. **Budget projection** — at current rate, monthly spend estimate
4. **Cost per line of code** — rough estimate based on git diff

### Phase 4: Logging New Costs

To log a new cost entry:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/cost-tracker.mjs <project-directory> log "<label>" <input_tokens> <output_tokens> --model=claude-opus-4-6
```

Labels should be descriptive kebab-case: `auth-feature`, `bug-fix-login`, `refactor-api`, `seo-optimization`

### Phase 5: Recommendations

Based on spending patterns:

**If debugging > 30% of spend:**
- "Consider investing in more tests upfront — debugging is your biggest cost driver"
- Suggest running `/test-driven-development` skill

**If a single task > 3x average:**
- "The [task] cost $X — consider breaking large tasks into smaller chunks"

**Model optimization:**
- "Routine refactoring with Sonnet instead of Opus would save ~$X/month"
- "Code review tasks can use Haiku — potential savings of ~$X/month"

## Logging Guide

Help the user understand when and how to log costs:

- Log at the END of each task/feature (not during)
- Use consistent labels across sessions
- Include ALL tokens (input + output) from the conversation
- Estimate if exact numbers aren't available (Claude Code shows token usage in the UI)

### Phase 6: Build vs. Buy Framework

When reviewing cost data, help the user think about the economics of building with AI:

**Worth building with AI (high ROI):**
- Features that would take 2+ days manually but 2 hours with AI
- Boilerplate-heavy work (CRUD, migrations, test suites, API endpoints)
- Exploration and prototyping (try 3 approaches, keep the best one)

**Consider alternatives:**
- If a feature costs >$100 in AI tokens, check if a library or SaaS already does it
- If debugging the same issue costs >$20 in AI tokens, the root cause is architectural — fix the architecture, not the symptom
- If AI-generated code needs significant manual correction, the prompt needs work, not more tokens

**Cost benchmarks for solo founders:**
| Task Type | Expected Cost | If Higher, Investigate |
|---|---|---|
| New API endpoint | $1-5 | Complex business logic or unclear spec |
| Bug fix | $0.50-3 | Missing tests or hard-to-reproduce issue |
| Full feature (frontend + backend) | $5-20 | Large scope or frequent rework |
| Refactoring | $2-10 | Unclear boundaries or missing tests |
| Content/copy generation | $0.25-1 | Too many revision cycles |

## Key Principles

- **AI is an investment, not a cost.** The goal isn't to minimize spend — it's to maximize ROI. A $50 feature that generates $5K MRR is a great investment. But a $50 bug fix that should have cost $5 with better tests is waste.
- **Track to learn, not to punish.** Cost data reveals where your process is inefficient. High debugging costs mean insufficient tests. High rework costs mean unclear specs.
- **Optimize the expensive tasks, not the cheap ones.** Switching from Opus to Haiku for a $0.10 task saves nothing. Reducing a $50 debugging session by improving test coverage saves real money.
