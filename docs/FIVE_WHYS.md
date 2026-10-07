# 5 Whys: why a new sourcing route can be scaled on bad economics

Each step is marked **E** (evidence from the public role/site) or **H** (hypothesis, TO TEST).

1. **Why could a new geography be scaled and then lose money?** Because the scale decision was made on a margin that did not hold at volume. (H)
2. **Why didn't the margin hold?** Because one or more landed-cost inputs (duty, freight, importer of record, last mile) were assumed, not confirmed, and moved. The role text names exactly these inputs as part of opening a geography. (E for the input list, H for the failure mode)
3. **Why were they assumed?** Because each input comes from a different counterpart on a different timeline, and the margin can be computed before all of them arrive. (H)
4. **Why did nobody stop it?** Because a spreadsheet shows a number whether or not its inputs are sourced; it does not refuse. (H)
5. **Why does that matter more for sourcing than for most decisions?** Because cash is paid up front at origin, import VAT is paid at arrival and recovered later, and sell-through takes weeks, so cash tied up at scale is large before any learning comes back. (H, illustrated by the cash curve)

**Root cause (hypothesis):** the decision tool computes a margin without refusing when a gate is unknown.
**Intervention in this concept:** fail-closed gates (tariff, IOR, dated sources, staleness), stress tests against a user-set floor, and a decision log bound to the exact inputs.
