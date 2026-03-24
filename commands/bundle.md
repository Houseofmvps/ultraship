---
description: Track bundle size, detect heavy dependencies, compare to previous builds
---

Run the bundle tracker on this project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/bundle-tracker.mjs <project-directory> --save
```

Report: total bundle size, JS/CSS/image breakdown, largest files, heavy dependencies with lighter alternatives, and comparison to previous build (if history exists). Suggest code splitting for large chunks and alternative packages for heavy dependencies.
