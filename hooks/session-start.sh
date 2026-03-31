#!/bin/bash
# Ultraship SessionStart hook
# Checks CLAUDE.md existence/freshness and enforces memory-first behavior

CLAUDE_MD="$PWD/CLAUDE.md"
CONTEXT=""

# Helper: safely output JSON with escaped strings
json_context() {
  local msg="$1"
  # Escape backslashes, double quotes, and control characters for valid JSON
  msg=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$msg"
}

# --- Memory check ---
# Look for MEMORY.md in common locations
MEMORY_LOCATIONS=(
  "$HOME/.claude/projects/$(echo "$PWD" | tr '/' '-')/memory/MEMORY.md"
  "$PWD/.claude/memory/MEMORY.md"
  "$HOME/.claude/MEMORY.md"
)

MEMORY_FOUND=false
for loc in "${MEMORY_LOCATIONS[@]}"; do
  if [ -f "$loc" ]; then
    MEMORY_FOUND=true
    break
  fi
done

if [ "$MEMORY_FOUND" = true ]; then
  CONTEXT="IMPORTANT: Read MEMORY.md and relevant memory files BEFORE performing any task. This ensures persistent context across sessions. Never skip this step."
else
  CONTEXT="No memory files found. Consider setting up auto-memory (MEMORY.md) for persistent context across sessions."
fi

# --- CLAUDE.md check ---
if [ ! -f "$CLAUDE_MD" ]; then
  CONTEXT="${CONTEXT}\\nNo CLAUDE.md found in this project directory (${PWD}). Offer to create one based on the project structure — check package.json, directory layout, and any existing README for context."
  json_context "$CONTEXT"
  exit 0
fi

if [ "$(uname)" = "Darwin" ]; then
  mod_epoch=$(stat -f %m "$CLAUDE_MD")
else
  mod_epoch=$(stat -c %Y "$CLAUDE_MD")
fi
now_epoch=$(date +%s)
age_days=$(( (now_epoch - mod_epoch) / 86400 ))

if [ "$age_days" -ge 7 ]; then
  CONTEXT="${CONTEXT}\\nCLAUDE.md in this project is ${age_days} days old. Consider running /revise-claude-md to keep it current."
fi

json_context "$CONTEXT"
