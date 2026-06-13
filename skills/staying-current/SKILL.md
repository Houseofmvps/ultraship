---
name: staying-current
description: Use whenever answering anything version-sensitive — library/framework/SDK APIs, package versions, model IDs, pricing, CLI flags, config, or "latest/newest" anything. Verify against current sources instead of training data.
allowed-tools: Bash, Read, WebSearch, WebFetch
---

# Staying Current

Training data has a cutoff. Libraries ship breaking changes, prices change, model IDs get renamed, and APIs get deprecated after that cutoff. Answering version-sensitive questions from memory is the single most common way an otherwise-correct agent ships wrong code. This skill is the standing rule for not doing that.

The Ultraship **Currency Guard** hook (`UserPromptSubmit`) already fires on every prompt and injects a reminder when it detects version-sensitive language. This skill is what you do when that fires — or any time you're about to state a fact whose correct answer changes over time.

## The rule

**Before stating any of the following, verify it against a current source. Never answer from training data alone:**

- Library / framework / SDK API signatures, imports, hooks, options
- Package versions, compatibility, and what's deprecated
- CLI flags and config file schemas
- Model IDs, model names, context windows, and capabilities
- Pricing, rate limits, free-tier limits, quotas
- "Latest", "newest", "current", "recommended" anything
- Release notes, changelogs, migration steps

## Where to verify

| Source | Use for |
|---|---|
| **context7 MCP** (`resolve-library-id` → `query-docs`) | Library/framework/SDK documentation and API syntax. This is the primary source for code. Use it even when you think you know the answer. |
| **WebSearch / WebFetch** | Versions, pricing, model IDs, release notes, deprecations, anything not in a library's docs. The current month is the search context — say "2026" in queries when recency matters. |
| **The project's lockfile** (`package-lock.json`, `pnpm-lock.yaml`, `requirements.txt`, `go.sum`, `Cargo.lock`) | The exact version actually installed here — always check this before assuming a version. |

## How to apply

1. **Detect.** If the question touches anything in the rule above, do not answer yet.
2. **Check what's installed.** Read the lockfile/manifest to learn the real version in this project.
3. **Pull current docs.** Resolve the library on context7 and query the specific API. For non-library facts (pricing, model IDs), WebSearch then WebFetch the authoritative page.
4. **Answer from the source**, and cite it. Quote the version/date you verified against.
5. **If you can't verify, say so.** "I couldn't confirm this against a current source" is correct. A confident wrong API is not.

## Anti-patterns

- ❌ Writing an `import` or hook call from memory for a library you haven't checked this session.
- ❌ Quoting a price or model ID without fetching the current page.
- ❌ Assuming the latest major version — projects pin old ones; read the lockfile.
- ❌ Treating a recalled Ultraship memory as current — memories are point-in-time; re-verify file paths, flags, and versions before acting on them.

## Note on Claude/Anthropic specifically

When the task involves Claude, the Anthropic API, model IDs, or pricing, the same rule applies with extra force — these change frequently. Verify model IDs and pricing against current Anthropic docs before quoting them.
