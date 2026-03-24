---
name: seo-audit
description: Run comprehensive SEO, GEO (Generative Engine Optimization), and AEO (Answer Engine Optimization) audit with auto-fix. Use when user wants to check or improve search visibility.
---

# SEO/GEO/AEO Audit

Comprehensive search optimization audit. Finds issues AND fixes them.

## Process

### Phase 1: Scan

Run the SEO scanner on the project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/seo-scanner.mjs <project-directory>
```

Parse the JSON output for findings and scores (seo, geo, aeo).

### Phase 2: Report

Present findings grouped by category with severity:
- **SEO**: meta tags, OG tags, headings, alt text, canonical, robots.txt, sitemap
- **GEO**: structured data, llms.txt, content structure for AI
- **AEO**: FAQPage schema, speakable markup, snippet optimization

### Phase 3: Fix

For each finding, apply the appropriate fix:

**SEO fixes** (use Edit tool on HTML files):
- Missing title → add `<title>` in `<head>`
- Missing meta description → add `<meta name="description" content="...">`
- Missing OG tags → generate from page content
- Missing H1 → add appropriate heading
- Missing alt text → add descriptive alt attributes
- Missing canonical → add `<link rel="canonical">`
- Missing sitemap → run: `node ${CLAUDE_PLUGIN_ROOT}/tools/sitemap-generator.mjs <dir> <url>`
- Missing robots.txt → run: `node ${CLAUDE_PLUGIN_ROOT}/tools/robots-generator.mjs <dir> <url>`
- Missing favicon → warn user to add one

**GEO fixes**:
- Missing llms.txt → run: `node ${CLAUDE_PLUGIN_ROOT}/tools/llms-txt-generator.mjs <dir>`
- Missing structured data → run: `node ${CLAUDE_PLUGIN_ROOT}/tools/structured-data-generator.mjs <dir> --type=<type>`
- Improve content structure: add clear headings, FAQ sections, definitive statements

**AEO fixes**:
- Missing JSON-LD → generate appropriate schema type
- Missing FAQ schema → create FAQPage structured data from page content
- Snippet optimization → restructure key answers to 40-60 words

### Phase 4: GSC/Bing Submit (Optional)

If environment variables are configured:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs submit-sitemap <sitemap-url>
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-sitemap <sitemap-url>
```

### Phase 5: Verify

Re-run the scanner to confirm fixes and report before/after scores.

## Key Principle

**Fix, don't just audit.** Every finding should have a concrete fix applied.
