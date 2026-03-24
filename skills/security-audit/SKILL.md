---
name: security-audit
description: Run security audit — dependency vulnerabilities, secret scanning, OWASP pattern detection, HTTP headers. Use when user wants to harden their project.
---

# Security Audit

Comprehensive security scan. Finds issues AND fixes them.

## Process

### Step 1: Dependency Audit

Detect package manager from lockfile and run audit:
- `pnpm-lock.yaml` → `pnpm audit`
- `package-lock.json` → `npm audit`
- `yarn.lock` → `yarn audit`

If critical/high vulnerabilities found, run the appropriate fix command (non-breaking only):
```bash
pnpm audit --fix  # or npm audit fix
```

### Step 2: Secret Scanning

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/secret-scanner.mjs <project-directory>
```

For any findings:
- Flag the file and line number with severity
- Suggest moving secrets to environment variables
- Check if the file should be in .gitignore
- If .env is committed, add it to .gitignore

### Step 3: OWASP Pattern Detection

Use Grep to scan source files for dangerous patterns:

```
eval(                    → Suggest safer alternatives
new Function(            → Suggest safer alternatives
.innerHTML =             → Suggest textContent or sanitized HTML
dangerouslySetInnerHTML  → Verify sanitization
SQL + variable           → Suggest parameterized queries
http://                  → Suggest https:// (mixed content)
```

### Step 4: HTTP Security Headers

If a dev server is running, use curl or fetch to check response headers:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Referrer-Policy

If missing, generate middleware snippet for the project's framework:
- **Hono**: `app.use('*', secureHeaders())`
- **Express**: helmet middleware
- **Next.js**: next.config.js headers

### Step 5: Dependency Health

```bash
node ${CLAUDE_PLUGIN_ROOT}/tools/dep-doctor.mjs <project-directory>
```

Report:
- **Unused production deps** → recommend removal (reduces attack surface + install size)
- **Unused dev deps** → suggest cleanup
- **Pinned versions** → suggest using ^ for patch updates
- **Outdated major versions** → flag security risk of old packages

### Step 6: Apply Fixes

- Auto-fix safe dependency updates
- Add .env to .gitignore if missing
- Replace dangerous patterns with safe alternatives
- Generate security header middleware file
- Remove confirmed unused dependencies

## Key Principle

**Fix, don't just audit.** Apply every safe fix automatically.
