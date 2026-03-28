---
name: code-review
description: Code review with principal-engineer-level depth. Reviews for correctness, performance, security, maintainability, and architecture. Use when completing tasks, reviewing PRs, or before merging.
allowed-tools: Bash(gh pr:*), Bash(gh issue:*), Read, Grep, Glob
---

# Code Review

Review code the way a principal engineer would — not just "does it work?" but "will this cause problems at 3am?"

## Review Dimensions

Every review should evaluate these dimensions, in order of importance:

### 1. Correctness

The code must do what it claims to do.

- Does the logic match the requirements/spec?
- Are edge cases handled? (empty input, null, max values, concurrent access)
- Are error paths tested, not just happy paths?
- Does it handle the "what if this is called twice?" scenario?
- Are race conditions possible? (async operations, shared state, database transactions)

### 2. Security

Think like an attacker for every piece of new code.

- **Input validation**: Is user input validated before use? (URL params, request body, query strings)
- **IDOR**: Can User A access User B's data by changing an ID? (check every route with `:id` params)
- **Injection**: Is user input ever interpolated into SQL, shell commands, or HTML?
- **Auth**: Are new endpoints protected by auth middleware? Are permissions checked, not just authentication?
- **Secrets**: Are any credentials hardcoded? Any new env vars documented?
- **Data exposure**: Do API responses leak internal fields? (password hashes, internal IDs, other users' data)

### 3. Performance

Will this work at 10x the current load?

- **N+1 queries**: Database calls inside loops. The #1 performance killer in web apps.
- **Missing indexes**: New columns used in WHERE/JOIN without index.
- **Unbounded queries**: `findMany()` without `take`/`limit`. Will return 1M rows when the table grows.
- **Sync I/O**: `readFileSync`, `execSync` in request handlers. Blocks the event loop.
- **Sequential awaits**: Independent `await`s that should be `Promise.all()`.
- **Memory leaks**: Module-scoped arrays with `.push()`, event listeners added in request handlers.
- **Over-fetching**: Selecting all columns when only 2 are needed. Returning full objects when IDs suffice.

### 4. Maintainability

Will the next person (including future-you) understand this in 6 months?

- **Naming**: Do variable/function names describe what they do, not how they do it?
- **Complexity**: Can any function be broken into smaller, testable pieces?
- **Abstraction level**: Is the code at a consistent level of abstraction? (mixing HTTP parsing with business logic is a smell)
- **DRY violations**: Is the same logic duplicated in multiple places?
- **Dead code**: Are there unused functions, imports, or variables?
- **Comments**: Are they explaining "why," not "what"? Comments that restate the code are noise.

### 5. Architecture

Does this fit the existing patterns, or does it introduce divergence?

- **Pattern consistency**: Does the new code follow the patterns established in the codebase?
- **Coupling**: Does this create tight coupling between modules that should be independent?
- **Layer violations**: Is a UI component making direct database calls? Is an API route doing business logic inline?
- **Interface design**: Are the function signatures clean? Could the API be simpler?

## Confidence Scoring

Every finding should include a confidence level:

| Confidence | Meaning | Action |
|---|---|---|
| **High** | This is almost certainly a real issue | Fix before merging |
| **Medium** | This looks like an issue but context might make it fine | Investigate, fix if confirmed |
| **Low** | This is a style preference or minor concern | Note for later, don't block merge |

Don't cry wolf. A review that flags 30 "high" issues when only 3 are real trains the developer to ignore reviews. Be precise.

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

## Review Checklist (use mentally, don't output)

- [ ] Every new function has tests
- [ ] Every new route has auth middleware (if the app has auth)
- [ ] Every database query has appropriate indexes
- [ ] Every user input is validated
- [ ] No secrets in code
- [ ] No console.logs left in production code
- [ ] Error handling returns appropriate status codes
- [ ] API responses don't leak internal fields
- [ ] New dependencies are justified (not just convenience)
- [ ] The change is reversible (can be rolled back without data loss)

## Key Principles

- **Review the change, not the file.** Focus on what's new or modified. Don't nit-pick pre-existing code unless it's directly related to the change.
- **Offer fixes, not just complaints.** "This has an N+1 query" is unhelpful. "This has an N+1 query — move the query outside the loop and pass the results as a lookup map" is a review.
- **Distinguish between blocking and non-blocking.** Be explicit: "This must be fixed before merge" vs. "This is a suggestion for a follow-up PR."
- **Assume good intent.** The developer made the best choice they could with the information they had. Your job is to add information, not judgment.
