---
description: Content quality analysis (readability, keyword density, GEO scoring)
---

Run the content scorer on this project:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/content-scorer.mjs <project-directory>
```

If the user provides a target keyword, include it:
```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/content-scorer.mjs <project-directory> --keyword=<keyword>
```

Present findings grouped by page, sorted by score (worst first). For each page report: word count, readability score (Flesch-Kincaid), keyword density (if keyword provided), and content quality issues. Suggest specific fixes for low-scoring pages.
