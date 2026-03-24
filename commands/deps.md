---
description: Detect unused and outdated dependencies
---

Run the dependency doctor on this project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/dep-doctor.mjs <project-directory>
```

Report unused production dependencies (safe to remove), unused dev dependencies (likely removable), pinned versions that should use ^, and significantly outdated packages. For each unused dependency, confirm it's truly unused before recommending removal.
