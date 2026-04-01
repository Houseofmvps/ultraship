---
name: clone-patterns
description: "Learn From the Best — analyze patterns from any codebase and apply them to yours. Use when user wants to adopt best practices from another repo, compare code quality, or learn how top projects are structured."
argument-hint: "<repo-url-or-path>"
allowed-tools: Bash, Read, Grep, Glob
---

# Learn From the Best

Analyze any codebase's patterns and apply the best ones to your project.

## Process

### Phase 1: Analyze Source

Ask for the source project directory (must be cloned locally):
- "Which repo do you want to learn from? Provide the local path."

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/pattern-analyzer.mjs <source-directory> --compare=<your-project-directory>
```

Parse the JSON output.

### Phase 2: Pattern Report

Present the source project's patterns:

**Project Structure:**
- How they organize code (feature-based, layer-based, hybrid)
- Naming conventions
- Key directories

**Testing Strategy:**
- Framework and location
- Test-to-source ratio
- Integration vs unit separation

**Code Quality:**
- Average file length
- Export patterns
- Linting and formatting setup

**TypeScript Practices:**
- Strict mode usage
- Type vs interface preference
- `any` count

**Error Handling:**
- Custom error classes
- Middleware patterns
- Global handlers

**CI/CD:**
- Pipeline setup
- Automated steps

### Phase 3: Comparison

Show side-by-side comparison between the source project and yours:

For each area, show:
- What they do vs what you do
- Whether the difference matters
- Specific recommendation

### Phase 4: Adoption Plan

Create a prioritized adoption plan:

**Priority 1 (High Impact, Low Effort):**
- Enable TypeScript strict mode
- Add linting/formatting config
- Adopt naming conventions

**Priority 2 (High Impact, Medium Effort):**
- Add test framework and initial tests
- Create custom error classes
- Add CI pipeline

**Priority 3 (Medium Impact, Higher Effort):**
- Restructure project directories
- Add integration tests
- Improve documentation

### Phase 5: Apply Patterns

For each pattern the user wants to adopt, implement it:

1. **TypeScript strict mode** — update tsconfig.json, fix resulting errors
2. **Test framework** — install vitest/jest, create first test, add test script
3. **Error handling** — create base error class, add error middleware
4. **CI pipeline** — create .github/workflows/ci.yml with lint, test, build
5. **Linting** — add eslint config matching source project's style

Only apply patterns the user explicitly approves.

## Key Principle

**Steal like an artist.** The best codebases didn't invent their patterns — they borrowed from others and refined them. Learn what works, adapt it to your context, and make it your own.
