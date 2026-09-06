# Review downloaded bank CSVs privately — review 1

**Verdict: FAIL**

- Findings: **8** — 2 P1, 6 P2, 0 P0/P3
- Untested public claims: **24**
- Implementation candidate: `54861a42369db2fc172079b93f0e1956efb573e6`
- Documentation SHA reviewed: `73e0d4a9231c360266e133426871281d554ee045`
- Live URL: <https://private-statement-review.sociobot.in>
- Reviewed: 2026-09-06 UTC
- Work order: `private-statement-review-review-1`

The monthly CSV review itself works. Import, mapping recovery, recurring candidates, month comparison, notes, checklists, exports, local persistence, clearing, offline reload, and the earlier date/header/cache repairs passed. The product does not pass the current factory contract because the sample is not an isolated demo, purchase is broken, public claims have no claim tests, and required accessibility, wording, routing, and metadata checks fail.

## First screen before scrolling

- **Job shown:** turn a downloaded bank CSV into cash-flow, repeat-charge, and category-change output.
- **Audience shown:** no audience is named. The sentence describes a downloaded CSV, but does not say that this is for privacy-conscious households or people avoiding bank links.
- **First action:** “Review a statement.” “Try a safe sample” is beside it. Both are visible at 390×844 and 1440×900.

The visible `<h1>` is “See what changed. Keep it to yourself.” It does not name the CSV review job. The 63-character page title, “Private Statement Review — Monthly clarity, kept on this device,” also uses a vague result instead of naming what the product does.

## Findings

### F1 — P1 — The sample is not an isolated one-click demo

“Try a safe sample” opens the column-mapping form after one click. It does not open populated output. After the second click, `safe-sample.csv` is written to the ordinary `private-statement-review` IndexedDB database under the ordinary `app` key.

There is no persistent “Demo — sample data, nothing is saved” label, no “Reset demo,” no “Start for real,” no separate storage namespace, and no `.factory/demo.md`. `/demo` is not a demo route: it renders the ordinary app. In a controlled fresh context, a sentinel record placed in the normal database appeared at `/demo`. This proves that the supposed demo can read real workspace data and that sample changes are not isolated from it.

Required result: `/demo` or `?demo=1` must open populated sample output in one click, use separate storage, show the persistent label and exit/reset controls, and never read or write real data.

### F2 — P1 — The live purchase action returns 404

The Plus dialog advertises a US $19 one-time purchase and links “Buy Plus securely” to:

`https://api.sociobot.in/api/v1/products/private-statement-review/checkout`

A live GET returned HTTP 404 with `{"error":"enabled factory product","status":404}`. This is an unexpected failure on a paid user path, not the deliberate unknown-page 404 allowed by the review rules. The corresponding invalid-license verification endpoint returned HTTP 200 with `valid:false`, so the failure is specific to checkout availability.

### F3 — P2 — Twenty-four public claim groups have no declared claim tests

`.factory/claims.json` is missing and the repository contains no `@claim:` tests. Therefore there were no declared claim commands to run. `npm test` and `verify:browser` provide useful incidental coverage, but they do not give each public promise exactly one reproducible claim test as required.

The public claim groups left unregistered and untested by the claim contract are:

1. Import signed-amount or separate debit/credit CSVs.
2. Remember column and date/sign mapping locally.
3. Persist parsed reviews, rules, notes, and checklists in IndexedDB.
4. Apply explicit merchant cleanup rules.
5. Split mixed purchases.
6. Find monthly, weekly, and fortnightly repeat-charge candidates.
7. Compare the newest two imported months.
8. Export a Markdown checklist.
9. Export normalized transaction CSV.
10. Export, validate, restore, and clear local review data.
11. Work offline after the first visit.
12. Include a safe two-month sample.
13. Make no bank connection and accept no bank credentials.
14. Never upload statement rows.
15. Discard original CSV text unless Plus retention is explicitly selected.
16. Use no analytics or tracking.
17. Send only a license token on the optional verification request.
18. Provide no financial advice or cloud-AI categorization.
19. Keep the complete review, comparisons, accessibility, checklist, and exports free.
20. Sell Plus for US $19 once, with no subscription.
21. Let Plus retain the original CSV locally.
22. Let Plus save more than five merchant rules.
23. Restore a license on the buyer’s other devices.
24. Load only self-hosted runtime code and fonts.

