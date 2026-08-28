# Handoff — Private Statement Review

Work order: `private-statement-review-build-1`

Completed: 2026-08-28

Artifact: static offline PWA (`dist/`)

## What was built

- A complete local-first bank CSV review workflow using Vite and vanilla TypeScript.
- Defensive CSV parsing for quotes, escaped quotes, BOM/CRLF, duplicate headers, currency marks, parenthesized negatives, trailing negatives, separate debit/credit columns, and either positive- or negative-expense amount conventions.
- Remembered local column mapping and explicit date-order selection.
- IndexedDB persistence for parsed reviews, merchant rules, transaction splits/categories, notes, and checklist state. Original CSV text is retained only when an unlocked user explicitly opts in.
- Explicit merchant merge/category rules, per-transaction two-part splits, and visible raw descriptions.
- Explainable recurring-charge candidates based on merchant, amount variance, and date intervals, with supporting transaction dates/amounts.
- Current/prior-month cash-flow summaries and category comparisons, including signed amount and text labels rather than color-only meaning.
- A persistent review checklist, custom notes, Markdown checklist export, normalized CSV export, validated JSON backup import/export, and confirmed local-data clearing.
- Empty, malformed-file, skipped-row, offline, saved, license-error, no-history, and no-recurring-pattern states.
- One-time Plus integration at US $19 through the Sociobot checkout and verify endpoints: return-token capture, exact localStorage key, daily verdict cache, optimistic offline unlock, background reconciliation, restore field, and quiet invalid-license fallback. Core review, accessibility, and all exports remain free.
- Installable PWA manifest, 192/512/maskable icons, versioned app-shell and asset caches, navigation fallback, offline page, clients claim, and an in-app update action using `skipWaiting`.
- Physical static `/privacy/` and `/terms/` outputs, detailed README, MIT license, robots file, and sitemap.
- Original responsive AVIF/WebP “ledger garden” hero generated for this product. Source, prompt, review, and provenance are in `assets/src/` and `.factory/design.md`.

## How to run

```bash
npm ci
npm run dev
```

Production build (the exact work-order command):

```bash
npm run build
```

Output is `dist/`; `dist/index.html`, `dist/privacy/index.html`, and `dist/terms/index.html` are present.

## Verification performed

- `npm ci` — passed; 0 vulnerabilities.
- `npm test` — passed: 2 files, 11 tests.
- `npm run build` — passed from the lockfile-installed dependency tree.
- Production bundle — single app shell 73.85 KB raw / 22.80 KB gzip, no runtime dependencies; CSS and JS combined remain far below their 50 KB/200 KB budgets. Mobile AVIF hero is 46 KB; mobile WebP fallback is 55 KB.
- `npm run verify:browser` against `vite preview` — passed in Chromium 1.58.2 at 390×844:
  - complete safe-sample import and mapped review;
  - recurring candidates and month comparison;
  - checklist and transaction downloads;
  - keyboard-first skip link;
  - one `<h1>`, main landmark, image alternatives, and no horizontal overflow;
  - Axe serious/critical violations: 0 in light and dark modes;
  - first-install service worker, IndexedDB persistence, and offline reload;
  - direct privacy route and disclosure text;
  - browser console/page errors: 0.
- Lighthouse 13.0.1, mobile profile, production preview:
  - Performance: **100**
  - Accessibility: **100**
  - Best practices: **100**
  - SEO: **100**
  - FCP: **0.8 s**
  - LCP: **1.5 s**
  - CLS: **0**
  - Total blocking time: **70 ms**
  - Transfer size: **79 KiB**

## Privacy/security notes

- There is no analytics and no third-party runtime script, font, or CDN request.
- Statement content is never passed to `fetch`. Backups are generated and parsed locally and receive structural validation before replacement.
- UI rendering escapes imported descriptions, categories, file names, rules, checklist text, and notes.

## Known gaps and next steps

- Recurring detection is intentionally conservative and deterministic. It does not infer annual charges or fuzzy merchant aliases until the user supplies a merge rule.
- Currency is not guessed. Values are displayed without a currency symbol and labelled as the statement’s currency to avoid presenting the wrong unit.
- There is no cross-device statement sync by design. Users move their own data via the JSON backup; the export itself is plain JSON and should be stored accordingly.
- The factory still needs to register the production billing product/return URL. Staging builds can set `VITE_BILLING_BASE_URL=https://pilot-api.sociobot.in/api/v1`; release defaults to the production Sociobot API.
- Service-worker cache version constants must be bumped when a future release changes the app shell.
