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

### Step 3b: Authentication & Authorization Review

Scan the codebase for auth-related weaknesses. These are the most exploited vulnerability class in web applications — a single flaw here typically means full account takeover.

- **Hardcoded CORS origins**: Grep for `Access-Control-Allow-Origin: *` or `origin: '*'` or `cors({ origin: true })`. An allow-all CORS policy lets any malicious site make authenticated requests on behalf of your users. The fix is an explicit allowlist of trusted origins, never a wildcard when credentials are involved.
- **Missing rate limiting on auth endpoints**: Identify login, register, password reset, and OTP verification routes. If there is no rate limiter middleware (e.g., `express-rate-limit`, Hono `rateLimiter`, Redis-backed sliding window), these endpoints are vulnerable to credential stuffing and brute force. Recommend per-IP and per-account limits (e.g., 5 attempts per minute per IP on login, 3 password resets per hour per email).
- **JWT without expiry or weak signing**: Grep for `jwt.sign` and check for missing `expiresIn` option — a token without expiry is a permanent credential. Check for `HS256` with secrets shorter than 256 bits (32 bytes); attackers can brute-force short HS256 secrets offline. Recommend RS256/ES256 for production, or HS256 with a cryptographically random secret of at least 32 bytes. Also check that `jwt.verify` does not pass `algorithms: ['none']` or accept unsigned tokens.
- **Session fixation**: After successful authentication, the session ID must be regenerated. Grep for session assignment after login — if the same session ID persists from before auth to after, an attacker who sets a known session ID (via URL parameter, cookie injection, or subdomain cookie) gains access once the victim logs in.
- **Missing CSRF protection**: Identify state-changing endpoints (POST, PUT, DELETE, PATCH). If there is no CSRF token validation, no `SameSite=Strict` or `SameSite=Lax` cookie attribute, and no custom header requirement (e.g., `X-Requested-With`), these endpoints are exploitable via cross-site request forgery. SPAs using `Authorization: Bearer` headers are inherently CSRF-safe, but cookie-based auth requires explicit protection.
- **Privilege escalation via IDOR**: Look for routes like `/api/users/:id`, `/api/orders/:id`, `/api/invoices/:id` where the ID comes from the URL or request body. If the handler does not verify that the authenticated user owns or has permission to access that resource (e.g., `WHERE id = :id AND userId = :currentUser`), any authenticated user can access any other user's data by changing the ID. This is consistently in the OWASP Top 10 as "Broken Access Control."

### Step 3c: Input Validation & Injection

Scan for injection vectors beyond basic SQL concatenation. Injection flaws remain the most dangerous vulnerability class because they allow attackers to execute arbitrary operations within your application's context.

- **SQL injection (beyond concatenation)**: Look for template literals in queries (`\`SELECT * FROM users WHERE id = ${id}\``), string building with `+` operators near SQL keywords, and ORM raw query methods (`knex.raw()`, `prisma.$queryRawUnsafe()`, `sequelize.query()` without bind parameters). Even ORMs are vulnerable when developers use raw query escape hatches.
- **Path traversal**: Grep for user input flowing into `fs.readFile`, `fs.readFileSync`, `fs.createReadStream`, `path.join`, `path.resolve`, or `res.sendFile`. If the input is not validated against `../` sequences (or null bytes on older Node versions), attackers can read arbitrary files from the server — `/etc/passwd`, `.env`, private keys. The fix is to resolve the path and verify it starts with the intended base directory.
- **Command injection**: Grep for `child_process.exec`, `child_process.execSync`, `shell: true` in spawn options, or any function that passes user input to a shell. An attacker who controls even part of a shell command can chain arbitrary commands with `;`, `&&`, `|`, or backticks. The fix is `execFile`/`execFileSync` (no shell) with arguments as an array, never string interpolation.
- **Server-Side Request Forgery (SSRF)**: Look for user-provided URLs passed to `fetch`, `axios`, `http.get`, or any HTTP client. Without validation, an attacker can make your server request internal services (`http://169.254.169.254` for cloud metadata, `http://localhost:6379` for Redis, internal microservices). Validate that URLs resolve to public IP addresses and use an allowlist of permitted schemes and hosts.
- **XML External Entity (XXE)**: If the project uses XML parsing (`xml2js`, `libxmljs`, `fast-xml-parser`, `DOMParser`), check that external entity processing is disabled. XXE allows attackers to read local files, perform SSRF, or cause denial of service via billion-laughs expansion. Most modern parsers disable XXE by default, but verify the configuration explicitly.
- **Prototype pollution**: Grep for `Object.assign({}, userInput)`, `_.merge({}, userInput)`, `_.defaultsDeep`, `JSON.parse` results used in deep merge operations, and `__proto__` or `constructor.prototype` in request bodies. Prototype pollution lets attackers inject properties into Object.prototype, which can escalate to RCE in some frameworks (e.g., via EJS template engine gadgets). The fix is `Object.create(null)` for dictionary objects, input schema validation, and `Object.freeze(Object.prototype)` in hardened environments.

### Step 3d: Supply Chain Security

Modern applications pull in hundreds of transitive dependencies. A single compromised package in the dependency tree can execute arbitrary code on every developer machine and CI server.

