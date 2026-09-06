# QA handoff — Private Statement Review

**Current verification result: FAIL — one P2 finding and one untested public claim remain.**

Verification 4 reviewed implementation `3ee3dcc34650e5f5a9e61a844e5411da1598a667` against documentation `a5cb5ad889116453c6f82dc4fac2faadd9c9e7ba` and the live site. All code and deployed-product gates passed, including 17 unit/config tests, the full 24-claim suite, every declared claim command separately, build, lint, audit, live browser verification, factory URL verification, and Axe CLI.

The remaining issue is documentation/claim completeness, not a code defect: `/terms/` says that a refund revokes a license, but `.factory/claims.json` has no runnable test for refund/revocation behavior. The billing offer has not been registered, so checkout returns its expected unavailable 404 and an actual refund flow cannot be verified. The landing page and Plus dialog correctly hide checkout and say registration is pending.

See `.factory/verification-4.md` for evidence, prior-finding disposition, and the required next step: after billing registration, add a recorded revocation fixture or verify an issued-and-refunded license end to end; otherwise remove or qualify the public promise. The product cannot be marked PASS until that claim is tested or removed.

## Earlier repair handoff

- Live URL: <https://private-statement-review.sociobot.in>
- Implementation SHA deployed: `3ee3dcc34650e5f5a9e61a844e5411da1598a667`
- Verification/documentation base SHA: `a941231` (the final handoff update is report-only and is newer than the deployed implementation)
- Previous review SHA: `bc6048a4425b5b62d0563d333badb628487302c0`
- Deployment completed: 6 September 2026 UTC
- Documentation: this handoff was finalized after deployment. The exact report commit is repository HEAD and is stated in the completion report.

## What changed

1. Demo mode now uses the separate `private-statement-review-demo` IndexedDB database and `demo:` localStorage keys. `/demo/` opens a populated 21-row, two-month review. Its persistent banner provides “Reset demo” and “Start for real.” Starting for real deletes demo storage before opening the normal workspace.
2. The broken checkout link is no longer shown. The US $19 one-time Plus offer and paid features remain public, but the UI says new purchase registration is pending. Existing licenses can still be restored and verified. `/work/.evidence/billing-offer.json` contains the exact offer metadata for the separate billing operator.
3. `.factory/claims.json` registers all 24 public claim groups. Each has exactly one `@claim:<id>` Playwright test with an outcome-based sandbox.
4. The entrance animation no longer changes opacity. Both Playwright Axe and the required Axe CLI now report zero violations on home, demo, privacy, and terms in light and dark checks.
5. The skip link moves focus to `<main>`. Route changes focus and announce the new `<h1>`. Dialog and legal inline links now meet the 44 px target. Dialog focus and Escape behavior are tested.
6. Unknown production paths now return HTTP 404 and render the product-specific recovery page. Physical entries exist for demo, privacy, terms, and 404.
7. Canonical, Open Graph, Twitter, theme, favicon, and 180 px Apple metadata are present. The 1200×630 social image is derived from the product’s original art. The sitemap includes all public routes. The header includes Demo; the footer includes the builder, version, and an explicitly external source link.
8. Landing and product copy now uses literal job headings. The first screen names the job, household audience, and first action. It includes three facts, a populated output preview, three steps, limits, and the visible paid tier. `.factory/copy-audit.md` records every landing line and terminology.

The prior date-order, impossible-date, security-header, footer-target, MIME, and immutable-cache repairs remain in place and are covered by the existing unit, browser, and deployment-policy checks.

## Clean verification

A detached worktree at the implementation SHA (`/tmp/psr-release.vbj7sT`) was used.

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
npm run preview -- --host 127.0.0.1 --port 4173
npm run verify:browser
```

Results:

- Install: 168 packages, 0 vulnerabilities.
- Lint: pass.
- Unit/config: 17/17 pass.
- Claim suite: 24/24 pass.
- Every one of the 24 commands in `.factory/claims.json` was also run separately: 24/24 pass.
- Production build: pass; `dist/index.html` exists.
- Local browser verification: pass.
- Live browser verification: pass.
- Dependency audit: 0 production vulnerabilities.
- Axe CLI 4.13.0: 0 violations on `/`, `/demo/`, `/privacy/`, and `/terms/`, locally and live.
- Factory `verify-url.sh`: pass on the final deployment; HTTPS 200, one title, `lang=en`, one `<h1>`, one `<main>`, complete alt text, labelled buttons, and no console errors.

Invalid extension, header-only CSV, malformed quoted CSV, over-10-MiB input, ambiguous date order, invalid backup, clear/reset, and recovery paths were exercised. Phone, desktop, keyboard skip, history back, route focus, dialog focus/Escape, 200% text, light/dark contrast, reduced motion, downloads, persistence, offline reload/export, and service-worker update were exercised.

## Live verification

- Fresh 390×844 and 1440×900 contexts show “Review downloaded bank CSVs privately,” the household audience, and “Try it with sample data” before scrolling.
- `/demo/` opens populated July output in one click: 3,200.00 in, 522.79 out, +2,677.21 net, and five repeat-charge candidates.
- The demo isolation test writes a normal-data sentinel, edits and resets demo data, then proves the sentinel is unchanged.
- An unknown path returns HTTP 404 and shows “This page was not found” with home and sample links.
- Root responses retain CSP, anti-framing, permissions, referrer, HSTS, and `nosniff` headers. Static AVIF art retains one-year immutable caching.
- All 20 public build artifacts matched the deployed files by SHA-256. Deployment policy is consumed by Azure and is not itself public.
- A browser controlled by live service worker `psr-shell-v8` was kept open during the final deployment. It displayed the v9 update prompt after `registration.update()`.
- The live invalid-license endpoint returns HTTP 200. The live checkout endpoint still returns HTTP 404 because external product registration has not happened.

## Performance

Live Lighthouse 12.8.2 mobile:

- Performance: 100
- Accessibility: 100
- Best Practices: 100
- SEO: 100
- FCP: 1.0 s
- LCP: 1.2 s
- TBT: 80 ms
- CLS: 0
- Transfer: 73 KiB

Build sizes: 55,396 bytes inline JavaScript, 27,491 bytes inline CSS, 85,015 bytes total HTML (25,203 bytes gzip), and 46,151 bytes for the mobile AVIF hero. There are no web-font downloads.

## Evidence

- `/work/.evidence/axe-local-clean/`
- `/work/.evidence/axe-live/`
- `/work/.evidence/lighthouse-local.json`
- `/work/.evidence/lighthouse-live-final.json`
- `/work/.evidence/verify-url-final/`
- `/work/.evidence/screenshots-live/landing-phone.png`
- `/work/.evidence/screenshots-live/landing-desktop.png`
- `/work/.evidence/billing-offer.json`
- `/work/.evidence/catalog-description.txt`

## Remaining dependency

The Sociobot billing operator must register and enable `private-statement-review` from `/work/.evidence/billing-offer.json`. Until then, no new purchase action is offered. Do not replace the $19 one-time license with a mock checkout or make its paid storage features free. After registration, restore the hosted checkout link and verify payment return, entitlement, daily caching, revocation, and refund behavior with an issued test license.

This is a static PWA with no product backend. Tenant isolation, server persistence, health endpoints, and 429 behavior do not apply.
