---
name: architecture
description: "Living Architecture Map — auto-generate Mermaid diagrams of your codebase. Use when user wants to visualize architecture, understand code structure, generate diagrams, or document system design."
---

# Living Architecture Map

Auto-generates and maintains architecture diagrams from your actual code. Always up-to-date.

## Process

### Phase 1: Scan

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/architecture-mapper.mjs <project-directory>
```

Parse the JSON output for architecture data and diagrams.

### Phase 2: Present Diagrams

Display each Mermaid diagram with context:

**System Architecture:**
High-level view of all components and how they connect.
```mermaid
[system diagram from tool output]
```

**API Route Map:**
All endpoints organized by resource.
```mermaid
[routes diagram from tool output]
```

**Database Schema:**
Entity-relationship diagram of all tables and relations.
```mermaid
[database ER diagram from tool output]
```

**Data Flow:**
Sequence diagram showing how a typical request flows through the system.
```mermaid
[data flow diagram from tool output]
```

### Phase 3: Architecture Analysis

Based on the scanned data, provide analysis:

**Strengths:**
- Clear layer separation
- No circular dependencies
- Well-organized middleware chain

**Concerns:**
- Circular dependencies found (list them)
- Orphan modules (files imported by nothing)
- Large files that may need splitting
- Missing middleware (no auth, no rate limiting, etc.)

**Service Dependencies:**
List all external services and how they're used. Flag any that are single points of failure.

### Phase 4: Save Diagrams

Save architecture documentation:

1. Create `docs/architecture/` directory
2. Save `docs/architecture/ARCHITECTURE.md` with all diagrams
3. Save individual diagram files if needed

The document should be self-contained and renderable in GitHub (GitHub supports Mermaid in markdown).

### Phase 5: Recommendations

Based on architecture analysis:

1. **Circular dependencies** — suggest how to break cycles
2. **Orphan modules** — suggest removal or integration
3. **Missing patterns** — suggest middleware, error handling, or caching if absent
4. **Scalability concerns** — identify bottlenecks (single database, no caching, synchronous processing)

## Keeping Diagrams Updated

Recommend running `/architecture` after any significant structural change:
- Adding new API routes
- Adding new database tables
- Integrating new external services
- Major refactors

The diagrams are generated from code, so they're always accurate when re-run.

## Key Principle

**The map IS the territory.** Architecture diagrams that drift from reality are worse than no diagrams. Because these are auto-generated from code, they're always truthful.
