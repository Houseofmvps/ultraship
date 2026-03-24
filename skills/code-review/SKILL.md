---
name: code-review
description: Code review a pull request
allowed-tools: Bash(gh pr:*), Bash(gh issue:*), Read, Grep, Glob
---

# Code Review

Review pull requests for correctness, performance, security, and maintainability.

Invoke the /review command for the full PR review workflow.

## Output Format for /ship

When invoked by /ship, output findings with severity levels (critical/high/medium/low/info) in the same format as other auditors:

```json
{
  "category": "code-quality",
  "findings": [
    { "severity": "high", "category": "code-quality", "file": "path", "line": N, "message": "description" }
  ]
}
```
