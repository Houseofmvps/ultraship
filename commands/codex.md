---
description: Generate a compact codebase index to save tokens
---

# /codex — Codebase Index Generator

Generate a compact markdown index of your codebase (routes, schema, components, lib exports) so AI assistants don't waste tokens exploring project structure.

## How It Works

1. Run `node "${CLAUDE_PLUGIN_ROOT}/tools/codex-generator.mjs" .`
2. Read the generated `.ultraship/codex.md`
3. Present the output to the user — this is their codebase map

## What It Indexes

| Section | Sources |
|---|---|
| Routes | Hono, Express, Fastify, Next.js app router |
| Schema | Drizzle tables, Prisma models (skips audit fields) |
| Components | React/Vue/Svelte (skips shadcn/radix primitives) |
| Lib | Exported functions, types, classes from lib/utils/helpers dirs |

## After Generating

Tell the user:
- The codex is saved at `.ultraship/codex.md`
- Add it to `.gitignore` (it's generated, not source)
- Re-run `/codex` after major structural changes
- The codex reduces token usage by giving AI a pre-built map instead of exploring files
