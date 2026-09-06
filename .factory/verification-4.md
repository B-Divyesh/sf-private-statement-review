# Review downloaded bank CSVs privately — verification 4

**Verdict: FAIL**

- Findings: **1** — 0 P0, 0 P1, 1 P2, 0 P3
- Untested public claims: **1**
- Implementation candidate reviewed: `3ee3dcc34650e5f5a9e61a844e5411da1598a667`
- Documentation SHA reviewed: `a5cb5ad889116453c6f82dc4fac2faadd9c9e7ba`
- Live URL: <https://private-statement-review.sociobot.in>
- Verified: 6 September 2026 UTC
- Work order: `private-statement-review-verify-4`

The local-first CSV-review workflow, sample isolation, accessibility, routes, offline behavior, and all declared claims passed. This is not a release PASS because the public Terms page includes one refund-entitlement promise that has no declared, runnable claim proof. The current unregistered billing offer prevents independent validation of that promise.

## First screen before scrolling

- **Job:** “Review downloaded bank CSVs privately.”
- **Audience:** households that want monthly cash-flow and repeat-charge checks without linking a bank account.
- **First action:** “Try it with sample data”; the adjacent text says that it opens a ready two-month review.

Fresh 1440×900 desktop and 390×844 phone contexts loaded at scroll position zero with those items visible. Their title was `Private Statement Review — Review bank CSVs privately`; there was one `<h1>`, one `<main>`, and no console or page errors. Screenshots are in `/work/.evidence/verify-4/`.

## Finding

### F1 — P2 — Refund-revocation promise is an untested public claim

The public `/terms/` page says, “A refund revokes the license.” This is a concrete user-facing entitlement claim, but it is absent from `.factory/claims.json`; no declared claim command obtains a license, applies a refund/revocation fixture or live event, and proves that retained Plus access is relocked.

The billing dependency is real at verification time: the product checkout endpoint returns HTTP 404 (`{"error":"enabled factory product","status":404}`), while an invalid-token verification request returns the expected HTTP 200 invalid response. Hiding the checkout and saying purchase registration is pending on the landing page is correct and is not itself a defect. It does, however, mean the refund assertion cannot presently be independently verified. A mocked verification response alone does not prove a refund revocation reaches the product or removes access.

Required disposition: either remove or qualify the refund-revocation promise until the offer is registered, or add it to `claims.json` with an outcome-based recorded revocation fixture and test it after billing registration. Verify an issued/refunded license end to end before claiming PASS.

## Declared claim commands

All 24 commands declared in `.factory/claims.json` were run individually from fresh browser contexts and passed. The combined browser suite also passed 24/24. The declared claim IDs were:

`csv-import-formats`, `mapping-memory`, `local-persistence`, `merchant-rules`, `split-purchases`, `repeat-cadences`, `month-comparison`, `checklist-export`, `transaction-export`, `data-backup-controls`, `offline-reload`, `sample-demo`, `no-bank-connection`, `no-statement-upload`, `source-csv-default-discard`, `no-tracking`, `license-token-only`, `no-advice-or-cloud-ai`, `free-core`, `plus-price`, `plus-source-retention`, `plus-rule-limit`, `license-restore`, and `self-hosted-runtime`.

These cover the sample data, local storage separation, realistic populated output, reset, normal/invalid/boundary/recovery imports, local persistence, exports, privacy request logs, Plus fixtures, offline reload, and self-hosted runtime. They do not cover F1, so the untested public-claim count is one.

## Quality gates and live checks

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | 168 packages installed; 0 reported vulnerabilities |
| `npm run lint` | PASS | ESLint completed cleanly |
| `npm test` | PASS | 17 unit/config tests and 24 browser claims passed |
| each of 24 declared claim commands | PASS | each exited 0 in its own Playwright run |
| `npm run build` | PASS | `dist/index.html` produced; 85,015 B raw / 25,203 B gzip |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |
| local `npm run verify:browser` with documented preview server | PASS | keyboard, routes, recovery, Axe, exports and offline |
| live `PSR_TEST_URL=… npm run verify:browser` | PASS | same browser coverage against production |
| factory `verify-url.sh` | PASS | HTTP 200, title/lang/main/alt/button checks, 0 console errors |
| Axe CLI 4.13.0 | PASS | 0 violations on `/`, `/demo/`, `/privacy/`, and `/terms/` |

The first `verify:browser` invocation before starting the documented preview server correctly reported connection refused. Repeating it with `npm run preview -- --host 127.0.0.1 --port 4173` passed; this was a setup-order error, not a product finding.

Fresh live demo verification showed the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real. The populated July output was 3,200.00 in, 522.79 out, and +2,677.21 net; Reset demo restored that sample and retained the banner. The dedicated sample-isolation claim proves that writing/resetting demo data leaves a normal-database sentinel unchanged.

The live service worker controlled `/demo/` after reload, the manifest declares standalone display, versioned start URL, 192/512 and maskable icons, and the offline-reload claim passed. Update behavior remains represented by the in-app worker update path and prior controlled update test; no new worker version was deployed during this verification.

Routes `/`, `/demo/`, `/privacy/`, `/terms/`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, and `offline.html` returned 200. An unknown route returned the expected HTTP 404 with the designed “This page was not found” recovery page. Legal routes had their own titles. Root security headers include CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, Permissions-Policy, HSTS, Referrer-Policy, and `nosniff`; AVIF art has one-year immutable caching. Every rendered internal link returned 200; mail links were explicit; the labelled external source returned 200.

The clean candidate build matched all 20 deployed public artifacts by SHA-256, including the 404 response body. `staticwebapp.config.json` is deployment policy rather than a public artifact.

This is a static PWA with no product backend. Tenant isolation, server restart persistence, health endpoints, and live request rate-limit/429 checks do not apply. Browser storage isolation and refresh persistence were exercised instead.

## Earlier findings

| Earlier finding | Current disposition |
|---|---|
| Date-order ambiguity and impossible ISO date acceptance (verification 2) | Fixed; unit and recovery checks passed. |
| Missing hardening headers, mobile footer targets, MIME types, and immutable caching (verification 2) | Fixed; live headers/target checks and MIME/cache responses passed. |
| Non-isolated demo, missing claim registry, contrast/skip-link/compact-link failures, missing designed 404, incomplete metadata/structure, and unclear wording (review 1) | Fixed; isolated `/demo/`, 24 declared claims, Axe, keyboard, legal targets, metadata, 404, and first-screen checks passed. |
| Dead checkout (review 1) | Intentionally hidden while registration is pending; landing and Plus dialog state this honestly. The separate refund claim gap is F1 above. |

## Result

**FAIL.** There is one P2 finding and one untested public claim. A PASS requires both counts to be zero.