### F4 — P2 — The required Axe command finds serious low contrast

After installing a Chrome/ChromeDriver pair for the CLI, `@axe-core/cli` reported one serious `color-contrast` violation on the landing `figcaption`: foreground `#898f85` on `#fcf9f1`, ratio **3.15:1**, expected **4.5:1** at 16 px. The failure occurs while the 420 ms entrance opacity animation is active; after the animation, the static palette passes. The required default audit still observes a serious failure, so the accessibility gate is not clean.

### F5 — P2 — Skip-link focus and four touch targets fail

Keyboard focus starts on “Skip to review,” but pressing Enter changes the URL to `#main` and scrolls only 74 px while focus moves to `<body>`, not `<main>`. The target lacks a focusable route, so keyboard users are not moved past the header/content they meant to skip.

At 390 px, the Privacy and Terms links inside the Plus dialog are 15 px high. The privacy and support email links on the legal pages are 19 px high. These do not meet the 44×44 CSS-pixel touch-target contract. Native dialogs otherwise put focus on the close button and close with Escape.

### F6 — P2 — Unknown URLs do not get the required designed 404

`GET /reviewer-missing-route-20260906` returns HTTP 200 and the home page. There is no `404.html`, 404 application route, or `responseOverrides.404` entry. The missing path therefore has neither a deliberate HTTP 404 nor a designed recovery page.

### F7 — P2 — Required site structure and metadata are incomplete

The root has no canonical link, Open Graph title/image, or Twitter card. The sitemap lists only `/`, `/privacy/`, and `/terms/`; there is no demo or 404 route to list. The header has no Demo link. The footer omits “Built by Param Factory” and a version/build ID, and its external Source link does not say it is external.

The landing order also stops after the hero and “How it works.” It has no populated product preview, no plain “What it does not do” section, and no visible paid-tier section with price and contents; pricing exists only behind the Plus dialog.

### F8 — P2 — Required plain wording is not met

The headline does not name the job or audience. Product headings and labels use the prohibited mood/metaphor style, including “Bring one statement home,” “A smaller, calmer tool,” “From download to done in four chapters,” “Carry a checklist,” “Close the loop,” and the offline title “The path is offline.” The product also uses “ritual,” “chapters,” and visual-lore labels such as “LOCAL / 001.” `.factory/copy-audit.md`, required to list sentence word counts and terminology, is missing.

## Previous findings

All findings in `.factory/verification.md` were checked again against the current live artifact.

| Earlier finding | Current disposition | Evidence |
|---|---|---|
| P1 mixed DMY dates and impossible ISO dates | Fixed | Unit tests passed. Live ambiguous `04/03/2026` first produced an actionable mapping error; choosing DMY imported `2026-03-04`. Live `2026-02-31` was skipped with the unreadable-row notice. |
| P2 missing CSP, Permissions-Policy, and anti-framing | Fixed | Root sends restrictive CSP including `frame-ancestors 'none'`, Permissions-Policy, `X-Frame-Options: DENY`, HSTS, `nosniff`, and Referrer-Policy. |
| P2 undersized mobile footer links | Fixed | Privacy, Terms, and Source footer targets each measured at least 44×44 px. The separate compact links in F5 remain. |
| P3 manifest/AVIF MIME types | Fixed | Live responses use `application/manifest+json` and `image/avif`. |
| P3 static caching | Fixed | `/art/ledger-garden-960.avif` returns `Cache-Control: public, max-age=31536000, immutable`. |
| Deployment/candidate identity | Fixed | All 16 public files from the candidate build, excluding deployment-only `staticwebapp.config.json`, matched production byte for byte by SHA-256. |

