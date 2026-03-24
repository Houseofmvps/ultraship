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

### Phase 6: AI Search Content Strategy

After technical fixes, advise on content-level optimizations that the scanner cannot automate:

**GEO Content Patterns (for AI citation):**
- Rewrite key H2 headers as questions: "What is [topic]", "How does [feature] work", "Why use [product]"
- Add 1-2 sentence TL;DR summaries under important H2 sections — AI engines extract these as standalone answers
- Use plain-language definitions before introducing nuance: "[Product] is [clear definition]"
- Write in citation-ready format: concise, factual, quotable — avoid vague marketing copy
- Create comparison tables, statistics pages, and glossaries — these are the most-cited page formats by AI

**E-E-A-T Signals (for AI trust):**
- Add Author/Person schema with credentials, role, and expertise
- Include first-hand experience statements: "We tested", "In our experience", "Based on [N] customers"
- Add original visuals, screenshots, and data — AI cannot synthesize these, so they prove authenticity
- Ensure author bios establish subject-matter relevance on every content page

**AI Bot Access:**
- Verify robots.txt explicitly allows GPTBot (ChatGPT), PerplexityBot, and Claude-Web
- Block Google-Extended and CCBot only if you want to prevent AI training (not citation)

**Citation-Worthy Page Formats:**
- Ultimate guides consolidating a topic into one authoritative resource
- "[Topic] Statistics (2026)" pages centralizing referenceable data
- "Best [Category] Tools Compared" with explicit comparison tables
- FAQ pages with direct, quotable answers (not marketing fluff)

**Key test:** "If your content can't answer a question clearly in 30 seconds, AI engines won't select it for generated answers."

## Key Principle

**Fix, don't just audit.** Every finding should have a concrete fix applied. Every content page should have a strategy to be cited by AI.
