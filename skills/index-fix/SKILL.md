---
name: index-fix
description: Diagnose and fix non-indexed pages using GSC and Bing Webmaster data. Finds exactly why each page isn't indexed and applies the fix.
---

# Index Fix — Get Every Page Indexed

Diagnose why pages aren't indexed in Google and Bing, fix the root causes, and resubmit for indexing. This skill uses real data from GSC URL Inspection API and Bing Webmaster Tools — no guessing.

**Goal: 100% index coverage. Every page in your sitemap should be indexed.**

## Phase 1: Credential Check

Verify data sources:
1. **GSC** (required): `ULTRASHIP_GSC_CREDENTIALS` or `ULTRASHIP_GSC_ACCESS_TOKEN`
2. **Bing** (recommended): `ULTRASHIP_BING_KEY`

If GSC is not configured, show setup guide and stop — GSC is required for URL inspection.

## Phase 2: Index Coverage Overview

Get the current index state:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/index-doctor.mjs coverage <site-url>
```

This shows:
- Total pages submitted via sitemaps
- Total pages indexed
- Index rate percentage
- Health status (HEALTHY/WARNING/CRITICAL)

## Phase 3: Cross-Engine Comparison

If Bing key is available:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/index-doctor.mjs compare <site-url> <sitemap-url>
```

Compare Google vs Bing indexing to find:
- Pages indexed by Google but not Bing (submit to Bing)
- Pages indexed by Bing but not Google (investigate Google issues)
- Overall gap analysis

## Phase 4: Diagnose Non-Indexed Pages

Run the full diagnosis:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/index-doctor.mjs diagnose <site-url> <sitemap-url>
```

This inspects up to 50 URLs via GSC URL Inspection API and reports:
- Which pages are indexed vs not
- The specific reason each page isn't indexed
- Severity rating (critical/high/medium/low)
- Exact fix for each issue

### Common Non-Indexing Reasons and Fixes:

**Blocked by robots.txt** (critical):
- Find the Disallow rule in robots.txt that blocks the URL path
- Remove or modify the rule using the Edit tool
- Verify the fix: the page should be crawlable

**Noindex tag** (critical):
- Find `<meta name="robots" content="noindex">` in the page HTML
- Remove the noindex directive using the Edit tool
- Check for X-Robots-Tag header in server config

**Soft 404** (high):
- Google thinks the page looks empty or error-like
- Add substantial unique content (minimum 300 words)
- Ensure the page returns HTTP 200 with real content
- Remove any empty state or placeholder content

**Crawled but not indexed** (high):
- Google found the page but decided not to index it
- Usually means content is too thin, duplicate, or low quality
- Add more unique, valuable content
- Build 3+ internal links pointing to this page
- Differentiate from similar pages on the site

**Discovered but not crawled** (medium):
- Google knows the URL exists but hasn't visited it yet
- Build internal links from high-traffic pages
- Submit directly for indexing
- Usually resolves within 1-2 weeks

**Redirect** (medium):
- Page redirects to another URL
- Update sitemap and internal links to use the final destination URL
- Remove the redirecting URL from sitemap

**Canonical mismatch** (medium):
- Google chose a different canonical URL
- Either fix the canonical tag to point to this URL, or accept Google's choice
- Remove from sitemap if it's truly a duplicate

**Server error** (critical):
- Page returns 5xx error when Google crawls it
- Fix the server error (check logs)
- Ensure the page loads correctly under load

**404 Not Found** (high):
- Page doesn't exist anymore
- Remove from sitemap
- Set up 301 redirect to relevant page

## Phase 5: Apply Fixes

For each diagnosed issue, apply the fix:

**robots.txt fixes:**
- Read the current robots.txt
- Edit to remove/modify blocking rules
- Ensure important paths are not blocked

**noindex fixes:**
- Search HTML files for noindex tags
- Remove them using Edit tool

**Content quality fixes:**
- Identify thin pages (<300 words)
- Flag for content expansion
- Cannot auto-generate content, but can restructure and add schema

**Sitemap cleanup:**
- Remove 404 and redirect URLs from sitemap
- Regenerate if needed:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/sitemap-generator.mjs <dir> <base-url>
```

**Internal linking:**
- Find high-traffic pages (from GSC query data)
- Add contextual links from high-traffic pages to non-indexed pages
- Use descriptive anchor text with target keywords

## Phase 6: Resubmit for Indexing

After fixes, submit to both search engines:

**Google:**
```bash
# Resubmit sitemap
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs submit-sitemap <site-url> <sitemap-url>
```

**Bing:**
```bash
# Submit sitemap
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-sitemap <site-url> <sitemap-url>

# Batch submit specific fixed URLs for fast indexing
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-url-batch <site-url> <url1> <url2> ...
```

## Phase 7: Auto-Fix and Resubmit

Run the auto-fix command which diagnoses AND submits non-indexed URLs:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/index-doctor.mjs fix <site-url> <sitemap-url>
```

This automatically:
1. Inspects all sitemap URLs
2. Identifies non-indexed pages
3. Submits fixable URLs to Bing for re-indexing
4. Returns a prioritized fix plan

## Phase 8: Verification Plan

After applying fixes:
1. Re-run coverage check to compare before/after
2. Set a reminder to re-check in 1-2 weeks (Google re-crawl takes time)
3. Monitor GSC for new indexing issues

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/index-doctor.mjs coverage <site-url>
```

## Phase 9: Prevention

Advise on preventing future indexing issues:
- Always test new pages for noindex tags before deploying
- Keep sitemap updated (auto-generate on deploy)
- Monitor robots.txt changes
- Ensure all pages have unique, substantial content
- Build internal links to every new page
- Submit sitemap to both GSC and Bing after every deploy

## Key Principles

1. **Diagnose before fixing** — understand WHY each page isn't indexed
2. **Fix the root cause** — don't just resubmit, fix the underlying issue
3. **Both engines matter** — Bing powers ChatGPT Search, DuckDuckGo, Yahoo
4. **100% is the target** — every page in your sitemap should be indexed
5. **Prevention > cure** — set up processes to catch issues before they happen
