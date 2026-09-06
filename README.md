# Private Statement Review

Review downloaded bank CSVs for monthly cash flow, repeated charges, and category changes. It is for households that avoid bank links and statement uploads.

Live product: [private-statement-review.sociobot.in](https://private-statement-review.sociobot.in)

One-click sample: [private-statement-review.sociobot.in/demo/](https://private-statement-review.sociobot.in/demo/)

## What it does

- Imports signed-amount CSVs and CSVs with separate debit and credit columns.
- Remembers column, date-order, and amount-sign choices in this browser.
- Restores reviews, merchant rules, notes, and checklist state after reload.
- Applies merchant cleanup rules while keeping each source description visible.
- Splits a mixed purchase into two category amounts.
- Finds monthly, weekly, and fortnightly repeat-charge candidates.
- Compares category spending for the newest two months.
- Exports a Markdown checklist, normalized transaction CSV, or private JSON backup.
- Validates imported backups and lets you clear local review data.
- Works offline after the first visit.

The sample uses its own `private-statement-review-demo` IndexedDB database. Resetting or leaving it does not change the normal review database.

## Privacy

The app does not connect to banks or ask for bank credentials. It does not upload statement rows, use analytics, or send data to a cloud categorization service.

Parsed reviews use IndexedDB in this browser. Original CSV text is discarded after import unless a Plus user selects local retention.

An optional license check sends only the license token to the Sociobot billing API. See the live [privacy page](https://private-statement-review.sociobot.in/privacy/) for details.

The output is an arithmetic review aid, not financial advice.

## Free review and Plus

Importing, comparisons, checklists, accessibility, exports, and backups are free.

Plus costs US $19 once, with no subscription. It adds optional original-CSV retention and more than five merchant rules. A license can be restored on another browser.

New checkout is unavailable until the external Sociobot billing registration is completed. Existing licenses can still be restored. The requested offer metadata is recorded in `/work/.evidence/billing-offer.json` for the billing operator.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
npm run dev
```

The app uses Vite and vanilla TypeScript. Runtime code, fonts, images, and the service worker load only from the product origin.

## Test and verify

```bash
npm ci
npm run lint
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run verify:browser
```

`npm test` runs unit tests and 24 browser claim tests. Every public claim, test command, and sandbox is listed in [`.factory/claims.json`](.factory/claims.json).

`npm run verify:browser` expects the production build at `http://127.0.0.1:4173`. Set `PSR_TEST_URL` to check another origin.

## Build and deploy

```bash
npm run build
```

Deploy `dist/`. It contains the root app, physical `/demo/`, `/privacy/`, and `/terms/` entries, plus the designed `404.html` and Static Web Apps policy.

## Data recovery

Export a private backup before clearing browser storage or changing devices. Import backup accepts the exported version-1 JSON format after validation.

## Project records

- Opportunity brief: [`.factory/brief.json`](.factory/brief.json)
- Visual system and asset provenance: [`.factory/design.md`](.factory/design.md)
- Demo sandbox: [`.factory/demo.md`](.factory/demo.md)
- Repair handoff: [`.factory/handoff.md`](.factory/handoff.md)
- License: [MIT](LICENSE)
