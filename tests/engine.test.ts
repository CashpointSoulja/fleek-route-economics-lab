import { describe, expect, it } from 'vitest';
import {
  allowedCalls, computeEconomics, evaluateRoute, evaluateScenario, fingerprint, INPUT_KEYS, parseCSVRows, parseDay,
  parseDecisionLog, parseScenario, parseScenarioCSV, parseScenarioFile, parseScenarioJSON, scenarioToCSV, seedScenarios, sweep,
  type InputKey, type Scenario,
} from '../src/engine';

const pilot = () => seedScenarios()[0]!;
const stressCase = () => seedScenarios()[1]!;
const gap = () => seedScenarios()[2]!;
const nums = (sc: Scenario, i = 0) => sc.routes[i]!.inputs as Record<InputKey, number>;
const close = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe('dimensional correctness', () => {
  it('derives items, saleable, sold, kept and orders from kg and percentages', () => {
    const x = nums(pilot());
    const e = computeEconomics(x, true);
    close(e.items, 1000 / 0.5);
    close(e.saleableItems, 2000 * 0.7);
    close(e.soldItems, 1400 * 0.9);
    close(e.keptItems, 1260 * 0.96);
    close(e.orders, 1260 / 12);
    close(e.ragKg, 1000 * 0.3);
  });
  it('converts origin currency to GBP by dividing by origin-per-GBP', () => {
    const e = computeEconomics(nums(pilot()), true);
    close(e.goodsGBP, (1000 * 9) / 3);
  });
  it('waterfall steps sum to contribution and per-unit equals amount / kept units', () => {
    const e = computeEconomics(nums(pilot()), false);
    const steps = e.waterfall.filter((s) => s.key !== 'contribution');
    close(steps.reduce((a, s) => a + s.amount, 0), e.contributionGBP, 1e-6);
    for (const s of e.waterfall) close(s.perUnit, s.amount / e.keptItems, 1e-9);
    close(e.contributionGBP, e.revenueGBP - e.totalCostGBP, 1e-6);
  });
  it('doubling the lot doubles variable lines but not fixed freight or broker fee', () => {
    const x = nums(pilot());
    const a = computeEconomics(x, true), b = computeEconomics({ ...x, lotKg: x.lotKg * 2 }, true);
    close(b.netGMVGBP, a.netGMVGBP * 2);
    close(b.goodsGBP, a.goodsGBP * 2);
    close(b.freightGBP - a.freightGBP, x.freightPerKg * x.lotKg);
    const broker = (e: typeof a) => e.waterfall.find((s) => s.key === 'broker')!.amount;
    expect(broker(b)).toBe(broker(a));
  });
});

describe('yield loss', () => {
  it('lower grading yield lowers kept units, raises rag kg and lowers contribution per lot', () => {
    const x = nums(pilot());
    const hi = computeEconomics(x, true), lo = computeEconomics({ ...x, gradingYieldPct: 50 }, true);
    expect(lo.keptItems).toBeLessThan(hi.keptItems);
    expect(lo.ragKg).toBeGreaterThan(hi.ragKg);
    expect(lo.contributionGBP).toBeLessThan(hi.contributionGBP);
    close(lo.saleableYieldPct, 50 * 0.9 * 0.96);
  });
  it('returns reduce kept units and add return-handling cost', () => {
    const x = nums(pilot());
    const a = computeEconomics({ ...x, returnsPct: 0 }, true), b = computeEconomics({ ...x, returnsPct: 20 }, true);
    close(b.keptItems, a.keptItems * 0.8);
    expect(a.waterfall.find((s) => s.key === 'returns')!.amount).toBe(0);
    expect(b.waterfall.find((s) => s.key === 'returns')!.amount).toBeLessThan(0);
  });
});

describe('FX direction', () => {
  it('GBP weakening (fewer origin units per GBP) makes goods dearer and margin worse', () => {
    const x = nums(pilot());
    const base = computeEconomics(x, true), weak = computeEconomics({ ...x, originPerGBP: x.originPerGBP * 0.9 }, true);
    expect(weak.goodsGBP).toBeGreaterThan(base.goodsGBP);
    expect(weak.marginPct).toBeLessThan(base.marginPct);
    const strong = computeEconomics({ ...x, originPerGBP: x.originPerGBP * 1.1 }, true);
    expect(strong.marginPct).toBeGreaterThan(base.marginPct);
  });
  it('fx sweep is monotonic: bigger adverse move, lower margin', () => {
    const s = sweep(pilot().routes[0], 'fx', [0, 5, 10, 20]);
    for (let i = 1; i < s.length; i++) expect(s[i]!.marginPct).toBeLessThan(s[i - 1]!.marginPct);
  });
  it('freight and returns sweeps are monotonic', () => {
    for (const d of ['freight', 'returns'] as const) {
      const s = sweep(pilot().routes[0], d, [0, 10, 25, 50]);
      for (let i = 1; i < s.length; i++) expect(s[i]!.marginPct).toBeLessThan(s[i - 1]!.marginPct);
    }
  });
});

