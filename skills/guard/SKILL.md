---
name: guard
description: Safety guardrails — blocks destructive commands (rm -rf, DROP TABLE, force-push, git reset --hard) and optionally restricts file edits to a specific directory. Use when working on critical systems or when you want extra protection.
argument-hint: "<directory-to-protect>"
allowed-tools: Bash, Read
---

# Guard — Safety Guardrails

Guard protects you from accidental destructive actions by intercepting dangerous commands before they execute. It uses Claude Code's PreToolUse hooks to catch risky patterns in real-time.

**Announce at start:** "I'm activating Guard — destructive commands will be blocked until you explicitly approve them."

## What Guard Blocks

### Destructive Bash Commands
- `rm -rf` / `rm -r` on important directories
- `DROP TABLE` / `DROP DATABASE` / `TRUNCATE`
- `git push --force` / `git push -f` (to main/master)
- `git reset --hard`
- `git checkout .` / `git restore .` (discard all changes)
- `git clean -f` / `git clean -fd`
- `git branch -D` (force delete branch)
- `kubectl delete` (Kubernetes resource deletion)
- `docker system prune` / `docker volume rm`
- `:> file` / `> file` (truncate files)

### File Edit Restrictions (Optional)
When the user specifies a directory to freeze to, Guard blocks edits outside that directory:

```
User: "Only edit files in src/api/"
→ Guard blocks Edit/Write calls to any path not under src/api/
```

## How It Works

Guard installs PreToolUse hooks that run BEFORE Claude executes Bash, Edit, or Write tools:

1. **Bash hook** — Scans the command string for destructive patterns. If matched, outputs a warning and blocks execution.
2. **Edit/Write hook** — If a freeze directory is set, checks that the target file is within the allowed path.

The hooks are defined in this skill's configuration and activate when the skill is loaded.

## Usage

### Activate full protection
Just invoke `/guard` — destructive command blocking is immediate.

### Set a directory freeze
Tell Claude which directory to restrict edits to:
```
"Only edit files in packages/api/"
"Freeze edits to src/components/"
```

Guard will write the freeze path to `.ultraship/guard-freeze.txt` and enforce it on all Edit/Write operations.

### Remove freeze
```
"Unfreeze" or "Remove edit restrictions"
```

### Override a blocked command
If Guard blocks something you actually need to run, explicitly confirm:
```
"Yes, I want to force-push to main"
"Confirmed: drop the users table"
```

Guard will allow explicitly confirmed destructive actions.

## Integration with Other Skills

- **`/investigate`** — Guard pairs well with investigation. No accidental fixes while diagnosing.
- **`/deploy`** — Guard prevents accidental force-pushes during deployment.
- **`/rescue`** — During incidents, Guard ensures rollback commands are deliberate.

## Key Principles

1. **Block by default, allow on confirmation.** Better to stop and ask than to destroy.
2. **No silent failures.** Always explain what was blocked and why.
3. **The user is sovereign.** Explicit confirmation overrides any guard.
4. **Minimal friction for safe operations.** Guard only triggers on genuinely dangerous patterns.