- **Postinstall scripts**: Run `npm pkg get scripts.postinstall` or grep lockfile for `"postinstall"` hooks in dependencies. Malicious packages use postinstall scripts to exfiltrate environment variables, SSH keys, or install backdoors. Legitimate packages that need postinstall (e.g., `esbuild`, `sharp` for native binaries) should be audited individually.
- **Typosquatting**: Compare dependency names against known popular packages. Look for single-character transpositions (`lodas` vs `lodash`), scope confusion (`@internal/utils` vs `internal-utils`), and hyphen/underscore variants. Typosquatted packages typically mirror the real package's API while adding a backdoor.
- **Unmaintained dependencies**: Flag dependencies with no npm publish in over 2 years or GitHub repos archived/with no commits. Unmaintained packages will not receive security patches. Recommend alternatives or evaluate whether the dependency can be replaced with a small internal utility.
- **Lockfile integrity**: Verify that the lockfile exists and is consistent with `package.json`. A missing or manipulated lockfile means builds are not reproducible and dependency resolution could pull in malicious versions. Run `pnpm install --frozen-lockfile` (or `npm ci`) in CI to enforce lockfile integrity.
- **CI hardening**: Recommend `npm config set ignore-scripts true` in CI environments, then explicitly allowlist packages that need install scripts. This prevents supply chain attacks via postinstall hooks from newly added or compromised dependencies.

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

### Step 5b: Cryptography Review

Weak or misused cryptography is often invisible until a breach. These checks catch the most common mistakes that silently undermine the security of authentication, token generation, and data protection.

- **Deprecated hash algorithms**: Grep for `createHash('md5')`, `createHash('sha1')`, or any use of MD5/SHA1 for security purposes (password hashing, token generation, integrity verification). MD5 has practical collision attacks; SHA1 is deprecated by NIST since 2011. These are acceptable only for non-security checksums (e.g., cache keys, ETags). For integrity, use SHA-256 or SHA-3. For passwords, use bcrypt or argon2 exclusively.
- **Hardcoded encryption keys and IVs**: Grep for `createCipheriv`, `createDecipheriv`, and check whether the key or IV is a string literal, hex constant, or imported from a non-env source. Hardcoded keys mean every deployment shares the same key, and anyone with source code access (including leaked repos) can decrypt all data. Keys must come from environment variables or a secrets manager, and IVs must be randomly generated per encryption operation.
- **Insecure random for security tokens**: Grep for `Math.random()` used anywhere near token generation, session IDs, OTP codes, password reset links, or API keys. `Math.random()` is not cryptographically secure — its output is predictable given enough samples. The fix is `crypto.randomBytes()` or `crypto.randomUUID()` for Node.js, or `crypto.getRandomValues()` for browser contexts.
- **Weak password hashing**: If the application stores passwords, verify it uses bcrypt (cost factor >= 12), argon2id, or scrypt. Grep for `createHash` used on passwords — this means passwords are hashed with a fast algorithm (SHA-256, MD5) without salting or key stretching, making them trivially crackable with rainbow tables or GPU brute force. Also check bcrypt cost factors below 10, which are insufficient for modern hardware.

### Step 5c: Data Exposure

Data leakage is the silent breach — it does not trip alarms, does not require exploits, and often goes unnoticed until the data appears on a paste site. These checks catch the most common ways applications hemorrhage sensitive information.

- **Stack traces in production error responses**: Check error handling middleware for `NODE_ENV` conditional logic. If `err.stack`, `err.message`, or raw error objects are sent in HTTP responses without checking the environment, attackers get free reconnaissance — internal file paths, framework versions, database connection strings, and query structures. The fix is a generic error response in production with a correlation ID for internal log lookup.
- **PII in logs**: Grep for `console.log`, `logger.info`, `logger.debug`, and logging library calls that include request bodies, user objects, or variables named `email`, `phone`, `password`, `ssn`, `token`, `secret`, `creditCard`, or `ip`. Logs are often stored in plain text, shipped to third-party log aggregators, and retained long past their usefulness. Recommend structured logging with explicit field allowlists and automatic PII redaction.
- **Internal fields in API responses**: Check API response serialization — if the application returns full database objects (e.g., `res.json(user)` where `user` is a Drizzle/Prisma/Sequelize model), it likely leaks internal fields: `passwordHash`, `resetToken`, `internalNotes`, `stripeCustomerId`, `createdAt` metadata, or soft-delete flags. The fix is explicit response DTOs or `select`/`pick` at the query level — never return the raw model.
- **Missing Content-Security-Policy**: A missing or overly permissive CSP is the difference between "XSS vulnerability found" and "XSS vulnerability exploited." Check for `unsafe-inline`, `unsafe-eval`, and wildcard sources (`*`) in existing CSPs. A baseline CSP should at minimum set `default-src 'self'`, `script-src 'self'`, and `object-src 'none'`. Report-only mode (`Content-Security-Policy-Report-Only`) is a safe way to deploy CSP incrementally without breaking existing functionality.

### Step 6: Apply Fixes

- Auto-fix safe dependency updates
- Add .env to .gitignore if missing
- Replace dangerous patterns with safe alternatives
- Generate security header middleware file
- Remove confirmed unused dependencies

## Key Principle

**Think like an attacker.** For every endpoint, ask: "What happens if I send unexpected input?" For every data flow, ask: "What if this is intercepted?" For every dependency, ask: "What if this is compromised?" Fix what you find. Document what you can't fix. Treat security as a spectrum, not a checkbox.
