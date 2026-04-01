---
name: perf-audit
description: Run Lighthouse performance audit with auto-fix for common issues. Use when user wants to check or improve site performance.
argument-hint: "<url>"
allowed-tools: Bash, Read, Edit, Grep, Glob
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

### Step 3: Report Scores & Core Web Vitals

Present all four Lighthouse scores:
- Performance (target 90+)
- Accessibility (target 90+)
- Best Practices (target 90+)
- SEO (target 100)

Report Core Web Vitals with targets:
- **LCP** (Largest Contentful Paint): target <2.5s — report the LCP element from `lcp_element`
- **TBT** (Total Blocking Time): target <200ms — proxy for INP
- **CLS** (Cumulative Layout Shift): target <0.1
- **FCP** (First Contentful Paint): target <1.8s
- **SI** (Speed Index): target <3.4s

### Step 4: Identify Root Causes

Before fixing, identify what's actually causing problems:

**LCP too high?** Check `lcp_element` in results — fix THAT specific element:
- If it's an `<img>`: preload it, use WebP, add fetchpriority="high"
- If it's text: check web font loading, add font-display: swap
- If it's a background image: preload via `<link rel="preload">`

**CLS too high?** Check diagnostics for layout shift sources:
- Images without width/height → add dimensions (scanner already checks this)
- Dynamic content injected above fold → reserve space with CSS
- Web fonts causing FOUT → add font-display: optional or swap

**Unused resources?** Check `wasted_resources`:
- `unused_js_kb` > 100KB → code splitting or tree shaking needed
- `unused_css_kb` > 50KB → purge unused CSS (PurgeCSS, Tailwind purge)

**Third-party scripts slow?** Check `third_party_impact`:
- Analytics blocking >100ms → defer/async load
- Ad scripts blocking >200ms → lazy load below fold
- Chat widgets → load on user interaction, not page load

### Step 5: Apply Fixes

For each opportunity, apply fixes using Edit tool:

**Performance fixes (high impact first):**
- **Render-blocking resources** → add `defer` or `async` to non-critical scripts
- **Unused JavaScript** → recommend code splitting, dynamic imports, tree shaking
- **Unused CSS** → recommend PurgeCSS or Tailwind purge config
- **LCP image not preloaded** → add `<link rel="preload" as="image" href="...">`
- **Images not lazy-loaded** → add `loading="lazy"` to below-fold images
- **Images without dimensions** → add `width` and `height` attributes
- **No preconnect** → add `<link rel="preconnect" href="...">` for external origins
- **Font display** → add `font-display: swap` to @font-face declarations
- **Third-party scripts** → defer non-essential scripts, lazy load on interaction

**Accessibility fixes:**
- Missing alt text (also caught by SEO scanner)
- Missing form labels → add `<label>` elements
- Low contrast → adjust colors
- Missing landmark regions → add `<main>`, `<nav>`, `<footer>`

### Step 6: Graceful Degradation

- **No Chrome**: report "Chrome needed for Lighthouse. Install Chrome or Chromium."
- **Lighthouse timeout**: return partial results with warning
- **No dev server**: suggest starting one, or test against production URL

## Key Principle

**Fix, don't just audit.** Identify the specific elements causing problems. Apply every automated fix possible. For build-tool changes (code splitting, tree shaking), provide exact config recommendations.
