# Contributing to Ultraship

Thanks for wanting to contribute! Here's how to get started.

## Setup

```bash
git clone https://github.com/Houseofmvps/ultraship.git
cd ultraship
npm install
```

No build step. Tools are `.mjs` files you can run directly:

```bash
node tools/seo-scanner.mjs ./path/to/project
node tools/health-check.mjs https://example.com
```

## Project Structure

```
.claude-plugin/   Plugin manifest
skills/           33 skills (16 workflow + 7 specialist + 10 growth/launch/intelligence)
agents/           10 agents
commands/         28 slash commands
tools/            30 Node.js tools + shared security module
hooks/            Session-start hook (CLAUDE.md check + memory-first enforcement)
```

## Adding a New Tool

1. Create `tools/your-tool.mjs`
2. Output JSON to stdout, errors exit with code 0
3. If it makes HTTP requests, import and use `validateUrl()` from `tools/lib/security.mjs`
4. If it reads files, use `checkFileSize()` before `readFileSync()`
5. Use `execFileSync` (never `execSync`) for any subprocess calls
6. Add a corresponding command in `commands/`

## Security Requirements

All contributions must follow these rules:

- **No `execSync` or `exec`** — use `execFileSync` with array args
- **No raw HTTP requests** without SSRF validation via `tools/lib/security.mjs`
- **No unbounded file reads** — always check size first with `checkFileSize()`
- **No secret logging** — never include env var values in output
- **No new runtime dependencies** without discussion

## Submitting Changes

1. Fork the repo
2. Create a branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run the tools to verify they work
5. Submit a PR with a clear description

## Reporting Issues

Open an issue on GitHub with:
- What you expected
- What happened
- Steps to reproduce
- Your Node.js version
