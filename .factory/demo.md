# Demo sandbox

Demo URL: <https://private-statement-review.sociobot.in/demo/>

The landing page opens this URL through “Try it with sample data.” The first demo screen is a populated review, with no mapping or setup step.

## Sample data

The sample contains 21 realistic household transactions across June and July 2026. It includes income, groceries, utilities, transport, health, a streaming charge, and one uncategorized café and book purchase. The dates support monthly, weekly, and fortnightly repeat-charge examples.

## Isolation

Normal review data uses the `private-statement-review` IndexedDB database. Demo data uses the separate `private-statement-review-demo` database. Demo theme and license fixtures use `demo:` localStorage keys. Demo code never opens the normal database.

“Reset demo” replaces only demo data with the original sample. “Start for real” deletes the demo database and all `demo:` localStorage keys before opening `/`.

## Claim verification

Every command in `.factory/claims.json` starts in a fresh browser context. The isolation test first writes a sentinel to the normal database, changes demo data, and proves the sentinel remains unchanged.
