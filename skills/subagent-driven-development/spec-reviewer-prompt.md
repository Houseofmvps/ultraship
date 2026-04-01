# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less)

**Model:** sonnet

```
Task tool (general-purpose):
  model: sonnet
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification.
    You MUST complete this review within 5 tool calls. Read only the changed files.

    ## What Was Requested

    [FULL TEXT of task requirements]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## Files Changed

    [List of files from implementer's report — read ONLY these files]

    ## Your Job

    Read each changed file. For each requirement in the spec, check: implemented or not?

    Do NOT trust the implementer's report. Verify by reading code.

    Report:
    - ✅ Spec compliant (all requirements implemented, nothing extra)
    - ❌ Issues: [what's missing or extra, with file:line]
```
