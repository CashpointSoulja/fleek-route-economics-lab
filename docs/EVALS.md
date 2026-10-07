# Eval cases and results

`scripts/evals.ts` builds each case from the synthetic seeds, applies one change, and checks the engine decision. It exits non-zero on any mismatch. Run: `npm run evals`.

Decision order the engine applies: INVALID → BLOCKED_EVIDENCE → KILL_NEGATIVE → FAIL_MARGIN → FAIL_CAPITAL → HOLD_STRESS → PROCEED_TO_SCALE_GATE. Evidence gates come before economics on purpose, so a positive margin can never mask an unknown tariff or importer of record (E04, E05, E18).

## Results (actual output, 2026-10-07)
| ID | Case | Expected | Actual | Margin | Result |
|---|---|---|---|---|---|
| E01 | Profitable pilot, Route A | PROCEED_TO_SCALE_GATE | PROCEED_TO_SCALE_GATE | 24.4% | PASS |
| E02 | Profitable pilot, Route B | PROCEED_TO_SCALE_GATE | PROCEED_TO_SCALE_GATE | 22.3% | PASS |
| E03 | Freight stress: long-haul Route A passes base margin, fails +25% freight | HOLD_STRESS | HOLD_STRESS | 20.3% | PASS |
| E04 | Evidence gap: Route B best margin but unknown tariff + IOR + missing sources | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 35.8% | PASS |
| E05 | Unknown tariff alone on a passing route | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 29.7% | PASS |
| E06 | Importer of record only "proposed" | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 24.4% | PASS |
| E07 | Freight quote 120 days old | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 24.4% | PASS |
| E08 | Freight quote dated in the future | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 24.4% | PASS |
| E09 | Impossible source date 2026-02-30 | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | 24.4% | PASS |
| E10 | Margin floor raised to 25% | FAIL_MARGIN | FAIL_MARGIN | 24.4% | PASS |
| E11 | Pilot capital limit GBP 5,000 | FAIL_CAPITAL | FAIL_CAPITAL | 24.4% | PASS |
| E12 | Scale capital limit GBP 500,000 | FAIL_CAPITAL | FAIL_CAPITAL | 24.4% | PASS |
| E13 | Sell price cut to GBP 3 | KILL_NEGATIVE | KILL_NEGATIVE | -83.3% | PASS |
| E14 | VAT not recoverable: import VAT becomes expense | FAIL_MARGIN | FAIL_MARGIN | 12.1% | PASS |
| E15 | Zero lot weight | INVALID | INVALID | n/a | PASS |
| E16 | Negative freight | INVALID | INVALID | n/a | PASS |
| E17 | Returns 100% | INVALID | INVALID | n/a | PASS |
| E18 | Unknown tariff AND negative contribution still reports the evidence block first | BLOCKED_EVIDENCE | BLOCKED_EVIDENCE | -70.1% | PASS |
| E19 | Closing the gaps on evidence-gap Route B (tariff 12%, IOR confirmed, sources dated) | PROCEED_TO_SCALE_GATE | PROCEED_TO_SCALE_GATE | 31.3% | PASS |
| E20 | Stress off (0/0/0) on freight-stress Route A | PROCEED_TO_SCALE_GATE | PROCEED_TO_SCALE_GATE | 20.3% | PASS |

| Import/export eval | Expected ok | Actual ok | Result |
|---|---|---|---|
| JSON round trip profitable-pilot | true | true | PASS |
| CSV round trip profitable-pilot | true | true | PASS |
| JSON round trip freight-stress | true | true | PASS |
| CSV round trip freight-stress | true | true | PASS |
| JSON round trip evidence-gap | true | true | PASS |
| CSV round trip evidence-gap | true | true | PASS |
| Reject truncated JSON | false | false | PASS |
| Reject CSV with unclosed quote | false | false | PASS |
| Reject plain text | false | false | PASS |

29/29 evals passed
