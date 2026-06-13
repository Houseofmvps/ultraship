#!/bin/bash
# Ultraship Currency Guard — UserPromptSubmit hook
#
# Models answer version-sensitive questions from training data that may be
# months or years stale. This hook fires on every prompt, detects when the
# prompt is about something whose correct answer changes over time (library
# APIs, versions, pricing, model IDs, "latest" anything), and injects a
# deterministic directive telling Claude to verify against current sources
# (context7 for library docs, WebSearch/WebFetch for everything else) instead
# of relying on training data.
#
# This is a reminder, not a block — it exits 0 and only adds context when a
# currency-sensitive trigger is present, so normal prompts are untouched.

# Read the hook payload from stdin (JSON with a `prompt` field).
payload=$(cat)

# Extract the prompt text. Prefer python3 for robust JSON parsing; fall back to
# a sed extraction if python3 is unavailable.
prompt=""
if command -v python3 >/dev/null 2>&1; then
  prompt=$(printf '%s' "$payload" | python3 -c 'import sys,json
try:
    print(json.load(sys.stdin).get("prompt",""))
except Exception:
    pass' 2>/dev/null)
fi
if [ -z "$prompt" ]; then
  # Fallback: grab the value of the first "prompt": "..." occurrence.
  prompt=$(printf '%s' "$payload" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)/\1/p' | head -c 4000)
fi

# Lowercase for matching.
lc=$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')

# If the prompt is empty, do nothing.
if [ -z "$lc" ]; then
  exit 0
fi

# Currency-sensitive triggers. Two buckets:
#   1. Generic recency/version words.
#   2. Library/framework/tool/SDK/API discussion, which is version-sensitive.
# Word-boundary-ish matching via grep -E. Keep this fast and conservative —
# false positives just add a short reminder, false negatives miss enforcement.
generic_re='(latest|newest|current|up[ -]?to[ -]?date|recently|this year|2025|2026|deprecat|breaking change|migrat|upgrade|release notes|changelog)'
versionish_re='\bv?[0-9]+\.[0-9x]+'
techterm_re='(api|sdk|cli|library|framework|package|npm|pypi|crate|gem|endpoint|model id|model name|pricing|price|cost per|rate limit|docs|documentation|install|config|version)'
# Named ecosystems that move fast (high-signal). Extend freely.
named_re='(next\.?js|react|vue|svelte|astro|hono|express|fastify|nest|drizzle|prisma|tailwind|shadcn|vite|bun|deno|node|typescript|stripe|polar|supabase|vercel|railway|cloudflare|openai|anthropic|claude|gpt|gemini|llama|langchain|playwright|puppeteer)'

inject=false
reason=""

if printf '%s' "$lc" | grep -Eq "$generic_re"; then
  inject=true
  reason="recency/version language"
elif printf '%s' "$lc" | grep -Eq "$versionish_re"; then
  inject=true
  reason="a specific version number"
elif printf '%s' "$lc" | grep -Eq "$named_re" && printf '%s' "$lc" | grep -Eq "$techterm_re"; then
  inject=true
  reason="a fast-moving library/tool"
fi

if [ "$inject" != true ]; then
  exit 0
fi

# Build the directive. Single line, escaped for JSON.
msg="Ultraship Currency Guard: this prompt touches ${reason}, where training data is often stale. BEFORE answering, verify against current sources — use the context7 MCP (resolve-library-id then query-docs) for any library/framework/SDK API, and WebSearch/WebFetch for versions, pricing, model IDs, release notes, or anything time-sensitive. Do not state version-specific facts, API signatures, or prices from memory. If you cannot verify, say so explicitly rather than guessing."

# Escape backslashes and double quotes for valid JSON.
esc=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}' "$esc"
exit 0