## Clean-checkout commands

The checkout began clean at documentation SHA `73e0d4a…`. Commits after implementation SHA `54861a4…` change only `.factory/handoff.md` and `.factory/verification-3.md`.

| Command | Result |
|---|---|
| `npm ci` | PASS — 167 packages, 0 vulnerabilities |
| `npm run lint` | PASS |
| `npm test` | PASS — 3 files, 16/16 tests |
| `npm run build` | PASS — `dist/index.html` produced |
| `npm audit --omit=dev --audit-level=high` | PASS — 0 vulnerabilities |
| `npm run verify:browser` | PASS against local production build |
| `PSR_TEST_URL=https://private-statement-review.sociobot.in npm run verify:browser` | PASS against production |
| `/opt/fleet/lib/verify-url.sh …` | PASS — HTTPS 200, title/lang/main/alt/button checks, 0 console errors |
| `npx @axe-core/cli … --exit` | FAIL — one serious contrast violation (F4) |

No `.factory/claims.json` exists, so the set of declared claim commands was empty. This absence is F3, not a claim pass.

## Working behavior verified

- The nine-row sample produces July cash flow of 3,200.00 in, 302.79 out, and +2,897.21 net.
- It produces three expense-only recurring candidates: CITY ENERGY, CORNER MARKET, and STREAMCO.
- Month comparison, checklist suggestions, a custom checklist item, note saving, and Markdown/CSV/JSON downloads worked.
- Invalid extension, header-only CSV, malformed quoted CSV, over-10-MiB input, ambiguous date order, impossible date, invalid mapping, and invalid backup paths gave recoverable errors.
- Reload restored the workspace. Clear-data cancellation kept one review; confirmation reduced stored reviews to zero and returned home.
- A mocked returned-license flow stripped only `license` from the URL, sent a token-only verification request, relocked on an invalid result, and kept the free product usable.
- The live normal/sample flow contacted only `private-statement-review.sociobot.in`. Source inspection found no statement-data request path. The sole explicit external runtime request is optional license verification.
- No console or uncaught page errors occurred in the live desktop, phone, workflow, legal, or offline checks.
- The original visual system is distinct and matches `.factory/design.md`; generated-art provenance is recorded. The brief does not benefit from optional AI, so there is no missed-AI-leverage finding.

## PWA, accessibility, and performance evidence

- Chromium reported no manifest errors. The manifest has standalone display, versioned start URL, 192/512 icons, and a maskable icon.
- The live worker activated and controlled the page. A saved sample workspace, `/privacy/`, and `/terms/` reopened offline with a visible offline notice.
- A temporary local v6→v7 worker simulation showed “Update now”; activation removed the old cache and left `psr-shell-v7`.
- Reduced motion computed the hero animation to `0.00001s`. No looping or flashing motion was found.
- Desktop 1440×900 and phone 390×844 had no page overflow. A 200% root-text check at 390 px had no page overflow.
- Lighthouse 12.8.2 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 1.2 s, TBT 70 ms, CLS 0, transfer 71 KiB. Lighthouse does not detect F4/F5.
- Build sizes: 49,034 B inline JavaScript, 24,901 B inline CSS, 74,775 B HTML, and 46,151 B mobile AVIF.

This is a static PWA with no product backend or tenant database. Tenant isolation, server restart persistence, product health, and product rate-limit/429 checks are therefore not applicable. The external billing checkout was checked separately and is F2.

## Evidence files

- `/work/.evidence/screenshots/landing-desktop.png`
- `/work/.evidence/screenshots/landing-phone.png`
- `/work/.evidence/screenshots/sample-after-one-click-phone.png`
- `/work/.evidence/screenshots/sample-populated-phone.png`
- `/work/.evidence/axe-live.json`
- `/work/.evidence/lighthouse.json`
- `/work/.evidence/verify-url/verify.json`

## Result

**FAIL.** There are 8 findings and 24 untested public claim groups. A PASS requires both counts to be zero.
