# Test plan

| Area | What is checked | How |
|---|---|---|
| Dimensional correctness | items = kg ÷ kg/item; GBP = origin ÷ (origin/GBP); waterfall sums to contribution; per-unit = amount ÷ kept units; fixed vs variable scaling | Vitest `tests/engine.test.ts` |
| Yield loss | grading yield and returns reduce kept units and contribution; rag kg rises | Vitest |
| FX direction | fewer origin units per GBP raises GBP cost and lowers margin; sweep monotonic | Vitest, sweep grid |
| VAT cash vs expense | recoverable VAT is not an expense but is paid at arrival and refunded on day transit + recovery; non-recoverable VAT is an expense; final cumulative cash equals contribution | Vitest, eval E14 |
| Zero / invalid values | zero/negative/NaN/Infinity/out-of-range/non-integer days give INVALID; null only for duty; bad dates | Vitest, evals E15-E17 |
| Missing tariff / importer | unknown tariff, proposed/unknown IOR, missing source/date, stale and future-dated evidence each block | Vitest, evals E04-E09, E18 |
| Stress decisions | seeded cases give intended codes; user margin/capital limits move the decision; zero stress passes | Vitest, evals E01-E03, E10-E12, E19-E20 |
| Scale math | units/orders/lots derived only from target and route inputs; linear in target | Vitest |
| Import/export | JSON and CSV round trips; nested field validation; CSV quoting, duplicates, missing rows; content-based detection; decision-log validation | Vitest, evals |
| UI flows | case switching, gate toggles, limits, decision log staleness, export/re-import, rejected import, invalid export refusal, tampered localStorage, no sign-in/booking/payment controls, desktop and 390 px | `scripts/flow-check.mjs` (Chrome via playwright-core) |
| Visual | rendered screenshots at 1366 px and 390 px reviewed | manual |

Commands: `npm test`, `npm run evals`, `npm run build`, then `npx vite preview --port 4173` and `CHROME_PATH=<chrome> npm run flow`.
