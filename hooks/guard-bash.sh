#!/bin/bash
# Ultraship Guard — PreToolUse hook for Bash commands
# Blocks destructive commands and warns before execution
# Reads the tool input from stdin (JSON with "input" field containing the command)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$COMMAND" ]; then
  # No command found — allow
  exit 0
fi

# Destructive patterns to block
BLOCKED=false
REASON=""

# rm -rf on important directories
if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive)\s+(\/|~|\$HOME|\.\.|\.\/\.\.)'; then
  BLOCKED=true
  REASON="Destructive removal of important directory"
fi

# rm -rf /* or rm -rf .
if echo "$COMMAND" | grep -qE 'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f)\s+(/\*|\.$|\./)'; then
  BLOCKED=true
  REASON="Destructive removal — this would delete everything"
fi

# DROP TABLE / DROP DATABASE / TRUNCATE
if echo "$COMMAND" | grep -qiE '(DROP\s+(TABLE|DATABASE)|TRUNCATE\s+TABLE)'; then
  BLOCKED=true
  REASON="SQL destructive operation — DROP/TRUNCATE"
fi

# git push --force to main/master
if echo "$COMMAND" | grep -qE 'git\s+push\s+(-[a-zA-Z]*f|--force).*\s+(main|master)'; then
  BLOCKED=true
  REASON="Force-push to main/master branch"
fi

# git reset --hard
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  BLOCKED=true
  REASON="git reset --hard — discards all uncommitted changes"
fi

# git checkout . (discard all changes)
if echo "$COMMAND" | grep -qE 'git\s+checkout\s+\.$'; then
  BLOCKED=true
  REASON="git checkout . — discards all working directory changes"
fi

# git clean -f
if echo "$COMMAND" | grep -qE 'git\s+clean\s+-[a-zA-Z]*f'; then
  BLOCKED=true
  REASON="git clean -f — permanently removes untracked files"
fi

# git branch -D (force delete)
if echo "$COMMAND" | grep -qE 'git\s+branch\s+-D\s'; then
  BLOCKED=true
  REASON="git branch -D — force-deletes branch without merge check"
fi

# kubectl delete
if echo "$COMMAND" | grep -qE 'kubectl\s+delete'; then
  BLOCKED=true
  REASON="kubectl delete — removes Kubernetes resources"
fi

# docker system prune / docker volume rm
if echo "$COMMAND" | grep -qE 'docker\s+(system\s+prune|volume\s+rm)'; then
  BLOCKED=true
  REASON="Docker destructive operation"
fi

if [ "$BLOCKED" = true ]; then
  echo "⚠️  GUARD BLOCKED: $REASON"
  echo "Command: $COMMAND"
  echo "To proceed, explicitly confirm this action."
  exit 2
fi

exit 0
