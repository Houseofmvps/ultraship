#!/bin/bash
# Ultraship PostCompact hook
# Re-injects essential context after conversation compaction
# This prevents ultraship state from being lost in long sessions

CONTEXT=""

# Check if guard is active
FREEZE_FILE="${PWD}/.ultraship/guard-freeze.txt"
if [ -f "$FREEZE_FILE" ]; then
  FREEZE_DIR=$(cat "$FREEZE_FILE" 2>/dev/null | head -1 | tr -d '[:space:]')
  if [ -n "$FREEZE_DIR" ]; then
    CONTEXT="Ultraship Guard is ACTIVE — edits restricted to: ${FREEZE_DIR}. Run /guard to manage."
  fi
fi

# Remind about available Ultraship commands
CONTEXT="${CONTEXT}\\nUltraship plugin is active. Key commands: /ship (pre-deploy audit), /seo (SEO audit), /pentest (security test), /guard (safety), /sprint (workflow), /investigate (debug), /rescue (incidents), /compete (competitor analysis), /seo-strategy (elite SEO), /canary (post-deploy check), /retro (retrospective), /learn (project knowledge)."

# Check CLAUDE.md freshness
CLAUDE_MD="$PWD/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    mod_epoch=$(stat -f %m "$CLAUDE_MD")
  else
    mod_epoch=$(stat -c %Y "$CLAUDE_MD")
  fi
  now_epoch=$(date +%s)
  age_days=$(( (now_epoch - mod_epoch) / 86400 ))
  if [ "$age_days" -ge 7 ]; then
    CONTEXT="${CONTEXT}\\nCLAUDE.md is ${age_days} days old — consider /revise-claude-md."
  fi
fi

# Output as hookSpecificOutput
msg=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')
printf '{"hookSpecificOutput":{"hookEventName":"PostCompact","additionalContext":"%s"}}' "$msg"
