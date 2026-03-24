# Security Policy — Ultraship

## Architecture Security

Ultraship is designed for enterprise environments with zero-trust principles:

- **No persistent processes** — all tools are stateless CLI scripts, no background daemons
- **No native dependencies** — pure JavaScript (ESM), only dependency is `htmlparser2` (SAX parser)
- **No build step** — tools run directly via `node tools/<tool>.mjs`, no compiled binaries
- **No network listeners** — tools never bind ports or accept inbound connections
- **No telemetry** — zero data collection, no analytics, no phone-home

## Input Validation

### Shell Injection Prevention
All tools use `execFileSync` (not `execSync` or `exec`). This passes arguments as an array, bypassing shell interpolation entirely. There is no path from user input to shell execution.

### SSRF Protection
All tools that make HTTP requests validate URLs through `tools/lib/security.mjs`:
- **Scheme restriction**: Only `http:` and `https:` are allowed (blocks `file://`, `ftp://`, `gopher://`)
- **Private IP blocking**: Blocks `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (AWS/GCP metadata)
- **Cloud metadata blocking**: Blocks `metadata.google.internal` and known cloud metadata hostnames
- **Redirect SSRF protection**: Each redirect hop is validated — a public URL redirecting to `169.254.169.254` is blocked
- **Response size limits**: HTTP response bodies are capped at 5MB to prevent memory exhaustion

### File System Safety
- **File size limits**: All file reads check size first (10MB max) to prevent OOM on malicious files
- **Write scope**: Tools only write to `.ultraship/reports/` within the project directory
- **Restrictive permissions**: Written files use mode `0o600` (owner read/write only), directories use `0o700`
- **No path traversal**: All file operations use `path.resolve()` for canonical paths

### Secret Handling
- **Redaction**: `secret-scanner.mjs` redacts found secrets in output (shows first 8 chars only)
- **No value logging**: `env-validator.mjs` never includes actual env var values in output
- **Credential isolation**: API credentials (GSC, Bing) are read from environment variables only, never from files in the project

## Supply Chain

- **Pinned dependencies**: `htmlparser2` is the only runtime dependency, version-locked in `package.json`
- **Pinned tool versions**: Lighthouse is pinned to major version (`lighthouse@12`) to prevent auto-installing compromised packages
- **No postinstall scripts**: `package.json` has no lifecycle scripts
- **MIT licensed**: No viral copyleft obligations

## Tools by Risk Level

### Network-Facing (SSRF-protected)
| Tool | Makes Outbound Requests | SSRF Protection |
|------|------------------------|-----------------|
| `health-check.mjs` | Yes — user-provided URL | URL validation + private IP blocking |
| `api-smoke-test.mjs` | Yes — user-provided base URL | URL validation + response size limits |
| `redirect-checker.mjs` | Yes — follows redirect chains | Each hop validated, loop detection |
| `og-validator.mjs` | Yes — HEAD request to OG image URLs | URL validation before image check |
| `lighthouse-runner.mjs` | Yes — via headless Chrome | URL validation, pinned lighthouse version |
| `gsc-client.mjs` | Yes — Google Search Console API | Fixed hostname (googleapis.com only) |
| `bing-webmaster.mjs` | Yes — Bing Webmaster API | Fixed hostname (ssl.bing.com only) |

### File System (Read-only)
| Tool | Reads Files | Writes Files |
|------|------------|-------------|
| `seo-scanner.mjs` | HTML files in project | No |
| `content-scorer.mjs` | HTML files in project | No |
| `code-profiler.mjs` | JS/TS source files | No |
| `dep-doctor.mjs` | package.json + source files | No |
| `secret-scanner.mjs` | All tracked files via `git ls-files` | No |
| `env-validator.mjs` | `.env` files | No |
| `migration-checker.mjs` | ORM config + migration files | No |

### File System (Read + Write)
| Tool | Writes To |
|------|----------|
| `audit-history.mjs` | `.ultraship/reports/audit-history.json` |
| `bundle-tracker.mjs` | `.ultraship/reports/bundle-*.json` |
| `sitemap-generator.mjs` | `sitemap.xml` in project root |
| `robots-generator.mjs` | `robots.txt` in project root |
| `llms-txt-generator.mjs` | `llms.txt` and `llms-full.txt` |
| `structured-data-generator.mjs` | JSON-LD file in project |

### Shell Execution
| Tool | Executes | Safety |
|------|---------|--------|
| `secret-scanner.mjs` | `git ls-files` | `execFileSync` with hardcoded command |
| `lighthouse-runner.mjs` | `npx lighthouse` | `execFileSync`, pinned version, URL validated |

## Reporting Vulnerabilities

Report security issues to: houseofmvps2024@gmail.com

Include:
1. Tool name and version
2. Steps to reproduce
3. Impact assessment

We will respond within 48 hours and issue a fix within 7 days for critical issues.
