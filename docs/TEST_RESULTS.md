# Test results

My own runs on 2026-10-07, Node v22.23.3, Chrome 137 (headless) for the flow check. Output pasted unedited except that per-test timings and the local checkout path were removed. No independent runs by others are recorded yet.

Summary: **51/51 unit tests**, **29/29 evals**, **50/50 browser flow checks** (25 at 1366 px, 25 at 390 px), typecheck clean, production build succeeds.

## `npx vitest run --reporter=verbose`
```
RUN  v3.2.7 .

 ✓ tests/engine.test.ts > dimensional correctness > derives items, saleable, sold, kept and orders from kg and percentages
 ✓ tests/engine.test.ts > dimensional correctness > converts origin currency to GBP by dividing by origin-per-GBP
 ✓ tests/engine.test.ts > dimensional correctness > waterfall steps sum to contribution and per-unit equals amount / kept units
 ✓ tests/engine.test.ts > dimensional correctness > doubling the lot doubles variable lines but not fixed freight or broker fee
 ✓ tests/engine.test.ts > yield loss > lower grading yield lowers kept units, raises rag kg and lowers contribution per lot
 ✓ tests/engine.test.ts > yield loss > returns reduce kept units and add return-handling cost
 ✓ tests/engine.test.ts > FX direction > GBP weakening (fewer origin units per GBP) makes goods dearer and margin worse
 ✓ tests/engine.test.ts > FX direction > fx sweep is monotonic: bigger adverse move, lower margin
 ✓ tests/engine.test.ts > FX direction > freight and returns sweeps are monotonic
 ✓ tests/engine.test.ts > VAT: cash vs expense > recoverable VAT is not an expense, but is paid at arrival and refunded later
 ✓ tests/engine.test.ts > VAT: cash vs expense > import VAT is levied on customs value plus duty
 ✓ tests/engine.test.ts > VAT: cash vs expense > slower VAT recovery raises peak cash without changing contribution
 ✓ tests/engine.test.ts > VAT: cash vs expense > final cumulative cash equals contribution (all VAT recovered by the horizon)
 ✓ tests/engine.test.ts > zero and invalid values > lotKg = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > avgItemKg = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > originPerGBP = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > gradingYieldPct = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > sellThroughPct = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > sellPricePerItem = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > itemsPerOrder = 0 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > returnsPct = 100 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > freightPerKg = -1 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > transitDays = 1.5 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > gradingYieldPct = 101 gives INVALID with no economics
 ✓ tests/engine.test.ts > zero and invalid values > NaN and Infinity are invalid
 ✓ tests/engine.test.ts > zero and invalid values > null is only allowed for duty rate
 ✓ tests/engine.test.ts > zero and invalid values > zero target GMV and bad as-of date are invalid
 ✓ tests/engine.test.ts > zero and invalid values > zero optional costs are allowed
 ✓ tests/engine.test.ts > zero and invalid values > strict date parsing
 ✓ tests/engine.test.ts > missing tariff / importer of record block scale > unknown tariff blocks even with a positive margin
 ✓ tests/engine.test.ts > missing tariff / importer of record block scale > importer of record proposed blocks
 ✓ tests/engine.test.ts > missing tariff / importer of record block scale > importer of record unknown blocks
 ✓ tests/engine.test.ts > missing tariff / importer of record block scale > a missing source or date on a critical input blocks; on a non-critical input it does not
 ✓ tests/engine.test.ts > missing tariff / importer of record block scale > stale and future-dated evidence blocks
 ✓ tests/engine.test.ts > stress, margin and capital decisions > seed cases produce the intended decisions
 ✓ tests/engine.test.ts > stress, margin and capital decisions > user margin floor moves the decision
 ✓ tests/engine.test.ts > stress, margin and capital decisions > user capital limits move the decision
 ✓ tests/engine.test.ts > stress, margin and capital decisions > negative contribution is a kill
 ✓ tests/engine.test.ts > stress, margin and capital decisions > zero stress means stress always passes when base passes
 ✓ tests/engine.test.ts > scale to target GMV (no invented demand) > units, orders and lots are derived only from target GMV and route inputs
 ✓ tests/engine.test.ts > scale to target GMV (no invented demand) > scales linearly with target
 ✓ tests/engine.test.ts > import / export > JSON round trip preserves the scenario
 ✓ tests/engine.test.ts > import / export > CSV round trip preserves the scenario including unknown tariff and quoted text
 ✓ tests/engine.test.ts > import / export > file detection is by content
 ✓ tests/engine.test.ts > import / export > export wrapper with decision log is accepted
 ✓ tests/engine.test.ts > import / export > rejects malformed JSON and bad nested fields with messages
 ✓ tests/engine.test.ts > import / export > null only accepted for nullable inputs
 ✓ tests/engine.test.ts > import / export > CSV rejects bad header, non-numeric values, duplicates, unclosed quotes and missing rows
 ✓ tests/engine.test.ts > import / export > every input key appears in the CSV
 ✓ tests/engine.test.ts > decision log > scale-gate call only allowed when engine says proceed
 ✓ tests/engine.test.ts > decision log > validates entries

 Test Files  1 passed (1)
      Tests  51 passed (51)
   Start at  08:48:05
   Duration  (transform, setup, collect, tests, environment, prepare)
```

