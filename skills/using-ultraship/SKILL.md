---
name: using-ultraship
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<IMPORTANT>
**Memory-first rule:** At the START of every session, read MEMORY.md, CLAUDE.md, and relevant memory files BEFORE performing any task. This ensures persistent context across sessions. Never skip this step — never claim something is missing or not done without first checking memory. Memory records can become stale, so verify against current state when acting on them.
</IMPORTANT>

<IMPORTANT>
When a skill is relevant to your current task, invoke it before responding. If you're unsure whether a skill applies, lean toward invoking it — skills are lightweight and you can adapt after loading.
</IMPORTANT>

## Instruction Priority

Ultraship skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) — highest priority
2. **Ultraship skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If CLAUDE.md, GEMINI.md, or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Claude Code tool names. Non-CC platforms: see `references/codex-tools.md` (Codex) for tool equivalents. Gemini CLI users get the tool mapping loaded automatically via GEMINI.md.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (frontend-design, mcp-builder) - these guide execution

"Let's build X" → brainstorming first, then implementation skills.
"Fix this bug" → debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

## Available Skills Catalog

Invoke the `Skill` tool with the skill name shown below. Use the skill that best fits your current task.

### Workflow Skills

| Skill | When to use |
|-------|-------------|
| `ultraship:brainstorm` | Collaborative idea-to-design flow before writing any code |
| `ultraship:write-plan` | Create an implementation plan from a spec or idea |
| `ultraship:execute-plan` | Execute a plan with review checkpoints |
| `ultraship:tdd` | Test-driven development — write tests before implementation |
| `ultraship:debugging` | Systematic bug investigation and fix |
| `ultraship:git-workflow` | Branching, commits, PRs, and merge strategies |
| `ultraship:code-review` | Code review pull requests with confidence scoring |
| `ultraship:refactor` | Safely refactor code without changing behavior |
| `ultraship:api-design` | Design REST or RPC APIs with consistency |
| `ultraship:data-modeling` | Design database schemas and data models |
| `ultraship:testing-strategy` | Decide what and how to test for a given feature |
| `ultraship:documentation` | Write clear, useful technical documentation |
| `ultraship:performance` | Profile and optimize application performance |
| `ultraship:security` | Apply security best practices during implementation |

### Audit Skills

| Skill | When to use |
|-------|-------------|
| `ultraship:seo-audit` | Run SEO + AI visibility audit with auto-fix. Use when optimizing search visibility. |
| `ultraship:perf-audit` | Run Lighthouse performance audit with auto-fix. Use when optimizing site speed. |
| `ultraship:security-audit` | Run security audit (dep audit, secrets, OWASP, headers) with auto-fix. |

### Design & Polish Skills

| Skill | When to use |
|-------|-------------|
| `ultraship:frontend-design` | Create distinctive, production-grade frontend interfaces. |

### Project Management Skills

| Skill | When to use |
|-------|-------------|
| `ultraship:revise-claude-md` | Update CLAUDE.md with learnings from the current session. |

## Available Slash Commands

Run these commands directly in your Claude Code session:

| Command | What it does |
|---------|-------------|
| `/ship` | Run all auditors in parallel, produce ship-readiness scorecard |
| `/seo` | SEO + AI visibility audit with auto-fix |
| `/perf` | Lighthouse performance audit with auto-fix |
| `/secure` | Security audit with auto-fix |
| `/review` | Code review a pull request |
| `/brainstorm` | Collaborative idea-to-design flow |
| `/write-plan` | Create implementation plan from spec |
| `/execute-plan` | Execute plan with review checkpoints |
| `/revise-claude-md` | Update CLAUDE.md with session learnings |