describe('VAT: cash vs expense', () => {
  it('recoverable VAT is not an expense, but is paid at arrival and refunded later', () => {
    const x = nums(pilot());
    const rec = computeEconomics(x, true), non = computeEconomics(x, false);
    close(rec.importVatGBP, non.importVatGBP);
    expect(rec.vatExpenseGBP).toBe(0);
    close(rec.vatRecoverableGBP, rec.importVatGBP);
    close(non.vatExpenseGBP, non.importVatGBP);
    close(rec.contributionGBP - non.contributionGBP, rec.importVatGBP, 1e-6);
    expect(rec.cash.vatRefundDay).toBe(x.transitDays + x.vatRecoveryDays);
    expect(non.cash.vatRefundDay).toBeNull();
  });
  it('import VAT is levied on customs value plus duty', () => {
    const e = computeEconomics(nums(pilot()), true);
    close(e.importVatGBP, (e.customsValueGBP + e.dutyGBP) * 0.2);
    close(e.dutyGBP, e.customsValueGBP * 0.12);
  });
  it('slower VAT recovery raises peak cash without changing contribution', () => {
    const x = nums(pilot());
    const fast = computeEconomics({ ...x, vatRecoveryDays: 0 }, true), slow = computeEconomics({ ...x, vatRecoveryDays: 120 }, true);
    close(fast.contributionGBP, slow.contributionGBP);
    expect(slow.cash.peakCashGBP).toBeGreaterThan(fast.cash.peakCashGBP);
  });
  it('final cumulative cash equals contribution (all VAT recovered by the horizon)', () => {
    for (const rec of [true, false]) {
      const e = computeEconomics(nums(pilot()), rec);
      close(e.cash.timeline.at(-1)!.cumulative, e.contributionGBP, 1e-6);
    }
  });
});

