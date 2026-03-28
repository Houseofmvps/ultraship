---
name: visual-diff
description: "Visual Regression Testing — screenshot comparison before and after changes. Use when user wants to check for visual regressions, compare UI changes, or verify CSS/layout changes didn't break anything."
---

# Visual Regression Testing

Automated screenshot comparison using Playwright. Catch visual bugs before they ship.

## Process

### Phase 1: Determine Test Scope

Ask the user:
1. **What URL(s) to test?** (localhost, staging, or production)
2. **What changed?** (CSS update, component refactor, dependency upgrade, etc.)

If the user already described what changed, skip asking.

### Phase 2: Take "Before" Screenshots

If comparing against the current state (before making changes):

Use the Playwright MCP to capture screenshots:

1. Navigate to the URL:
   - Use `browser_navigate` to go to the target URL

2. Take full-page screenshot:
   - Use `browser_take_screenshot` to capture the current state

3. Capture key viewports:
   - Desktop (1920x1080): `browser_resize` then `browser_take_screenshot`
   - Tablet (768x1024): `browser_resize` then `browser_take_screenshot`
   - Mobile (375x812): `browser_resize` then `browser_take_screenshot`

4. Save screenshots with descriptive names noting they are "before" state.

### Phase 3: Make Changes

Let the user make their changes, or make them yourself if that's the task.

### Phase 4: Take "After" Screenshots

Repeat the same screenshot process for the same URLs and viewports.

### Phase 5: Visual Comparison

Compare before and after screenshots:

1. **Layout shifts** — did any elements move unexpectedly?
2. **Color changes** — did colors, gradients, or shadows change?
3. **Typography** — did font sizes, weights, or spacing change?
4. **Responsive issues** — does it look correct on all viewports?
5. **Missing elements** — did anything disappear?
6. **Overflow issues** — is content clipping or overflowing?

Use `browser_snapshot` to get the accessibility tree and compare DOM structure between before/after.

### Phase 6: Report

Present findings in a clear format:

**No Visual Regressions Found:**
- "All pages look identical across desktop, tablet, and mobile viewports."

**Regressions Detected:**
For each regression:
- **Page:** URL where the issue appears
- **Viewport:** Which screen size is affected
- **What changed:** Description of the visual difference
- **Severity:** Critical (broken layout), High (noticeable shift), Medium (minor difference), Low (pixel-level)
- **Suggested fix:** How to resolve the regression

### Phase 7: Targeted Testing

For specific component changes, also test:
- Hover states (use `browser_hover`)
- Click interactions (use `browser_click`)
- Form states (use `browser_fill_form`)
- Dark mode (if applicable)
- Loading states
- Error states
- Empty states

## Key Pages to Always Test

When the user doesn't specify pages, test these by default:
1. Homepage / Landing page (/)
2. Login/signup page (if exists)
3. Main app page (dashboard, etc.)
4. Any page the user recently modified

## Key Principle

**Trust screenshots, not assumptions.** CSS changes cascade unpredictably. A "small tweak" in one component can break layouts across the entire app. Always verify visually.
