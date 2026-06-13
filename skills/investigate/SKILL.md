---
name: investigate
description: Root cause investigation — structured debugging with module freeze. No fixes without investigation. Use when encountering any bug, error, or unexpected behavior.
argument-hint: "<error-or-symptom-description>"
disallowed-tools: Edit, Write, NotebookEdit
---

# Investigate — Root Cause Analysis

Investigation is the discipline of understanding a problem before fixing it. This skill enforces a strict protocol: **no fixes until the root cause is found.**

> **Enforced:** while this skill is active, `Edit`, `Write`, and `NotebookEdit` are removed via `disallowed-tools`. The no-fixes rule is a hard constraint here, not a request. Once you have found and stated the root cause, conclude the investigation — the fix happens as a separate step outside this skill.

**Announce at start:** "I'm using the investigate skill — no fixes until we find the root cause."

## The Iron Law

```
┌──────────────────────────────────────────────┐
│  NO FIXES WITHOUT ROOT CAUSE INVESTIGATION   │
│                                              │
│  If you haven't found the root cause,        │
│  you cannot propose a fix.                   │
└──────────────────────────────────────────────┘
```

This is not a suggestion. This is a hard constraint. Guessing causes more bugs than it fixes.

## Process

### Phase 1: Scope Lock

Before investigating, lock the investigation scope to prevent it from sprawling:

1. **State the symptom** — What exactly is broken? Be precise.
2. **Identify the module** — Which part of the codebase is affected?
3. **Freeze to module** — Investigation stays within this module until evidence points elsewhere.

Example:
```
Symptom: API returns 500 on POST /api/webhooks
Module: packages/api/src/routes/webhooks.ts
Freeze: Investigation limited to webhook handler + its direct dependencies
```

**Why freeze?** Without scope, investigation becomes exploration. Exploration finds interesting things but doesn't fix bugs.

### Phase 2: Evidence Collection

Gather evidence BEFORE forming any hypothesis:

1. **Read the error** — Full stack trace, error message, error code. Not a glance — read every line.

2. **Reproduce** — Can you trigger it reliably? What are the exact steps?
   - If reproducible: proceed
   - If intermittent: gather more data points, don't guess

3. **Check the timeline** — What changed recently?
   ```bash
   git log --oneline -20
   git diff HEAD~3
   ```

4. **Trace the data flow** — Follow the data from input to error:
   - What value enters the function?
   - What transformation happens?
   - Where does it break?
   - Trace BACKWARD from the error to the source

5. **Check boundaries** — For multi-component systems, verify data at each boundary:
   - API → service: is the request correct?
   - Service → database: is the query correct?
   - Database → response: is the result expected?

### Phase 3: Hypothesis

Form ONE hypothesis based on evidence:

```
"I think [X] is the root cause because [evidence Y shows Z]"
```

Requirements:
- Must be specific (not "something is wrong with auth")
- Must be supported by evidence collected in Phase 2
- Must be testable with a single, minimal change

### Phase 4: Test

Test the hypothesis with the SMALLEST possible change:

1. Make ONE change
2. Run the reproduction steps
3. Did it fix the issue?
   - **Yes** → Proceed to Phase 5
   - **No** → Return to Phase 2 with new information. Do NOT add more fixes.

**Critical:** If 3 hypotheses fail, STOP. The problem is likely architectural, not a simple bug. Discuss with the user before attempting fix #4.

### Phase 5: Fix

Now — and only now — implement the proper fix:

1. **Write a failing test** that reproduces the exact bug
2. **Implement the fix** — address the root cause, not the symptom
3. **Verify the test passes**
4. **Run the full test suite** — ensure no regressions
5. **Save the learning** — record what you found for future reference:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/tools/learnings-manager.mjs save --title "Root cause of webhook 500" --body "The webhook handler wasn't awaiting the database write, causing a race condition with the response" --tags "debugging,webhooks,async"
   ```

## Red Flags

If you catch yourself doing any of these, STOP and return to Phase 2:

- "Let me just try this quick fix"
- "It's probably X, let me change it"
- "I'll add multiple changes and see which works"
- "I don't fully understand but this might work"
- "Here are 3 possible fixes" (without investigation)
- Proposing solutions before tracing the data flow

## Integration with Guard

For critical systems, activate `/guard` before investigating to prevent accidental changes:

```
/guard → /investigate → fix → /canary
```

Guard ensures no destructive commands run during investigation, and canary verifies the fix in production.

## Relationship to Systematic Debugging

This skill shares principles with `ultraship:systematic-debugging` but adds:
- **Module freeze** — scoped investigation prevents sprawl
- **Learning capture** — every investigation produces a learning
- **Guard integration** — safety during critical system debugging
- **Escalation protocol** — clear rules for when to stop and rethink
