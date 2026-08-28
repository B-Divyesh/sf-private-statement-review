# Independent product verification

**Verdict: FAIL**

- Candidate: `0dd1ef94eea5e25675557578d9572712da1a0014`
- Live URL: <https://private-statement-review.sociobot.in>
- Verified: 2026-08-28 UTC
- Work order: `private-statement-review-verify-2`
- Environment: Node `v22.23.2`, npm `10.9.8`, Playwright `1.58.2`, Chromium 1208

The product is deployed, visually complete, private by default, installable, and broadly usable. It does not pass the acceptance contract because the default date parser can silently assign transactions to the wrong month and accepts impossible ISO calendar dates. Month comparison is a core job, so incorrect dates are release-blocking.

## Defects

### P1 / High — automatic date handling can silently corrupt the review month

`src/csv.ts:94-116` selects DMY separately for each slash-formatted value only when that row's first number is greater than 12. The default mapping is labelled “Detect automatically.” A single DMY statement therefore receives inconsistent interpretation:

```csv
Date,Description,Amount,Category
13/03/2026,RENT,-100,Home
04/03/2026,GROCER,-20,Food
```

With the default mapping, the normalized export was:

```csv
2026-03-13,RENT,RENT,Home,-100.00
2026-04-03,GROCER,GROCER,Food,-20.00
```

The second March transaction is silently moved to April, affecting monthly totals, comparisons, recurring intervals, and checklist suggestions. Selecting DMY manually avoids this manifestation, but the default promises automatic detection and provides no warning.

The same parser accepts impossible ISO input without validation. `2026-02-31,IMPOSSIBLE DATE,-9.99` imported successfully and was exported unchanged as `2026-02-31`. Slash dates do receive calendar validation, so behavior is inconsistent. Invalid ISO dates should be rejected/skipped with the existing recovery message.

### P2 / Medium — browser response hardening is incomplete

The live HTML has HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `X-DNS-Prefetch-Control: off`. It does not send `Content-Security-Policy`, `Permissions-Policy`, or an anti-framing policy (`frame-ancestors` or `X-Frame-Options`). No injection or exfiltration exploit was found, and imported strings are escaped, but a local financial-data product should have these defense-in-depth controls.

### P2 / Medium — three mobile footer links miss the 44 px target contract

At 390 px, the visible Privacy, Terms, and Source links are each 20 px high; their measured widths were 46 px, 38 px, and 44 px. They fail the attached ≥44×44 CSS px target requirement. Keyboard focus remains visible and there are no Axe serious/critical findings.

### P3 / Low — deployment MIME and HTTP caching are under-specified

- `manifest.webmanifest` and AVIF responses use `application/octet-stream` rather than `application/manifest+json` and `image/avif`. Chromium still parsed the manifest, loaded the hero, and reported no installability errors.
- Every checked resource uses `Cache-Control: public, must-revalidate, max-age=30`, including static art. Conditional requests return `304`, and the versioned service-worker cache works, but static assets do not use the requested long-lived immutable policy.

## Clean-checkout gates

A detached worktree was created from the candidate SHA before installing or building.

| Gate | Result | Evidence |
|---|---|---|
| Repository state | PASS | Detached `HEAD` exactly `0dd1ef9`; no source changes |
| `npm ci` | PASS | 66 packages installed; 0 vulnerabilities |
| `npm test` | PASS | 2 files, 11/11 tests |
| Type check | PASS | `tsc --noEmit` runs inside the production build |
| Lint | N/A | No lint script or lint configuration exists |
| `npm run build` | PASS | Vite 6.4.3; `dist/` produced; build completed in 426 ms |
| Repository browser suite, local | PASS | Full sample flow, mobile, Axe, persistence, offline reload, legal route, console |
| Repository browser suite, live | PASS | Same suite passed against the production URL |
| Factory `verify-url.sh` | PASS | HTTPS 200; load 592 ms; title/lang/h1/main/alt/button checks; 0 console errors |

## Independent functional coverage

The local production build and live deployment were exercised in fresh browser contexts.

- Imported the representative two-month household sample; confirmed cash-flow overview, recurring-charge evidence, month comparison, and raw merchant descriptions.
- Rejected a non-CSV file, header-only CSV, unclosed quote, and a file one byte over 10 MiB, with actionable messages and successful retry.
- Rejected a mapping with no amount/debit/credit column, then recovered and imported.
- Exercised the five-rule free boundary, rejected a sixth, removed one with confirmation, then successfully added a replacement and confirmed it affected recurring analysis/export.
- Rejected an invalid two-part split, accepted an exact positive split, and retained it.
- Added/completed a custom checklist item and note; exported Markdown, normalized CSV, and JSON backup; rejected an invalid backup; restored the valid backup; reloaded and confirmed persistence.
- Cancelled clear-data confirmation, then confirmed it and returned to the empty state.
- Confirmed original CSV text is absent from IndexedDB after a default free import.
- Confirmed checkout target is the Sociobot API. A mocked invalid-license check sent only the license token, stripped it from the browser URL while preserving other query parameters, and relocked Plus without blocking free use.

