# Private Statement Review

Private Statement Review is a local-first monthly review for people who download bank CSVs but do not want to connect a bank account or upload financial records. It turns statement rows into a small, repeatable review: tidy merchant names, split mixed purchases, inspect likely recurring charges, compare months, mark a checklist, and export the result.

Live product: [private-statement-review.sociobot.in](https://private-statement-review.sociobot.in)

## What it does

- Imports quoted bank CSVs with either one signed amount column or separate debit/credit columns.
- Remembers the column mapping and date/sign conventions locally.
- Stores parsed reviews, merchant rules, splits, notes, and checklists in IndexedDB.
- Applies explicit “description contains → merchant/category” cleanup rules.
- Finds likely monthly, weekly, and fortnightly repeat charges from dates and amount consistency.
- Compares category spending for the newest two imported months.
- Exports a Markdown checklist, normalized transaction CSV, or complete JSON backup.
- Installs as a PWA and continues working offline after the first load.
- Includes a safe two-month sample, so the workflow can be tried without a real statement.

It does not connect to banks, accept credentials, upload statements, recommend financial actions, or use cloud AI for categorization.

## Privacy model

All CSV parsing and analysis runs in the browser. Parsed reviews are stored only in this browser’s IndexedDB. The original CSV text is discarded after import unless a Plus user explicitly selects local retention. There is no analytics or tracking.

The only product API request is an optional Plus license verification. It sends the license token to Sociobot, never statement contents, file names, amounts, merchant names, or notes. See [`/privacy`](https://private-statement-review.sociobot.in/privacy/) for the plain-language policy.

## Plus

The complete review, comparisons, accessibility, checklist, CSV export, and private backup are free. A US $19 one-time Plus license adds:

- opt-in retention of the original CSV on the device;
- more than five saved merchant cleanup rules;
- license restoration on the owner’s other devices.

Checkout and verification use the Sociobot billing API. The product slug is used in the documented checkout route; there is no embedded payment provider or hardcoded payment-provider product ID. Production defaults to `https://api.sociobot.in/api/v1`. For staging, set `VITE_BILLING_BASE_URL=https://pilot-api.sociobot.in/api/v1` at build time.

## Develop

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

The app uses Vite and vanilla TypeScript. It has no runtime dependencies and loads no third-party scripts or fonts.

## Test and verify

```bash
npm test
npm run build
npm run preview -- --host 127.0.0.1
npm run verify:browser
```

`npm test` covers CSV edge cases, mappings, amount signs, merchant rules, recurring detection, split categories, comparisons, and summaries. `verify:browser` expects the preview server at `http://127.0.0.1:4173`; it runs the full sample workflow in Chromium at 390 px, checks serious/critical Axe findings, tests light and dark themes, verifies direct legal routes and console output, then reloads the saved workspace offline.

The reproducible production command is exactly:

```bash
npm run build
```

Static output lands in `dist/`, with `dist/index.html` at its root. Deploy the contents of that directory with clean-URL support for `/privacy/` and `/terms/` (both also have physical `index.html` files).

## Data ownership and recovery

Use **Export private backup** before clearing browser storage or changing devices. **Import backup** accepts the exported version-1 JSON format after schema validation. **Clear all local data** removes reviews, parsed transactions, rules, notes, checklist state, and retained original CSV text from this browser. License state is separate localStorage and can be removed through browser site-data controls.

## Project notes

- Product brief: [`.factory/brief.json`](.factory/brief.json)
- Visual system and generated-art provenance: [`.factory/design.md`](.factory/design.md)
- Build verification and known gaps: [`.factory/handoff.md`](.factory/handoff.md)
- License: [MIT](LICENSE)
