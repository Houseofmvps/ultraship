---
description: Static analysis for backend performance anti-patterns (N+1 queries, sync I/O, memory leaks)
---

Run the code profiler on this project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/code-profiler.mjs <project-directory>
```

Report findings grouped by category: N+1 queries, synchronous I/O in handlers, unbounded database queries, missing indexes, memory leak patterns, sequential awaits, and error handling gaps. For each finding, show the file, line number, and specific fix recommendation.
