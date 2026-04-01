---
name: index-fix
description: Diagnose and fix non-indexed pages using GSC and Bing Webmaster data. Finds exactly why each page isn't indexed and applies the fix.
argument-hint: "<site-url>"
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Index Fix — Get Every Page Indexed

Diagnose why pages aren't indexed in Google and Bing, fix the root causes, and resubmit for indexing. This skill uses real data from GSC URL Inspection API and Bing Webmaster Tools — no guessing.

**Goal: 100% index coverage for pages that SHOULD be indexed. Not every URL belongs in the index — staging pages, admin panels, thin pagination, and intentionally private content should stay excluded.**

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
- **FIRST: Determine if the block is intentional.** Common legitimate reasons to block:
  - Admin/dashboard pages, staging environments, internal tools
  - User-generated content pages, search result pages, faceted navigation
  - API endpoints, health check routes
- If the block is intentional, do NOT remove it — remove the page from the sitemap instead
- If the block is unintentional, find the Disallow rule and modify it using the Edit tool
- Verify the fix: the page should be crawlable

**Noindex tag** (critical):
- **FIRST: Determine WHY noindex was added.** Common legitimate reasons:
  - Staging/preview pages, paginated archives, tag/category pages
  - Thank-you/confirmation pages with sensitive info
  - Legal/compliance requirements, duplicate content by design
  - Pages that should only be accessible via direct link
- **Ask the user before removing noindex** — removing it from staging or admin pages can expose sensitive content to search engines
- If removal is confirmed appropriate, find `<meta name="robots" content="noindex">` in the page HTML
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

**⚠️ SAFETY FIRST: Before applying ANY fix, verify the block/exclusion wasn't intentional. Ask the user if unsure. Removing noindex from staging pages or robots.txt Disallow from admin paths can expose sensitive content.**

For each diagnosed issue, apply the fix:

**robots.txt fixes:**
- Read the current robots.txt
- **Check if the Disallow rule protects staging, admin, or private pages** — if so, remove the page from the sitemap instead of unblocking it
- Only edit rules that are clearly unintentional blocks on public content
- Ensure important public paths are not blocked

**noindex fixes:**
- **Verify with the user that the page should be public** before removing noindex
- Search HTML files for noindex tags
- Remove them using Edit tool only after confirming they're not protecting sensitive content

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

**Only resubmit pages where you've made SUBSTANTIAL fixes** (added content, removed blocking directives, fixed server errors). Do NOT resubmit unchanged pages — this wastes API quota and can flag your account for spam.

After fixes, submit to both search engines:

**Google:**
```bash
# Resubmit sitemap (only after sitemap changes)
node ${CLAUDE_PLUGIN_ROOT}/tools/gsc-client.mjs submit-sitemap <site-url> <sitemap-url>
```

**Bing:**
```bash
# Submit sitemap (only after sitemap changes)
node ${CLAUDE_PLUGIN_ROOT}/tools/bing-webmaster.mjs submit-sitemap <site-url> <sitemap-url>

# Batch submit specific fixed URLs for fast indexing (max 500/day — only URLs you actually fixed)
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
2. **Verify intent before removing blocks** — noindex and robots.txt Disallow rules are often intentional (staging, admin, privacy, legal). Ask before removing.
3. **Fix the root cause** — don't just resubmit, fix the underlying issue
4. **Both engines matter** — Bing powers ChatGPT Search, DuckDuckGo, Yahoo
5. **Only submit pages you've actually fixed** — resubmitting unchanged pages wastes quota and can trigger spam flags
6. **Prevention > cure** — set up processes to catch issues before they happen

## Rollback Plan

If fixes cause unexpected issues (pages appearing in search that shouldn't, traffic drops):
1. **Re-add noindex** to any pages that were incorrectly unblocked
2. **Restore robots.txt** Disallow rules that were removed in error
3. **Remove pages from sitemap** that shouldn't be indexed
4. Re-run `coverage` to verify the rollback took effect
5. Google re-crawl may take 1-2 weeks — request re-crawl via GSC for urgent fixes
