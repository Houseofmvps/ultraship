---
description: Static analysis for backend performance anti-patterns (N+1 queries, sync I/O, memory leaks)
---

Run the code profiler on this project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/code-profiler.mjs <project-directory>
```

Report findings grouped by category: N+1 queries, synchronous I/O in handlers, unbounded database queries, missing indexes, memory leak patterns, sequential awaits, and error handling gaps. For each finding, show the file, line number, and specific fix recommendation.

If an LSP server is connected (check your tools for a language server), use `find references` on each flagged function to confirm how often the hot path is actually called and whether the anti-pattern is real before recommending a fix. A loop that looks like an N+1 but is called once at startup is not worth refactoring. The static profiler flags candidates; the LSP confirms impact.
