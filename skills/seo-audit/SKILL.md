---
name: seo-audit
description: Run SEO audit (39 rules) with AI visibility checks — GEO (20 rules for AI bot access, snippet restrictions) and AEO (4 schema checks). Auto-fix included. Use when user wants to check or improve search visibility.
argument-hint: "<url-or-directory>"
allowed-tools: Bash, Read, Edit, Grep, Glob
paths: ["**/*.html", "**/index.html", "**/*.htm"]
---

# SEO Audit + AI Visibility

Search optimization audit with AI visibility signals. Finds issues AND fixes them.

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

### Phase 4: Search Engine Registration (GSC + Bing)

**Google Search Console** (requires ULTRASHIP_GSC_CREDENTIALS):
```bash
# Submit sitemap
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs submit-sitemap <site-url> <sitemap-url>

# Check if pages are indexed
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs inspect-url <site-url> <page-url>

# See what keywords you rank for
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs query <site-url> 28

# List all submitted sitemaps
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs list-sitemaps <site-url>
```

**Bing Webmaster Tools** (requires ULTRASHIP_BING_KEY):
```bash
# Submit sitemap (also powers DuckDuckGo + ChatGPT Search)
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-sitemap <site-url> <sitemap-url>

# Submit specific URLs for fast indexing
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-url <site-url> <page-url>

# Batch submit multiple URLs
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-url-batch <site-url> <url1> <url2> ...

# Check URL traffic
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs url-info <site-url> <page-url>
```

If credentials are not set, show setup instructions from the tool's error output. Do NOT skip this phase — submitting sitemaps to both GSC and Bing is critical for indexing speed.

**Why Bing matters for AI search:** Bing's index powers ChatGPT Search, DuckDuckGo, and Yahoo. Submitting your sitemap to Bing directly improves AI search visibility.

### Phase 4b: Content Quality Analysis

Run content scoring on all pages:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/content-scorer.mjs <project-directory>
```

For pages with a known target keyword:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/content-scorer.mjs <project-directory> --keyword=<keyword>
```

Report readability scores (Flesch-Kincaid), keyword density, thin content, and GEO heading optimization.

### Phase 4c: Social Preview Validation

Validate Open Graph tags and image accessibility:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/og-validator.mjs <project-directory>
```

Fix missing OG tags, broken OG images, and oversized preview images.

### Phase 4d: Redirect Audit

If a production URL is available, check for redirect chains:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/redirect-checker.mjs --sitemap=<sitemap-url>
```

Fix redirect chains (consolidate to single hop), convert 302s to 301s, and resolve mixed HTTP/HTTPS.

### Phase 5: Verify

Re-run the scanner to confirm fixes and report before/after scores.

Save scores for historical comparison:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> seo <score>
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> geo <score>
node ${CLAUDE_PLUGIN_ROOT}/tools/audit-history.mjs save <project-dir> aeo <score>
```

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

### Phase 7: Content Audit Framework

For SEO specialists working on client sites, provide a content audit after the technical scan:

**Content Health Assessment:**
- Flag pages with <300 words as thin content — recommend consolidation or expansion
- Identify pages with duplicate titles/descriptions — each page must be unique
- Find orphan pages (0 internal links pointing to them) — add links or consider removing
- Check internal link distribution — important pages should have 3+ internal links

**Competitor Gap Analysis Guidance:**
After technical fixes, advise the user to:
1. Search their top 5 target keywords in ChatGPT, Perplexity, and Google AI Overviews
2. Note which competitors are cited — study their content structure
3. Identify topics competitors cover that the client site doesn't
4. Create "definitive answer" content for each gap — direct, structured, quotable

**Content Update/Consolidate/Delete Decision Framework:**
For each existing content page, recommend one of:
- **Update**: Has traffic potential but content is outdated or thin → refresh with current data
- **Consolidate**: Multiple pages targeting the same keyword → merge into one authoritative page
- **Delete/Redirect**: Zero traffic, zero backlinks, no strategic value → 301 redirect to relevant page
- **Leave**: Performing well, no changes needed

**Page Speed Budget by Page Type:**
- Landing pages / homepage: target Lighthouse 90+
- Blog posts / content pages: target Lighthouse 85+
- Dashboards / app pages: target Lighthouse 70+ (not search-indexed)
- API-only backends: skip Lighthouse entirely

### Phase 8: Domain Authority & Backlink Strategy

Ultraship cannot check backlinks (requires paid APIs like Ahrefs/Semrush with massive crawl indexes). Instead, provide strategic guidance that a $10K/month SEO consultant would give:

**Internal Link Optimization (we CAN automate):**
The scanner already detects orphan pages and pages with zero internal links. After fixing those:
- Ensure every important page has 3+ internal links pointing to it
- Use descriptive anchor text with keywords (not "click here" or "read more")
- Add contextual links within content, not just navigation
- Create hub pages that link to all related content (topic clusters)

**Backlink Acquisition Strategy (guidance for user):**

*High-value link building tactics (ranked by ROI):*
1. **Create link-worthy assets** — original research, data studies, industry surveys, free tools, calculators. These attract natural links.
2. **Guest posting** — write for authoritative sites in your niche. One link from a DR60+ site > 100 links from spam sites.
3. **Broken link building** — find broken links on competitor sites, offer your content as replacement.
4. **HARO/Qwoted/Featured** — respond to journalist queries to earn media mentions with backlinks.
5. **Competitor backlink analysis** — use Ahrefs/Semrush free trials to find where competitors get links, then target the same sources.
6. **Strategic partnerships** — co-create content with complementary businesses, cross-link naturally.

*What NOT to do:*
- Never buy links (Google penalizes this)
- Never use PBNs (private blog networks)
- Never spam forum/comment links
- Never use automated link building tools

**Domain Authority Monitoring (guidance for user):**
- Check DA/DR monthly via free Ahrefs Webmaster Tools or Moz free tier
- Track referring domains, not just total backlinks (10 links from 10 domains > 100 links from 1 domain)
- Monitor for toxic backlinks quarterly and disavow via GSC if needed

## Key Principle

**Fix, don't just audit.** Every finding should have a concrete fix applied. Every content page should have a strategy to be cited by AI. Every client engagement should include technical fixes + content audit + backlink strategy.
