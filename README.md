# Route Economics Lab

**Independent concept by Ayomide Ahmed. Not an official Fleek product.** Built for the Fleek "Special Projects Lead - Category Expansion" application. All data is synthetic; every rate is an editable illustrative assumption, **not a customs classification or tax/legal advice**.

A desktop-first, responsive calculator that compares two synthetic sourcing routes into UK buyers and decides, fail-closed, whether either route may go to a scale gate.

- Cost waterfall per lot and per kept unit (goods, freight, insurance, duty, import VAT, broker/IOR, handling, last mile, payment, returns)
- Saleable yield after grading, sell-through and returns
- Import VAT split into **expense** vs **recoverable cash**; recoverability is an explicit, sourced assumption; refund day shown on the cash curve
- Cash tied up per lot, payback day, cash at scale
- Sensitivity to freight, FX and returns against a user-set margin floor, plus a sweep grid
- **Unknown tariff, an importer of record that is not confirmed, or a critical input without a dated source blocks a scale recommendation even when margin is positive**
- Orders, units, lots and kg required for an illustrative GBP 5M annual GMV, derived only from route inputs (no demand is invented)
- Evidence fields, source dates, missing/stale inputs, decision log bound to a scenario fingerprint
- Scenario JSON/CSV import and export, validated field by field
- Three cases: **Profitable pilot**, **Freight stress failure**, **Evidence gap**

No booking, ordering, outreach or payment actions exist. No sign-in.

## Run
```
npm ci
npm run dev        # local
npm test           # unit tests (Vitest)
npm run evals      # eval cases
npm run build      # typecheck + production build to dist/
npx vite preview --port 4173 &
CHROME_PATH=<path to chrome> npm run flow   # browser flow checks
```

## Docs
[PRD](docs/PRD.md) · [ELI5](docs/ELI5.md) · [5 Whys](docs/FIVE_WHYS.md) · [JTBD](docs/JTBD.md) · [Source and assumption register](docs/SOURCE_REGISTER.md) · [Viability memo](docs/VIABILITY_MEMO.md) · [Metrics](docs/METRICS.md) · [Test plan](docs/TEST_PLAN.md) · [Test results](docs/TEST_RESULTS.md) · [Evals](docs/EVALS.md) · [Limitations](docs/LIMITATIONS.md) · [Roadmap](docs/ROADMAP.md) · [Deployment](docs/DEPLOYMENT.md) · [Brand sheet](docs/BRAND.md) · [Visual guide](docs/VISUAL_GUIDE.md)

## Structure
- `src/engine/` pure TypeScript model: validation, economics, cash timing, sensitivity, gates, scale, import/export, seed cases
- `src/main.ts`, `src/style.css` UI (no framework)
- `tests/engine.test.ts` unit tests · `scripts/evals.ts` eval cases · `scripts/flow-check.mjs` browser flows

The Fleek name and logo belong to Fleek and are used only to show which company this concept is addressed to. Code is MIT licensed.
