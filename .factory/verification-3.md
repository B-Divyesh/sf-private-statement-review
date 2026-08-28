# Independent verification 3 — Private Statement Review

**Verdict: PASS**

- Candidate tested: `54861a42369db2fc172079b93f0e1956efb573e6`
- Live URL: <https://private-statement-review.sociobot.in>
- Verified: 2026-08-28 UTC
- Work order: `private-statement-review-verify-3`
- Environment: Node 22.23.2, npm 10.9.8, Playwright/Chromium 1.58.2 / revision 1208, Lighthouse CLI

This was a fresh, independent verification of the candidate, including its two repaired release blockers from the preceding report. The production deployment is healthy and its public runtime artifacts match the build from this exact checkout. No P0, P1, P2, or P3 product defect was found.

## Clean-checkout quality gates

The checkout began at detached-equivalent clean `HEAD` `54861a42369db2fc172079b93f0e1956efb573e6`, with no pre-existing working-tree changes.

| Gate | Result | Evidence |
|---|---|---|
| Install | PASS | `npm ci`: 167 packages, 0 reported vulnerabilities |
| Lint | PASS | `npm run lint` (`eslint src tests --ext .ts`) |
| Unit/integration tests | PASS | `npm test`: 3 files, 16/16 tests |
| Type check / production build | PASS | `npm run build`: `tsc --noEmit` then Vite 6.4.3; `dist/` produced |
| Browser suite, local production build | PASS | `npm run verify:browser` |
| Browser suite, production | PASS | `PSR_TEST_URL=https://private-statement-review.sociobot.in npm run verify:browser` |
| Production dependency audit | PASS | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities |

The first production build produced `dist/index.html` at 74,775 B raw / 22,948 B gzip, with 49,082 B inline JavaScript and 24,950 B inline CSS. Those are within the static-PWA budgets of 200 KB JS and 50 KB CSS. The mobile AVIF hero is 46,151 B; no web font is transferred.

## Functional and recovery coverage

I exercised the real CSV-review workflow in fresh Chromium contexts on the deployed site at desktop and 390 px mobile, in addition to the repository browser suite.

- Imported the representative two-month safe household statement; verified cash flow, recurring-charge candidates, month comparison, checklist creation, and Markdown/CSV export.
- Rejected a `.txt` upload with the actionable “Choose a CSV file” message, then successfully recovered with a CSV.
- Confirmed the repaired automatic DMY behavior using `13/03/2026` followed by ambiguous `04/03/2026`: both normalize to March, not March/April. The unit test covers the exact normalized result.
- Confirmed an all-ambiguous slash-date statement does not guess. The mapping screen reports that no rows can be imported and directs the user to check the date order; selecting DMY then imports successfully.
- Confirmed impossible `2026-02-31` is skipped, one valid row imports, and the user receives “1 unreadable row was skipped.” The invalid date was absent from IndexedDB.
- The supplied browser suite additionally passed the mapping, recurring, export, dark-theme, legal-route, persistence, offline-reload, desktop/mobile, console, and Axe coverage. Its production invocation above used the script's actual `PSR_TEST_URL` input.
- The default import did not retain source CSV content in IndexedDB. Parsed review data persisted locally as intended.

The free-tier rule boundary was independently exercised: five merchant rules save successfully and the sixth is rejected with an explanatory message. The reviewed UI also keeps core exports and local-data controls outside the Plus boundary; the repository's browser coverage verifies checklist/transaction downloads and its source/unit coverage verifies the associated local-only implementation.

## Privacy, network, and response policy

- A fresh normal landing/import/review flow produced only same-origin requests: `https://private-statement-review.sociobot.in`. No analytics, beacon, CDN font, third-party script, WebSocket, or statement upload was observed.
- Source inspection found no transaction-data API path. CSV processing, rules, comparisons, exports, and IndexedDB persistence are browser-local.
- A controlled returned-license test verified that `?license=[redacted]&keep=1` is stripped to `?keep=1`; the only verification request is `GET https://api.sociobot.in/api/v1/products/private-statement-review/verify?license=[redacted]`. Its sole query key is `license`; no statement data is present. A mocked invalid response relocked Plus while retaining free use.
- Live HTTPS root response: HTTP/2 200, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, restrictive CSP including `frame-ancestors 'none'`, and restrictive Permissions-Policy.
- Live MIME/cache checks passed: manifest is `application/manifest+json`; AVIF is `image/avif` and `Cache-Control: public, max-age=31536000, immutable`; conditional AVIF request returned 304.

All 15 publicly served runtime artifacts from local `dist/` (shells, worker, manifest, icons, art, robots, sitemap, and legal pages) SHA-256 matched production. `staticwebapp.config.json` itself returns Azure's platform 404 rather than a public file, which is expected for this deployment-control file; the active live CSP, MIME, and cache headers prove Azure consumed its policy.

## Accessibility, responsive UI, PWA, and performance

- At 1440×900 and 390×844 there was no page-level horizontal overflow. The three mobile footer links each meet the 44×44 px target.
- Keyboard starts at the visible “Skip to review” link. The measured focus treatment is a 3 px coral outline. Dialog and normal keyboard operations passed in the browser suite.
- With `prefers-reduced-motion: reduce`, the hero animation computes to `1e-05s` (0.01 ms); no looping/flash behavior was observed.
- Repository Axe runs reported zero serious/critical findings across landing, workspace, dark theme, mobile, and desktop. There were no browser console errors or uncaught page errors in local or live flows.
- Manifest contains standalone display, versioned PWA start URL, matching colors, 192/512 icons, and a maskable icon.
- Production service worker activated, controlled a reload, and restored a saved workspace offline. In an isolated local production-build update simulation, serving a changed `v7` worker after the installed `v6` worker produced the visible “Update now” control; activating it reloaded under cache `psr-shell-v7`.
- Lighthouse mobile production run: Performance **97**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP **1.0 s**, LCP **1.2 s**, TBT **210 ms**, CLS **0**, transfer **71 KiB**. LCP and CLS meet the stated thresholds; TBT is an imperfect lab proxy for INP and did not reveal an interaction failure in the exercised UI.

## Defects

None found at P0/P1/P2/P3 severity.

## Conclusion

**PASS.** Candidate `54861a4…` meets the researched brief's local-first monthly statement-review job, including CSV mapping, reusable local rules, recurring candidates, month comparison, exportable checklist, privacy constraints, and the PWA/offline contract. The previously reported date-integrity, headers, mobile target, MIME, and static-cache issues are fixed in both the candidate and live deployment.
