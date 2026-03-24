#!/bin/bash
# Ultraship SessionStart hook
# Checks CLAUDE.md existence and freshness

CLAUDE_MD="$PWD/CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
  CONTEXT="No CLAUDE.md found in this project directory ($PWD). Offer to create one based on the project structure — check package.json, directory layout, and any existing README for context."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$CONTEXT"
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
  CONTEXT="CLAUDE.md in this project is ${age_days} days old. Consider running /revise-claude-md to keep it current with recent changes."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$CONTEXT"
fi
