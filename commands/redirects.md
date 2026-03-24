---
description: Check URLs for redirect chains, loops, and mixed HTTP/HTTPS
---

Ask the user for URLs to check, or use their sitemap:

**Individual URLs:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/redirect-checker.mjs <url1> <url2> ...
```

**From sitemap:**
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/redirect-checker.mjs --sitemap=<sitemap-url-or-path>
```

Report: redirect chains (should be single hop), loops (critical), mixed HTTP/HTTPS (should all be HTTPS), and 302s that should be 301s for SEO value transfer.
