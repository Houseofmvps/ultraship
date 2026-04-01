# Ultraship — Gemini CLI Integration

Ultraship skills are designed for Claude Code but work in Gemini CLI with tool mapping.

## Setup

1. Install Ultraship: `npm install -g ultraship`
2. Copy this file to your project root as `GEMINI.md`
3. Skills load via `activate_skill` in Gemini CLI

## Tool Mapping

When Ultraship skills reference Claude Code tools, use these Gemini CLI equivalents:

| Skill references | Use in Gemini CLI |
|---|---|
| `Read` | `read_file` |
| `Write` | `write_file` |
| `Edit` | `replace` |
| `Bash` | `run_shell_command` |
| `Grep` | `grep_search` |
| `Glob` | `glob` |
| `TodoWrite` | `write_todos` |
| `Skill` | `activate_skill` |
| `WebSearch` | `google_web_search` |
| `WebFetch` | `web_fetch` |
| `Agent` / `Task` | Not supported — use sequential execution |

## Running Ultraship Tools

All 20 Ultraship tools work standalone via Node.js:

```bash
# Run tools directly
node node_modules/ultraship/tools/seo-scanner.mjs .
node node_modules/ultraship/tools/secret-scanner.mjs .
node node_modules/ultraship/tools/code-profiler.mjs .

# Or use the CLI
npx ultraship ship .        # Full scorecard
npx ultraship seo .         # SEO audit + AI visibility checks
npx ultraship security .    # Secret scanning
npx ultraship init          # Scaffold CLAUDE.md / GEMINI.md
```

## Available Skills

Invoke these with `activate_skill` in Gemini CLI:

**Workflow:** brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, subagent-driven-development (falls back to sequential), dispatching-parallel-agents (falls back to sequential), code-review, verification-before-completion, finishing-a-development-branch, using-git-worktrees, writing-skills

**Specialist:** frontend-design, seo-audit, security-audit, perf-audit, deploy, release, revise-claude-md, receiving-code-review, requesting-code-review

## Limitations in Gemini CLI

- **No subagent dispatch.** Skills that use parallel agents (`/ship`, `dispatching-parallel-agents`) run sequentially instead.
- **No MCP servers.** Context7 (live docs) and Playwright (browser) MCP servers are Claude Code only. Use `google_web_search` for docs lookup.
- **No hooks.** The SessionStart hook that checks CLAUDE.md freshness doesn't apply. Run `npx ultraship init` manually.
