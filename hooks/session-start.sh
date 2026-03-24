#!/bin/bash
# Ultraship SessionStart hook
# Checks CLAUDE.md existence and freshness

CLAUDE_MD="$PWD/CLAUDE.md"

# Helper: safely output JSON with escaped strings
json_context() {
  local msg="$1"
  # Escape backslashes, double quotes, and control characters for valid JSON
  msg=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' "$msg"
}

if [ ! -f "$CLAUDE_MD" ]; then
  json_context "No CLAUDE.md found in this project. Offer to create one based on the project structure."
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
  json_context "CLAUDE.md in this project is ${age_days} days old. Consider running /revise-claude-md to keep it current."
fi