## `npm run evals`
See `EVALS.md` for the case list; last line:
```
29/29 evals passed
```

## `npm run build`
```
> fleek-route-economics-lab@1.0.0 build
> tsc --noEmit && vite build

vite v6.4.4 building for production...
transforming...
✓ 15 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                 0.70 kB │ gzip:  0.44 kB
dist/assets/index-C_Fm3D_s.css                                 16.71 kB │ gzip:  3.65 kB
dist/assets/index-XLr2g6WB.js                                  48.66 kB │ gzip: 16.22 kB
✓ built in 226ms
```
(Montserrat font asset lines omitted.)

## `npm run flow` against the live site
`APP_URL=https://fleek-route-economics-lab.pages.dev/`: **50/50 flow checks passed** (2026-10-07, my run). Full output matched the local run below.

## `npm run flow` (against `vite preview` on port 4173)
```
PASS  desktop 1366: logo top-left
PASS  desktop 1366: footer disclaimer
PASS  desktop 1366: no horizontal page overflow
PASS  desktop 1366: no sign-in, booking or payment controls
PASS  desktop 1366: profitable pilot A proceeds
PASS  desktop 1366: profitable pilot B proceeds
PASS  desktop 1366: freight stress A holds
PASS  desktop 1366: freight stress row fails
PASS  desktop 1366: evidence gap B blocked  (Blocked: evidence gap, no scale recommendation)
PASS  desktop 1366: tariff and IOR gates listed
PASS  desktop 1366: blocked scale card says not recommended
PASS  desktop 1366: no scale-gate call offered on blocked route  (gather-evidence,kill)
PASS  desktop 1366: ticking Unknown tariff blocks Route A
PASS  desktop 1366: unticking restores Route A
PASS  desktop 1366: raising margin floor to 30% fails Route A
PASS  desktop 1366: decision recorded
PASS  desktop 1366: decision goes stale after an input edit
PASS  desktop 1366: JSON export re-imports
PASS  desktop 1366: CSV export re-imports
PASS  desktop 1366: malformed import rejected with field error  (Import rejected: bad.json was not loaded; nothing changed. routes[0].inputs.lotKg: must be a finite )
PASS  desktop 1366: rejected import leaves state unchanged
PASS  desktop 1366: zero lot weight is invalid
PASS  desktop 1366: export refused while invalid
PASS  desktop 1366: tampered saved state discarded with notice
PASS  desktop 1366: no console errors
PASS  mobile 390: logo top-left
PASS  mobile 390: footer disclaimer
PASS  mobile 390: no horizontal page overflow
PASS  mobile 390: no sign-in, booking or payment controls
PASS  mobile 390: profitable pilot A proceeds
PASS  mobile 390: profitable pilot B proceeds
PASS  mobile 390: freight stress A holds
PASS  mobile 390: freight stress row fails
PASS  mobile 390: evidence gap B blocked  (Blocked: evidence gap, no scale recommendation)
PASS  mobile 390: tariff and IOR gates listed
PASS  mobile 390: blocked scale card says not recommended
PASS  mobile 390: no scale-gate call offered on blocked route  (gather-evidence,kill)
PASS  mobile 390: ticking Unknown tariff blocks Route A
PASS  mobile 390: unticking restores Route A
PASS  mobile 390: raising margin floor to 30% fails Route A
PASS  mobile 390: decision recorded
PASS  mobile 390: decision goes stale after an input edit
PASS  mobile 390: JSON export re-imports
PASS  mobile 390: CSV export re-imports
PASS  mobile 390: malformed import rejected with field error  (Import rejected: bad.json was not loaded; nothing changed. routes[0].inputs.lotKg: must be a finite )
PASS  mobile 390: rejected import leaves state unchanged
PASS  mobile 390: zero lot weight is invalid
PASS  mobile 390: export refused while invalid
PASS  mobile 390: tampered saved state discarded with notice
PASS  mobile 390: no console errors

50/50 flow checks passed
```
