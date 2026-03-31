#!/bin/bash
# Ultraship Guard — PreToolUse hook for Edit/Write commands
# Blocks edits outside the frozen directory (if set)
# Reads tool input from stdin

FREEZE_FILE="${PWD}/.ultraship/guard-freeze.txt"

# If no freeze file, allow all edits
if [ ! -f "$FREEZE_FILE" ]; then
  exit 0
fi

FREEZE_DIR=$(cat "$FREEZE_FILE" 2>/dev/null | head -1 | tr -d '[:space:]')

if [ -z "$FREEZE_DIR" ]; then
  exit 0
fi

# Extract file_path from the input JSON
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve to absolute path for comparison
RESOLVED_FREEZE=$(cd "$PWD" && realpath "$FREEZE_DIR" 2>/dev/null || echo "$PWD/$FREEZE_DIR")
RESOLVED_FILE=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# Check if the file is within the frozen directory
case "$RESOLVED_FILE" in
  "$RESOLVED_FREEZE"/*)
    # File is within the allowed directory
    exit 0
    ;;
  "$RESOLVED_FREEZE")
    # File is the directory itself (unlikely but safe)
    exit 0
    ;;
  *)
    echo "⚠️  GUARD BLOCKED: Edit outside frozen directory"
    echo "File: $FILE_PATH"
    echo "Allowed directory: $FREEZE_DIR"
    echo "To edit files outside this directory, run /unfreeze first."
    exit 2
    ;;
esac
