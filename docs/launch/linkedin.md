# LinkedIn Launch Post

I built a free tool that tells you if your SaaS is ready to ship.

One command. 5 tools in parallel. 60+ SEO rules. Import graph analysis. Monorepo support.

Here's why I built it:

As a solo founder, I was deploying and praying. No SEO check. No security scan. No dependency audit. Just "looks good" and git push.

So I built Ultraship — a Claude Code plugin that runs a full pre-deploy quality gate:

→ SEO/GEO/AEO: 60+ rules including AI search optimization (llms.txt, question headings, structured data)
→ Security: secret scanning for AWS, Stripe, GitHub tokens, private keys
→ Code Quality: N+1 queries, sync I/O, memory leaks, dead dependency detection via import graph
→ Bundle Size: build output analysis, heavy dependency alternatives

Ran it on my own production app (SaveMRR — pnpm monorepo, 5 packages):
→ Backend: 83/100 READY TO SHIP
→ Landing: 78/100 NEEDS WORK (33 dead deps found)

The scoring is honest — seed data loops are correctly deprioritized, not flagged as false critical issues. Dead shadcn/ui wrapper files are caught through actual import tracing, not string matching.

The best part? It works without Claude Code too:

npx ultraship ship .

22 skills. 20 tools. 1 dependency. 113 tests. MIT license.

Free forever. No pro tier. No paywalls.

If you build software, try it: github.com/Houseofmvps/ultraship

#buildinpublic #indiehacker #saas #claudecode #ai #opensource #devtools
