# Visual guide

How the brand sheet (`docs/BRAND.md`) maps onto the route calculator. Written before the UI code.

## Layout (desktop first, 1280 px max width)
1. Disclaimer strip (site promo-strip position): "Independent concept by Ayomide Ahmed. Not an official Fleek product. All data synthetic; every rate is an editable illustrative assumption, not customs classification or tax/legal advice."
2. Header: Fleek wordmark top-left, then the product name "Route Economics Lab", then section nav (Compare, Assumptions, Sensitivity, Cash, Scale, Evidence, Decision log, Docs). Right side: case selector and Import / Export buttons (black outline; Export is a black pill). No Sign Up/Login.
3. Black hero band: headline "Open a sourcing route **on evidence**" with the last phrase in yellow; one-line case description; the two route verdict badges.
4. Compare: two route cards side by side (stack below 900 px) with verdict, contribution per unit, margin, saleable yield, cash tied up, and the cost waterfall.
5. Limits panel (cream): margin floor, pilot capital limit, scale capital limit, GMV target, stress settings.
6. Assumptions grid (cream band): one row per input, columns Route A / Route B, each cell holds value, source and source date.
7. Sensitivity, cash timing, scale-to-target, evidence and missing inputs, decision log, import/export.
8. Footer: "Independent concept by Ayomide Ahmed · Not an official Fleek product" plus docs links.

## Verdict colours
| Decision | Badge |
|---|---|
| Proceed to scale gate | yellow `#f8c642` on black text |
| Hold: fails stress | orange `#f25c2a`, black text |
| Blocked: evidence gap / Kill / Fail / Invalid | deep red `#b42318`, white text (6.5:1; the site sale red `#f04438` is only 3.6:1 with white, so it is kept for borders) |

## Charts
- Waterfall: horizontal bars, revenue in black, each cost in grey `#98a2b3`, contribution in yellow (positive) or red (negative); the value is shown in text next to every bar (no colour-only meaning).
- Cash curve: SVG line of cumulative cash by day, zero line, peak cash marker, VAT refund marker.

## Type scale
H1 44/700 (28 mobile) · H2 24/700 · card title 15/700 · body 15/500 · table 13/500 · eyebrow 11/700 uppercase 1.5 px tracking. Numbers use `font-variant-numeric: tabular-nums`.

## Accessibility
Text contrast >= 4.5:1 (black on yellow 11:1, white on deep red `#b42318` 6.5:1, white on orange is too low so the hold badge uses black text on orange), visible focus ring in `#0d2bff`, every input has a label, verdicts are text, not just colour.
