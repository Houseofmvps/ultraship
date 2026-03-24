---
name: perf-audit
description: Run Lighthouse performance audit with auto-fix for common issues. Use when user wants to check or improve site performance.
---

# Performance Audit

Run Lighthouse against the project and fix performance issues.

## Process

### Step 1: Find the URL

- Check if dev server is running (try common ports: 3000, 5173, 4321, 8080)
- Check package.json scripts for dev/start commands
- Ask user for URL if not auto-detected
- If no server running, suggest starting one first

### Step 2: Run Lighthouse

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/lighthouse-runner.mjs <url>
```

Parse JSON output for scores and opportunities.

### Step 3: Report Scores

Present all four Lighthouse scores:
- Performance (LCP, INP, CLS, FCP, TTFB, SI)
- Accessibility
- Best Practices
- SEO

### Step 4: Apply Fixes

For each opportunity found, apply fixes using Edit tool:

- **Render-blocking resources** → add `defer` attribute to non-critical scripts
- **Images not lazy-loaded** → add `loading="lazy"` to below-fold `<img>` tags
- **Images without dimensions** → add `width` and `height` attributes
- **No preconnect** → add `<link rel="preconnect" href="...">` for external origins
- **Font display** → add `font-display: swap` to @font-face declarations
- **Unminified CSS/JS** → recommend build tool config (not auto-applied)

### Step 5: Graceful Degradation

- **No Chrome**: report "Chrome needed for Lighthouse. Install Chrome or Chromium."
- **Lighthouse timeout**: return partial results with warning
- **No dev server**: suggest starting one, or test against production URL

## Key Principle

**Fix, don't just audit.** Apply every automated fix possible.