describe('zero and invalid values', () => {
  const bad: Array<[InputKey, number]> = [['lotKg', 0], ['avgItemKg', 0], ['originPerGBP', 0], ['gradingYieldPct', 0], ['sellThroughPct', 0], ['sellPricePerItem', 0], ['itemsPerOrder', 0], ['returnsPct', 100], ['freightPerKg', -1], ['transitDays', 1.5], ['gradingYieldPct', 101]];
  it.each(bad)('%s = %s gives INVALID with no economics', (k, v) => {
    const sc = pilot(); sc.routes[0].inputs[k] = v;
    const r = evaluateRoute(sc.routes[0], sc);
    expect(r.decision.code).toBe('INVALID');
    expect(r.economics).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('NaN and Infinity are invalid', () => {
    for (const v of [NaN, Infinity]) { const sc = pilot(); sc.routes[0].inputs.freightFixed = v; expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('INVALID'); }
  });
  it('null is only allowed for duty rate', () => {
    const sc = pilot(); sc.routes[0].inputs.lotKg = null;
    expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('INVALID');
  });
  it('zero target GMV and bad as-of date are invalid', () => {
    const a = pilot(); a.limits.targetAnnualGMV = 0; expect(evaluateRoute(a.routes[0], a).decision.code).toBe('INVALID');
    const b = pilot(); b.asOfDate = '2026-02-30'; expect(evaluateRoute(b.routes[0], b).decision.code).toBe('INVALID');
  });
  it('zero optional costs are allowed', () => {
    const sc = pilot(); for (const k of ['ragValuePerKg', 'insurancePct', 'handlingPerItem', 'paymentFeePct', 'returnsPct', 'transitDays', 'payoutDays'] as InputKey[]) sc.routes[0].inputs[k] = 0;
    expect(evaluateRoute(sc.routes[0], sc).valid).toBe(true);
  });
  it('strict date parsing', () => {
    expect(parseDay('2026-10-01')).not.toBeNull();
    for (const d of ['2026-13-01', '2026-02-29', '26-10-01', '2026-10-1', '', 'yesterday', 20261001]) expect(parseDay(d)).toBeNull();
    expect(parseDay('2028-02-29')).not.toBeNull();
  });
});

describe('missing tariff / importer of record block scale', () => {
  it('unknown tariff blocks even with a positive margin', () => {
    const sc = pilot(); sc.routes[0].inputs.dutyRatePct = null;
    const r = evaluateRoute(sc.routes[0], sc);
    expect(r.economics!.contributionGBP).toBeGreaterThan(0);
    expect(r.decision.code).toBe('BLOCKED_EVIDENCE');
    expect(r.decision.reasons.join(' ')).toMatch(/Tariff/);
  });
  it.each(['proposed', 'unknown'] as const)('importer of record %s blocks', (s) => {
    const sc = pilot(); sc.routes[0].importerOfRecord = s;
    expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('BLOCKED_EVIDENCE');
  });
  it('a missing source or date on a critical input blocks; on a non-critical input it does not', () => {
    const a = pilot(); a.routes[0].evidence.freightPerKg = { source: '', sourceDate: '2026-09-01' };
    expect(evaluateRoute(a.routes[0], a).decision.code).toBe('BLOCKED_EVIDENCE');
    const b = pilot(); b.routes[0].evidence.freightPerKg = { source: 'x', sourceDate: '' };
    expect(evaluateRoute(b.routes[0], b).decision.code).toBe('BLOCKED_EVIDENCE');
    const c = pilot(); c.routes[0].evidence.insurancePct = { source: '', sourceDate: '' };
    expect(evaluateRoute(c.routes[0], c).decision.code).toBe('PROCEED_TO_SCALE_GATE');
  });
  it('stale and future-dated evidence blocks', () => {
    const a = pilot(); a.routes[0].evidence.lotKg.sourceDate = '2026-01-01';
    expect(evaluateRoute(a.routes[0], a).stale.length).toBe(1);
    expect(evaluateRoute(a.routes[0], a).decision.code).toBe('BLOCKED_EVIDENCE');
    const b = pilot(); b.routes[0].evidence.lotKg.sourceDate = '2026-12-01';
    expect(evaluateRoute(b.routes[0], b).decision.code).toBe('BLOCKED_EVIDENCE');
  });
});

describe('stress, margin and capital decisions', () => {
  it('seed cases produce the intended decisions', () => {
    expect(evaluateScenario(pilot()).map((r) => r.decision.code)).toEqual(['PROCEED_TO_SCALE_GATE', 'PROCEED_TO_SCALE_GATE']);
    const [sa, sb] = evaluateScenario(stressCase());
    expect(sa.decision.code).toBe('HOLD_STRESS');
    expect(sa.economics!.marginPct).toBeGreaterThanOrEqual(15);
    expect(sa.sensitivity.find((s) => s.key === 'freight')!.passes).toBe(false);
    expect(sa.sensitivity.find((s) => s.key === 'fx')!.passes).toBe(true);
    expect(sb.decision.code).toBe('PROCEED_TO_SCALE_GATE');
    const [ga, gb] = evaluateScenario(gap());
    expect(ga.decision.code).toBe('PROCEED_TO_SCALE_GATE');
    expect(gb.decision.code).toBe('BLOCKED_EVIDENCE');
    expect(gb.economics!.marginPct).toBeGreaterThan(ga.economics!.marginPct);
    expect(gb.missing.length).toBeGreaterThan(0);
  });
  it('user margin floor moves the decision', () => {
    const sc = pilot(); sc.limits.minMarginPct = 30;
    expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('FAIL_MARGIN');
  });
  it('user capital limits move the decision', () => {
    const a = pilot(); a.limits.maxPilotCapitalGBP = 1000; expect(evaluateRoute(a.routes[0], a).decision.code).toBe('FAIL_CAPITAL');
    const b = pilot(); b.limits.maxScaleCapitalGBP = 1000; expect(evaluateRoute(b.routes[0], b).decision.code).toBe('FAIL_CAPITAL');
  });
  it('negative contribution is a kill', () => {
    const sc = pilot(); sc.routes[0].inputs.sellPricePerItem = 2;
    expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('KILL_NEGATIVE');
  });
  it('zero stress means stress always passes when base passes', () => {
    const sc = stressCase(); sc.stress = { freightShockPct: 0, fxAdversePct: 0, returnsShockPts: 0 };
    expect(evaluateRoute(sc.routes[0], sc).decision.code).toBe('PROCEED_TO_SCALE_GATE');
  });
});

describe('scale to target GMV (no invented demand)', () => {
  it('units, orders and lots are derived only from target GMV and route inputs', () => {
    const sc = pilot(); const r = evaluateRoute(sc.routes[0], sc); const s = r.scale!; const x = nums(sc);
    expect(s.netUnits).toBe(Math.ceil(5_000_000 / x.sellPricePerItem));
    expect(s.soldUnits).toBe(Math.ceil(s.netUnits / (1 - x.returnsPct / 100)));
    expect(s.orders).toBe(Math.ceil(s.soldUnits / x.itemsPerOrder));
    expect(s.lots).toBe(Math.ceil(5_000_000 / r.economics!.netGMVGBP));
    expect(s.lots * r.economics!.netGMVGBP).toBeGreaterThanOrEqual(5_000_000);
    expect(s.kg).toBe(s.lots * x.lotKg);
  });
  it('scales linearly with target', () => {
    const a = pilot(); const b = pilot(); b.limits.targetAnnualGMV = 10_000_000;
    const ua = evaluateRoute(a.routes[0], a).scale!.netUnits, ub = evaluateRoute(b.routes[0], b).scale!.netUnits;
    expect(Math.abs(ub - 2 * ua)).toBeLessThanOrEqual(1);
  });
});

describe('import / export', () => {
  it('JSON round trip preserves the scenario', () => {
    for (const sc of seedScenarios()) {
      const p = parseScenarioJSON(JSON.stringify(sc));
      expect(p.ok && p.value).toEqual(sc);
    }
  });
  it('CSV round trip preserves the scenario including unknown tariff and quoted text', () => {
    for (const sc of seedScenarios()) {
      sc.description = 'Has, commas and "quotes"\nand a newline';
      const p = parseScenarioCSV(scenarioToCSV(sc));
      expect(p.ok && p.value).toEqual(sc);
      expect(p.ok && fingerprint(p.value)).toBe(fingerprint(sc));
    }
  });
  it('file detection is by content', () => {
    const sc = pilot();
    expect(parseScenarioFile(JSON.stringify(sc)).ok).toBe(true);
    expect(parseScenarioFile('\uFEFF' + scenarioToCSV(sc)).ok).toBe(true);
    expect(parseScenarioFile('hello').ok).toBe(false);
  });
  it('export wrapper with decision log is accepted', () => {
    expect(parseScenario({ scenario: pilot(), decisionLog: [] }).ok).toBe(true);
  });
  it('rejects malformed JSON and bad nested fields with messages', () => {
    expect(parseScenarioJSON('{').ok).toBe(false);
    const sc = pilot() as unknown as Record<string, any>;
    sc.routes[0].inputs.lotKg = '1000';
    sc.routes[1].evidence.lotKg.sourceDate = '2026-02-31';
    sc.routes[1].importerOfRecord = 'maybe';
    sc.routes[0].inputs.extra = 1;
    const p = parseScenario(sc);
    expect(p.ok).toBe(false);
    if (!p.ok) {
      const all = p.errors.join('\n');
      expect(all).toMatch(/inputs\.lotKg/); expect(all).toMatch(/sourceDate/); expect(all).toMatch(/importerOfRecord/); expect(all).toMatch(/extra/);
    }
  });
  it('null only accepted for nullable inputs', () => {
    const sc = pilot() as unknown as Record<string, any>; sc.routes[0].inputs.freightFixed = null;
    expect(parseScenario(sc).ok).toBe(false);
  });
  it('CSV rejects bad header, non-numeric values, duplicates, unclosed quotes and missing rows', () => {
    const csv = scenarioToCSV(pilot());
    expect(parseScenarioCSV(csv.replace('section,', 'sect,')).ok).toBe(false);
    expect(parseScenarioCSV(csv.replace('input,A,lotKg,1000', 'input,A,lotKg,1e3x')).ok).toBe(false);
    const lines = csv.trim().split('\n');
    expect(parseScenarioCSV([...lines, lines[lines.length - 1]].join('\n')).ok).toBe(false);
    expect(parseScenarioCSV(lines.filter((l) => !l.startsWith('input,B,lotKg')).join('\n')).ok).toBe(false);
    expect(parseCSVRows('a,"b').ok).toBe(false);
    expect(parseCSVRows('a,"b"c').ok).toBe(false);
    expect(parseScenarioCSV(csv.replace('input,A,lotKg,1000', 'input,A,lotKg,')).ok).toBe(false);
  });
  it('every input key appears in the CSV', () => {
    const csv = scenarioToCSV(pilot());
    for (const k of INPUT_KEYS) expect(csv).toContain(`input,A,${k},`);
  });
});

describe('decision log', () => {
  it('scale-gate call only allowed when engine says proceed', () => {
    expect(allowedCalls('PROCEED_TO_SCALE_GATE')).toContain('scale-gate');
    for (const c of ['BLOCKED_EVIDENCE', 'HOLD_STRESS', 'FAIL_MARGIN', 'FAIL_CAPITAL', 'KILL_NEGATIVE', 'INVALID'] as const) expect(allowedCalls(c)).not.toContain('scale-gate');
  });
  it('validates entries', () => {
    const good = { id: '1', at: '2026-10-07T08:00:00Z', scenarioId: 'x', routeId: 'A', decisionCode: 'BLOCKED_EVIDENCE', call: 'gather-evidence', note: '', fingerprint: 'abc' };
    expect(parseDecisionLog([good]).ok).toBe(true);
    expect(parseDecisionLog([{ ...good, call: 'scale-gate' }]).ok).toBe(false);
    expect(parseDecisionLog([{ ...good, at: 'nope' }]).ok).toBe(false);
    expect(parseDecisionLog({}).ok).toBe(false);
  });
});