Observed download sizes in the representative flow: checklist 692 B, CSV 537 B, backup 5,610 B.

## Accessibility, responsive behavior, and design

- Checked desktop 1440×900 and mobile 390×844; no page-level horizontal overflow in landing/workspace flows.
- At 200% root text size on 390 px, no horizontal overflow occurred.
- Keyboard path exposes the skip link, and subsequent controls show a 3 px coral focus ring. Dialog focus enters the modal and Escape closes it.
- Reduced motion computes the hero animation at `0.00001 s`; no looping or flashing animation exists.
- Axe serious/critical findings: **0** on desktop landing, mobile landing, mapping, tidy, recurring, compare, finish, Plus dialog, and dark workspace.
- No console errors or uncaught page errors occurred in local or live flows.
- Visual inspection found a distinct editorial “quiet ledger garden” treatment consistent with `.factory/design.md`; the responsive art loaded and remained legible at both widths.
- Semantics passed: `lang=en`, one `<h1>`, one `<main>`, labelled controls, image alternatives, title, legal landmarks/routes.

## Privacy and network evidence

- Fresh landing, import, analysis, edit, persistence, export, and clear-data flows generated no cross-origin runtime request.
- No analytics, third-party script, CDN font, beacon, WebSocket, or cloud analysis path exists in source or observed traffic.
- Statement rows and changes persisted in IndexedDB; license/theme data uses localStorage.
- Default import did not persist the source CSV. Source retention remains disabled without Plus and explicit opt-in.
- The sole designed outbound data path is license verification:
  `GET https://api.sociobot.in/api/v1/products/private-statement-review/verify?license=[redacted]`.

## PWA, offline, and update behavior

- Chromium parsed the manifest and reported zero installability errors; standalone display, versioned start URL, 192/512 icons, and maskable icon were present.
- Service worker reached `activated`, controlled the page after reload, and restored the saved workspace with the browser offline.
- Direct privacy and terms routes loaded; offline navigation showed the saved shell/workspace and a visible offline status.
- A controlled service-worker mutation from cache `psr-shell-v5` to `psr-shell-v6` displayed “An app update is ready”; activating “Update now” reloaded under the new controller and removed the old shell cache.

## Deployment identity, headers, and caching

All 16 files in local `dist/` were fetched from production and SHA-256 compared; every file matched. Key hashes:

| Artifact | SHA-256 |
|---|---|
| `index.html` | `e84803bdf6e7c05f87adbd6e73389f9ff470e4abca62571bf0d67fe618f48a1d` |
| `sw.js` | `9c8301f53015714e2e652eb6b2c4723ee017ad3d08842fed918571badd6d1a8f` |
| `manifest.webmanifest` | `4c176ebcfe699367c7f50f896c8e08336018c5d48b30936ee218c39019bcb7cd` |
| `offline.html` | `4ed608aa9632ff37abeb40fac37426f7dd127efea8269f0b6c8a749be48a26cd` |

The main response was HTTPS 200 over HTTP/2 with a valid certificate, 73,854-byte body, HSTS, ETag, `nosniff`, and strict-origin referrer policy. ETag conditional requests returned 304. Unknown paths return the application shell with HTTP 200, consistent with SPA navigation.

## Performance and budgets

Live Lighthouse 13.0.1 mobile run:

| Category/metric | Result | Contract |
|---|---:|---:|
| Performance | 98 | ≥90 |
| Accessibility | 100 | ≥95 |
| Best practices | 100 | — |
| SEO | 100 | — |
| FCP | 1.0 s | — |
| LCP | 1.2 s | <2.5 s |
| Total blocking time | 160 ms | INP proxy only; lab navigation has no INP |
| CLS | 0 | <0.1 |
| Transfer | 79 KiB | — |

Build budget evidence:

- Inline JavaScript: 48,225 B raw (≤200 KB).
- Inline CSS: 24,789 B raw (≤50 KB).
- HTML shell: 73,854 B raw / 22,798 B gzip.
- Mobile AVIF hero: 46,151 B (≤300 KB).
- Approximate initial raw shell + mobile hero: 120,005 B.
- No web-font transfer.

## Verdict rationale

**FAIL.** Deployment status is healthy and the previous deployment-only concern is not present. The P1 date-integrity defect blocks a trustworthy monthly financial review. The response-policy and target-size defects should also be addressed before re-verification.
