# Source and assumption register

## Real public sources (read 2026-10-07)
| Source | Used for |
|---|---|
| Fleek role page: https://jobs.ashbyhq.com/fleek/73385aca-7753-4722-8408-ec3b855cc230 ("Special Projects Lead - Category Expansion") | Problem framing: opening a geography depends on importer of record, freight, duties, last mile and viable economics |
| Fleek website: https://joinfleek.com | Brand: logo asset, palette, Montserrat, layout rhythm (see `BRAND.md`) |

No Fleek internal data, metrics or contacts were used. Fleek was not contacted.

## Synthetic seed data
Every origin (Valdora, Ostmark, Kerrow), currency (VLD, OSK, KRW-S), supplier, quote reference (VQ-014, VQ-031, OQ-207, KQ-002) and number is invented. Rates are illustrative assumptions, **not customs classifications, tariff rulings or tax/legal advice**.

| Input | Route A pilot | Route B pilot | Source label in app | Note |
|---|---|---|---|---|
| Lot weight | 1,000 kg | 800 kg | Synthetic supplier lot sheet | |
| Average item weight | 0.5 kg | 0.6 kg | Synthetic sample weigh-in | |
| Purchase price | 9 VLD/kg | 20 OSK/kg | Synthetic supplier quote | |
| FX | 3 VLD per GBP | 6.5 OSK per GBP | Illustrative FX assumption | |
| Grading yield | 70% | 78% | Synthetic grading sample | |
| Sell-through | 90% | 85% | Illustrative | |
| Sell price | GBP 7.50 | GBP 9.00 | Illustrative buyer price point | ex VAT |
| Items per order | 12 | 10 | Illustrative | |
| Returns | 4% | 6% | Illustrative | |
| Freight | GBP 400 + 0.60/kg | GBP 650 + 0.35/kg | Synthetic forwarder quote | |
| Duty rate | 12% | 12% | Illustrative duty assumption | not a classification |
| Import VAT | 20% | 20% | Illustrative standard-rate assumption | |
| VAT recoverable | yes | yes | Illustrative assumption: VAT-registered importer | explicit assumption |
| Broker / IOR fee | GBP 150 | GBP 180 | Synthetic broker quote | |
| Last mile | GBP 8 per order | GBP 8 per order | Illustrative parcel rate | |
| Transit | 28 days | 9 days | Synthetic forwarder quote | |

Case variants:
- **Freight stress:** Route A becomes a long-haul lane: purchase 7 VLD/kg, freight GBP 600 + 1.40/kg, transit 42 days.
- **Evidence gap:** Route B becomes Kerrow direct lane: purchase 17 KRW-S/kg, freight GBP 300 + 0.50/kg, transit 6 days, **duty rate unknown**, **importer of record unknown**, no source for duty, grading yield and returns.

Default limits: margin floor 15%, pilot cash GBP 15,000, scale cash GBP 1,200,000, target GBP 5,000,000. Stress: freight +25%, GBP weakens 10%, returns +3 pts. Evidence stale after 90 days, as-of 2026-10-01. All are user-editable.

## Modelling assumptions
- Duty base = goods + freight + insurance (CIF-style). Import VAT base = that + duty. Both are simplifications for illustration.
- Revenue = net GMV (kept units × price) + rag recovery. Margin = contribution ÷ revenue.
- Sales spread evenly over the sell-through window; buyer cash lands `payoutDays` after each sale.
- Lots in flight = ceil(lots per year × cycle days ÷ 365), cycle = payback day. Cash at scale = lots in flight × peak cash per lot.
