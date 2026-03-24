---
description: Health check a production URL (status, response time, SSL, security headers)
---

Ask the user for their production URL if not provided, then run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/health-check.mjs <url>
```

Report the health status including: HTTP status code, response time, SSL certificate validity and days until expiry, redirect chain (if any), and missing security headers. Suggest fixes for any issues found.
