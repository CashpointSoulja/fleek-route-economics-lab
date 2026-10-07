# PRD: Route Economics Lab

Independent concept by Ayomide Ahmed for the Fleek "Special Projects Lead - Category Expansion" role. Not an official Fleek product. All data synthetic.

## Problem (hypothesis)
The public role description says opening a new sourcing geography depends on importer-of-record, freight cost, duties and last-mile working out, and on the economics being viable. My hypothesis (TO TEST) is that these inputs arrive from different people at different times (a forwarder quote, a broker note, a grading sample), so a route can look profitable on a spreadsheet while one gate is still unknown. The risk is scaling a route whose margin depends on a tariff nobody has confirmed or an importer of record nobody has signed.

## Users
- Primary: the special projects / category expansion lead deciding whether a route goes to a pilot lot and then to a scale gate.
- Secondary: finance (cash tied up, VAT timing), ops (freight, grading yield, last mile), leadership reading the decision log.

## Goals
1. Compare two candidate routes into UK buyers on one screen: landed cost waterfall, saleable yield, contribution per kept unit, margin, cash tied up per lot.
2. Show how fragile the result is to freight, FX and returns.
3. Refuse a scale recommendation when tariff or importer of record is unknown, or when critical inputs lack a dated source, even if the margin is positive.
4. Translate an illustrative GBP 5M annual GMV target into units, orders, lots, kg and cash at scale, using only the route's own inputs. No demand is invented.
5. Record the human call against the exact inputs (fingerprint), and let the scenario travel as JSON or CSV.

## Non-goals
- Customs classification, tariff lookup, tax or legal advice.
- Live freight quotes, FX feeds, supplier contact, booking, ordering, payment.
- Forecasting demand.

## Functional requirements
| ID | Requirement | Where |
|---|---|---|
| F1 | Two routes, every input editable with unit, source and source date | Assumptions |
| F2 | Cost waterfall per lot and per kept unit | Compare |
| F3 | Import VAT split into expense vs recoverable; recoverability is an explicit, sourced assumption; refund day shown on the cash curve | Compare, Cash |
| F4 | Saleable yield = kept units / purchased items, after grading, sell-through and returns | Compare |
| F5 | Cash timeline per lot: peak cash, payback day, VAT refund day | Cash |
| F6 | Sensitivity: freight +x%, GBP weakens y%, returns +z pts, each against the margin floor; sweep grid | Sensitivity |
| F7 | User-set margin floor, pilot capital limit, scale capital limit, GMV target, stress sizes, staleness window | Limits |
| F8 | Gates: tariff known, IOR confirmed, critical inputs sourced and dated, evidence not stale or future-dated. Any failure gives BLOCKED_EVIDENCE regardless of margin | Evidence |
| F9 | Decision order: INVALID, BLOCKED_EVIDENCE, KILL_NEGATIVE, FAIL_MARGIN, FAIL_CAPITAL, HOLD_STRESS, PROCEED_TO_SCALE_GATE | Engine |
| F10 | Scale to target: net units, sold units, orders, lots, kg, lots in flight, cash at scale | Scale |
| F11 | Decision log bound to a scenario fingerprint; entries go stale when inputs change; scale-gate call only offered on PROCEED | Decision log |
| F12 | JSON and CSV import/export; imports validated field by field, rejected whole on any error; format detected by content | Import / export |
| F13 | Three seeded synthetic cases: profitable pilot, freight stress failure, evidence gap | Case picker |

## Acceptance criteria
- Unknown tariff or non-confirmed IOR on a positive-margin route shows "Blocked" (unit tests, evals E04-E06, flow check).
- Toggling VAT recoverability changes contribution by exactly the import VAT and moves the refund marker (unit tests, E14).
- Zero / negative / out-of-range / non-numeric inputs give INVALID with field messages, and export is refused (unit tests, E15-E17, flow check).
- Every number in the scale view is reproducible from the formulas in `ELI5.md` (unit tests).
- No sign-in, booking, ordering, outreach or payment controls exist (flow check).

## Out of scope for v1, see `ROADMAP.md`.
