#!/usr/bin/env node
// tools/gsc-client.mjs
// Usage: node tools/gsc-client.mjs <command> <url>
// Commands: submit-sitemap, check-indexing
// Requires: ULTRASHIP_GSC_KEY environment variable

if (!process.env.ULTRASHIP_GSC_KEY) {
  console.log(JSON.stringify({ error: 'No API key configured. Set ULTRASHIP_GSC_KEY in environment.', success: false }));
  process.exit(0);
}

console.log(JSON.stringify({ error: 'GSC integration coming in v1.1.', success: false }));
