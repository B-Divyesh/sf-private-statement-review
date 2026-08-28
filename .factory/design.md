# Design thesis — The quiet ledger garden

## Direction and reason

**Surreal editorial scenery**, treated as a calm monthly ritual rather than a fintech dashboard. A folded paper statement becomes a moonlit garden path: transaction rows are stepping stones, recurring charges are small repeating moons, and review flags are brass pins. The scene makes the product's promise legible — the file enters a private place, patterns emerge, and nothing is sent away. UI chrome stays restrained; imagery appears only at the landing/import threshold and in the compact empty state.

This is deliberately not bank-blue SaaS, glassmorphism, or a generic gradient hero. Editorial asymmetry, clipped paper edges, hairline rules, and large serif headlines evoke a trustworthy household journal without imitating a bank.

## Palette

The palette comes from an evening desk, marked-up statements, and a small pool of lamplight.

| Token | Light | Dark | Role |
|---|---:|---:|---|
| `--ink` | `#19211b` | `#f4f1e7` | Primary text |
| `--muted` | `#5b665d` | `#bdc5bc` | Secondary text |
| `--paper` | `#f5f0e3` | `#151b17` | Page background |
| `--surface` | `#fffdf7` | `#202822` | Raised sheets |
| `--moss` | `#315c46` | `#9dccad` | Primary action, privacy state |
| `--moss-ink` | `#ffffff` | `#102018` | Accent contrast |
| `--coral` | `#a83b2b` | `#ff9a84` | Attention/flags |
| `--ochre` | `#9a6714` | `#f3c66e` | Warnings/change |
| `--success` | `#28734e` | `#89d5ac` | Complete state |
| `--danger` | `#a3312d` | `#ff9e95` | Errors/destructive action |
| `--rule` | `#c9c5b8` | `#465048` | Rules and controls |

Both modes meet a minimum 4.5:1 text contrast. The app follows the OS preference and offers an explicit light/dark control saved locally.

## Typography

- **Display:** Georgia, Cambria, `Times New Roman`, serif. The open shapes and uneven rhythm create an editorial voice without a network font.
- **Utility:** Inter fallback stack (`ui-sans-serif`, system UI, Segoe UI, sans-serif). It keeps dense tables and forms crisp. No external font request is made.
- Scale: 14 caption, 16 body, 20 subhead, 28 section title, clamp(40–68) display. Transaction numbers use `font-variant-numeric: tabular-nums`.

## Spacing and composition

An 8 px base rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 96. Reading measure is 68 characters. Desktop uses a 12-column editorial grid with the hero copy spanning five and the image seven; the workspace uses a narrow review rail plus a broad evidence sheet. At 390 px, the scene crops, tables become labeled stacked rows, and the persistent rail becomes a compact step strip. Targets remain at least 44 px.

Cards are reserved for independent review candidates. Related controls use proximity and hairline rules rather than nested boxes. Corners are modest (6–18 px), with occasional paper-cut asymmetric radii.

## Interaction grammar

- Import is a single obvious doorway: choose a CSV or drop it on the paper well.
- The review progresses in five numbered chapters: Import, Map, Tidy, Compare, Finish. Completed chapters gain a filled brass pin and remain editable.
- Merchant rules are explicit and reversible. Raw descriptions are always visible beside normalized names.
- Change is communicated with signed values, words, and color — never color alone.
- Every save announces itself in a polite live region. Destructive clearing names what will be erased and requires confirmation.

## Motion

Physical logic only: the hero paper scene rises 12 px and fades in over 420 ms; imported rows settle in with a 180 ms opacity transition; update/offline notices slide from the edge they occupy. Nothing loops. Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and transitions become near-instant opacity changes.

## Asset plan and provenance

- `public/art/ledger-garden-{960,1536}.{avif,webp}`: responsive AVIF with WebP fallback, explicit intrinsic dimensions, and a mobile source under 60 KB.
- `assets/src/ledger-garden.png`: generation source retained for provenance and future edits, not shipped in the built app.
- App icons and small UI marks are hand-authored SVGs using the moon/ledger motif; decorative only where labels already carry meaning.

### Hero prompt sheet

Use case: stylized-concept. Asset: wide landing-page hero. Subject: one cream bank statement folded into a winding garden path across a tiny private night landscape, tidy columns turning into stepping stones, three small recurring moons above it, a brass review pin, no people. World: handcrafted surreal editorial diorama on a dark moss desk. Materials: cut paper, matte gouache, softly worn brass, subtle paper fibres. Light: warm desk-lamp pool against deep green evening shadow. Lens/composition: 3:2 landscape, slightly elevated 50 mm editorial still life, main subject on the right, calm negative space toward the upper left, clean silhouette. Palette words: parchment, forest moss, coral pencil, antique ochre, inky charcoal. Negative list: no readable text, no numbers, no logos, no bank branding, no screens, no currency symbols, no gradients, no watermark, no photoreal people, no clutter.

Generated with the factory image deployment (`factory-image`, Azure OpenAI), 2026-08-28. Original to this product; no third-party assets or identifiable brands. The final chosen candidate is reviewed for accidental text, logos, misleading UI, seams, and palette consistency before shipping.
