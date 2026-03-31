---
name: retro
description: Sprint retrospective — analyzes git velocity, commit patterns, test health, and shipping cadence. Use after a sprint, at the end of the week, or when the user wants to reflect on progress.
---

# Sprint Retrospective

Retrospectives turn shipping data into actionable insights. This skill analyzes your git history, commit patterns, test health, and shipping velocity to surface what's working and what needs attention.

**Announce at start:** "I'm running a sprint retrospective on this project."

## Process

### Step 1: Gather Data

Run the retro analyzer:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/retro-analyzer.mjs <project-directory> --days 7
```

For custom date ranges:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/retro-analyzer.mjs <project-directory> --since 2026-03-24
```

### Step 2: Present the Retrospective

Format the data as a clear, actionable report:

#### Velocity Report Card

```
+===========================================+
|     S P R I N T   R E T R O              |
+===========================================+
|  Period        Mar 24 – Mar 31           |
|  Commits       47                         |
|  Lines Added   2,341                      |
|  Lines Removed 892                        |
|  Net Change    +1,449                     |
|  Authors       1                          |
+===========================================+
```

#### Commit Breakdown

Show the distribution of commit types (features, fixes, refactors, tests, docs, chores) as a visual breakdown. Highlight the feature-to-fix ratio — a healthy project ships more features than fixes.

#### Hot Files

List the most-changed files. Files with excessive churn may need to be split into smaller modules.

#### Test Health

- Number of test files
- Passing / failing tests
- Whether a test script exists
- Recommendation if tests are absent or failing

#### Shipping Cadence

- Peak day of week (when do you ship most?)
- Peak hour (when are you most productive?)
- Tags/releases in this period

### Step 3: Insights & Recommendations

Based on the data, surface:

**What went well:**
- High velocity periods
- Good deletion-to-addition ratio (code hygiene)
- Consistent shipping cadence
- Test coverage improvements

**What needs attention:**
- Fix-heavy sprints (more fixes than features = quality debt)
- Hot files that churn excessively
- Missing or failing tests
- Uneven shipping cadence (feast-or-famine pattern)

**Action items:**
- Concrete, specific recommendations with clear next steps
- Link to relevant Ultraship skills (e.g., "Use `/tdd` for the untested module")

### Step 4: Cross-Reference with Learnings (Optional)

If the project has learnings (from `/learn`), search for relevant context:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/learnings-manager.mjs search --query "sprint"
node ${CLAUDE_PLUGIN_ROOT}/tools/learnings-manager.mjs search --query "debugging"
```

Incorporate past learnings into recommendations.

## Multi-Project Mode

For founders running multiple projects, run retros across all of them:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/retro-analyzer.mjs ~/project-a --days 7
node ${CLAUDE_PLUGIN_ROOT}/tools/retro-analyzer.mjs ~/project-b --days 7
```

Compare velocity across projects to understand where time is being spent.

## Output

The retrospective should be concise and actionable — not a data dump. Lead with insights, support with data. The goal is to help the user ship better next week.
