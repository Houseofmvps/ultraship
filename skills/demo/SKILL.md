---
name: demo
description: "Demo-Ready Mode — prepare your app for demos, screenshots, and presentations. Use when user wants to demo their app, take screenshots, prepare for a presentation, or clean up dev artifacts."
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Demo-Ready Mode

One command to make your app demo-ready. Clean up dev artifacts, check visual polish, generate a walkthrough script.

## Process

### Phase 1: Scan

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/demo-prep.mjs <project-directory>
```

Parse the JSON output for demo readiness score and issues.

### Phase 2: Demo Readiness Report

Present the demo readiness score and status:
- **Demo Ready** (90-100): Ship it, present it
- **Almost Ready** (70-89): A few things to clean up
- **Needs Work** (below 70): Significant polish needed

### Phase 3: Fix Dev Artifacts

For each category of issues found:

**Console Logs (Priority: High)**
Remove all console.log/debug statements from production code:
- Use Edit tool to remove each one
- Keep console.error for legitimate error handling
- Skip test files

**TODO Comments (Priority: Medium)**
For each TODO:
- If it's blocking the demo: implement it
- If it's not blocking: remove the comment or convert to a GitHub issue

**Placeholder Text (Priority: High)**
Replace all Lorem ipsum and placeholder text with real copy that makes sense for the product.

### Phase 4: Visual Polish

Fix visual issues found:

**Missing Favicon:**
- Suggest the user add one, or offer to create a simple SVG favicon

**Default Branding:**
- Remove framework default logos/text
- Ensure the app shows the user's brand

**Error Pages:**
- Create a custom 404 page if missing
- Create a custom 500 page if missing

**Loading States:**
- Add loading spinners/skeletons where async content loads

**Empty States:**
- Replace "No data" with helpful, friendly empty state messages
- Add CTAs in empty states ("Create your first X")

### Phase 5: Seed Data

If the app has a seed file:
- Remind user to run it: `[seed command from tool output]`
- Verify seed data creates a compelling demo state

If no seed file exists:
- Suggest creating one with realistic demo data
- Help create a basic seed script if the user wants

### Phase 6: Walkthrough Script

Present the auto-generated walkthrough:

For each step:
1. **Action** — what to do (navigate, click, fill)
2. **Screenshot** — whether to capture this screen
3. **Talking point** — what to say/highlight at this step
4. **Notes** — things to point out or avoid

### Phase 7: Screenshot Capture

If the user wants screenshots, use Playwright MCP:

1. Navigate to each walkthrough URL
2. Use `browser_resize` for the target viewport
3. Use `browser_take_screenshot` at each step
4. Capture both desktop and mobile versions of key screens

### Phase 8: Final Check

After all fixes, re-run the tool to verify the score improved:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/demo-prep.mjs <project-directory> --check-only
```

Report the before/after scores.

## Key Principle

**First impressions are forever.** A demo with console.logs, Lorem ipsum, and empty states kills credibility. A polished demo with real data and smooth flows wins deals, users, and investors.
