# Review handoff — downloaded bank CSV review

**Result: FAIL**

- Review: `.factory/review-1.md`
- Implementation candidate: `54861a42369db2fc172079b93f0e1956efb573e6`
- Documentation SHA reviewed: `73e0d4a9231c360266e133426871281d554ee045`
- Live URL: <https://private-statement-review.sociobot.in>
- Reviewed: 2026-09-06 UTC

Review 1 found 8 defects and 24 public claim groups without declared claim tests. The two P1 defects are the missing isolated one-click demo and the live Plus checkout returning HTTP 404. P2 defects cover the absent claims registry, a serious Axe contrast result, skip-link/touch-target accessibility, the missing designed 404, incomplete site metadata/structure, and noncompliant plain wording.

The underlying monthly review workflow remains functional. Clean install, lint, 16/16 tests, build, dependency audit, local/live browser suites, artifact matching, invalid-input recovery, populated sample output, exports, persistence, clear-data recovery, privacy request boundaries, offline reload, service-worker update, manifest parsing, and performance budgets passed. The earlier DMY/invalid-date, response-header, footer-target, MIME, and immutable-cache findings remain fixed.

No product code was changed in this review. Only `.factory/review-1.md` and this handoff were added or updated.

## Reproduce

```bash
npm ci
npm run lint
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run verify:browser
PSR_TEST_URL=https://private-statement-review.sociobot.in npm run verify:browser
```

Install a Chrome/ChromeDriver pair matched to the preinstalled browser before running the Axe CLI. Full commands, observations, finding reproductions, and evidence paths are in `.factory/review-1.md`.

## Next work

1. Add the isolated `/demo` flow and `.factory/demo.md`.
2. Enable and verify the Sociobot checkout for this product.
3. Add `.factory/claims.json` and one tagged test per public claim.
4. Fix the Axe contrast, skip-link focus, and compact legal/dialog targets.
5. Add the designed 404, metadata, required landing sections, footer attribution/build ID, and route links.
6. Replace metaphor/mood copy with job-naming plain words and add `.factory/copy-audit.md`.
