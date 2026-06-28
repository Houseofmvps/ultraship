---
name: a11y
description: Accessibility audit + auto-fix (WCAG 2.2 A/AA). Scans built/static HTML for screen-reader, keyboard, and structure failures, fixes the deterministic ones, and escalates to a rendered scan for contrast and focus. Use when the user wants to check or improve accessibility, fix WCAG issues, or pass an a11y review.
argument-hint: "<url-or-directory>"
allowed-tools: Bash, Read, Edit, Grep, Glob
paths: ["**/*.html", "**/*.htm", "**/index.html"]
---

# Accessibility Audit + Auto-Fix (WCAG 2.2)

AI builders ship accessibility violations by default — missing alt text, unlabeled inputs, icon-only buttons, no `lang`, broken heading order. These are legally consequential (ADA, EU Accessibility Act) and most are deterministically detectable and fixable. This skill finds them AND fixes them.

## Process

### Phase 1: Scan

Run the static scanner on the project (point it at built/exported HTML, e.g. `dist/`, `build/`, `out/`, `.next/`, or `public/`):

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/a11y-scanner.mjs <project-directory>
```

Parse the JSON: `findings[]` (`{ file, severity, category, rule, message }`), `summary` (counts by severity), and `scores.a11y` (0–100, or null when no HTML found).

> **Many pages, each needing fixes?** Escalate to a **dynamic Workflow** (describe the audit and include the word "workflow") so scan → fix → verify runs across pages in parallel instead of one at a time.

### Phase 2: Report

Present findings grouped by rule, highest severity first. Map each to its WCAG criterion (already in the message). Make clear which are auto-fixable now vs which need a rendered scan (Phase 4).

### Phase 3: Fix (use the Edit tool on the source files)

Apply the deterministic fix for each finding. **Do not invent content** — for alt text and labels, derive from nearby context (filename, heading, surrounding copy, `name`/`placeholder`); if genuinely ambiguous, ask the user rather than guessing.

| Rule | Fix |
|---|---|
| `html-missing-lang` / `html-empty-lang` | Add `lang="en"` (or the document's real language) to `<html>` |
| `img-missing-alt` | Add `alt="<concise description>"` from context; use `alt=""` only if the image is purely decorative |
| `input-image-missing-alt` | Add `alt="<what the button does>"` |
| `control-missing-label` | Add a `<label for="id">`, or `aria-label`/`aria-labelledby`. A `placeholder` is NOT a label — keep it but add a real label |
| `button-no-text` | Add visible text, or `aria-label="<action>"` for icon-only buttons |
| `link-no-text` | Add link text, or `aria-label`; if it wraps an icon, give the icon `alt`/`aria-label` |
| `link-generic-text` | Rewrite "click here"/"read more" to state the destination ("Read the pricing guide") |
| `positive-tabindex` | Change to `tabindex="0"` (or remove) and fix order via DOM order |
| `viewport-zoom-disabled` | Remove `user-scalable=no` / `maximum-scale=1` from the viewport meta |
| `duplicate-id` | Make each `id` unique (and update its label/aria references) |
| `broken-aria-reference` | Point `aria-labelledby`/`aria-describedby`/`for` at a real element id, or add the missing element |
| `empty-heading` | Remove the empty heading or give it text |
| `heading-skip` | Insert the missing level or demote the heading so levels don't jump |
| `missing-title` | Add a descriptive `<title>` in `<head>` |
| `missing-main-landmark` | Wrap the primary content in `<main>` |

### Phase 4: Escalate to a rendered scan (contrast, focus, reading order)

The static scanner cannot see computed styles or focus behavior. When a URL or running dev server is available, run a rendered audit — these tools need no install (npx fetches them) and cover **color contrast (WCAG 1.4.3)**, focus visibility, and ARIA state:

```bash
# Pa11y (axe + htmlcs runners). Use --runner axe for axe-core rules.
npx --yes pa11y --standard WCAG2AA <url>

# or the axe CLI directly
npx --yes @axe-core/cli <url>
```

If the project uses Playwright (Ultraship bundles the Playwright MCP), prefer injecting `axe-core` into the live page for per-component results. Report contrast and focus findings the static pass could not catch.

### Phase 5: Verify

Re-run the scanner and report before/after `scores.a11y`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/a11y-scanner.mjs <project-directory>
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> a11y <score>
```

## Key Principles

- **Fix, don't just audit.** Every deterministic finding gets a concrete fix applied.
- **Zero false positives.** The scanner only flags source-visible failures; never "fix" something it didn't flag without confirming it's real.
- **Decorative vs meaningful.** `alt=""` is correct for decorative images — don't add fake descriptions to them.
- **Static + rendered together.** The scanner catches structure/labels/alt; the rendered pass (Phase 4) catches contrast and focus. A real a11y pass needs both.
