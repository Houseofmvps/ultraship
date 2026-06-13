# Distribution & Marketplace Listings

How Ultraship reaches users, and the exact steps to list it in every relevant catalog. The submissions below require accounts/web forms, so they're **owner actions** (run them yourself) — everything in the repo is already marketplace-ready.

Verified against the Claude Code docs (June 2026). Commands and URLs were checked, not assumed.

---

## 1. Install today (self-hosted marketplace — already live)

Ultraship ships its own marketplace (`.claude-plugin/marketplace.json`, `source: "./"`), so anyone can install straight from GitHub right now:

```shell
claude plugin marketplace add Houseofmvps/ultraship
claude plugin install ultraship
```

This is the canonical install path and needs no third-party approval. The README leads with it.

---

## 2. Pre-submission checklist (do once)

- [ ] `claude plugin validate .` passes (the review pipelines run the same check). ✅ currently passing.
- [ ] `version` is set explicitly in `plugin.json` so users only get updates on a bump (not every commit). ✅
- [ ] Repo is public, with a README that has install + usage. ✅
- [ ] `npm test` green and the working tree committed/pushed (catalogs pin a commit SHA).
- [ ] `homepage`, `repository`, `license`, `author` populated in both manifests. ✅

---

## 3. Anthropic community marketplace (`claude-community`)

Third-party submissions land here after automated validation + safety screening. Approved plugins are pinned to a commit SHA in [`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community); CI bumps the pin as you push new commits, and the public catalog syncs nightly.

**Submit via one of the in-app forms:**

- **Console (individual authors):** https://platform.claude.com/plugins/submit
- **claude.ai (Team/Enterprise orgs with directory-management access):** https://claude.ai/admin-settings/directory/submissions/plugins/new

Run `claude plugin validate .` locally first — it's the same gate. After approval, confirm it's installable by searching for `ultraship` in the [community catalog `marketplace.json`](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json).

Users then install with:

```shell
/plugin marketplace add anthropics/claude-plugins-community
/plugin install ultraship@claude-community
```

> **Official marketplace (`claude-plugins-official`):** curated by Anthropic at their discretion. There is no application process and the submission form does **not** add to it. If Anthropic includes Ultraship, our CLI can prompt users to install it (see "Recommend your plugin from your CLI" / plugin-hints).

---

## 4. ClaudePluginHub (largest third-party directory)

Auto-discovers valid public plugins from GitHub Code Search, but indexing can lag days for new/low-activity repos, so submit directly:

- **Submit:** https://www.claudepluginhub.com/tools/submit-plugin (paste the GitHub URL `https://github.com/Houseofmvps/ultraship`)
- **Then claim ownership** to get the verified badge, analytics, and listing edits.

---

## 5. claudemarketplaces.com

Another public directory that indexes Claude Code plugins/marketplaces. Submit the GitHub URL via its directory submission, or rely on auto-indexing once the repo is public and validates.

---

## 6. Optional growth levers (not blocking)

- **CLI install hint (plugin-hints):** `bin/ultraship.mjs` could print a one-line "install the Claude Code plugin" hint when run standalone, nudging npx users toward the full plugin. See the Claude Code `plugin-hints` docs.
- **Keep the listing fresh:** catalogs surface "Last updated" and a context-cost estimate. Shipping regularly and keeping the plugin lean (zero deps, deferred MCP) both help ranking and the install decision.
- **README social proof:** add the GitHub stars badge and the `claude plugin marketplace add` command above the fold (already present).

---

## Where each path sends users

| Catalog | Add command / URL | Approval |
|---|---|---|
| Self-hosted (ours) | `claude plugin marketplace add Houseofmvps/ultraship` | none — live now |
| Anthropic community | `/plugin marketplace add anthropics/claude-plugins-community` → `@claude-community` | automated validation + safety screen |
| Anthropic official | auto-available; `@claude-plugins-official` | Anthropic's discretion, no application |
| ClaudePluginHub | https://www.claudepluginhub.com/tools/submit-plugin | auto-discovery + optional claim |
| claudemarketplaces.com | directory submission / auto-index | auto-index |
