import { INPUT_META, evidenceLabel, isCritical } from './meta';
import { parseDay } from './dates';
import {
  EVIDENCE_KEYS, INPUT_KEYS, IOR_VALUES,
  type Check, type DecisionCode, type Economics, type InputKey, type Route, type RouteResult,
  type ScaleNeed, type Scenario, type SensitivityRow, type WaterfallStep,
} from './types';

type Inputs = Record<InputKey, number>;

export function validateRoute(route: Route): string[] {
  const errors: string[] = [];
  for (const key of INPUT_KEYS) {
    const meta = INPUT_META[key];
    const v = route.inputs[key];
    if (v === null) {
      if (!meta.nullable) errors.push(`${meta.label}: value is required`);
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${meta.label}: must be a finite number`); continue; }
    if (meta.minExclusive ? v <= meta.min : v < meta.min) errors.push(`${meta.label}: must be ${meta.minExclusive ? 'greater than' : 'at least'} ${meta.min} ${meta.unit}`);
    if (v > meta.max) errors.push(`${meta.label}: must be at most ${meta.max} ${meta.unit}`);
    if (meta.integer && !Number.isInteger(v)) errors.push(`${meta.label}: must be a whole number of days`);
  }
  if (!IOR_VALUES.includes(route.importerOfRecord)) errors.push('Importer of record: must be confirmed, proposed or unknown');
  if (typeof route.vatRecoverable !== 'boolean') errors.push('VAT recoverable: must be true or false');
  return errors;
}

/** Core per-lot economics. dutyRatePct must be resolved to a number (unknown tariff is computed at 0 for display only and is a blocker). */
export function computeEconomics(x: Inputs, vatRecoverable: boolean): Economics {
  const items = x.lotKg / x.avgItemKg;
  const saleableItems = items * (x.gradingYieldPct / 100);
  const soldItems = saleableItems * (x.sellThroughPct / 100);
  const r = x.returnsPct / 100;
  const keptItems = soldItems * (1 - r);
  const orders = soldItems / x.itemsPerOrder;
  const ragKg = x.lotKg * (1 - x.gradingYieldPct / 100);

  const goodsGBP = (x.lotKg * x.purchasePricePerKg) / x.originPerGBP;
  const freightGBP = x.freightFixed + x.freightPerKg * x.lotKg;
  const insuranceGBP = (goodsGBP + freightGBP) * (x.insurancePct / 100);
  const customsValueGBP = goodsGBP + freightGBP + insuranceGBP;
  const dutyGBP = customsValueGBP * (x.dutyRatePct / 100);
  const importVatGBP = (customsValueGBP + dutyGBP) * (x.importVatPct / 100);
  const vatExpenseGBP = vatRecoverable ? 0 : importVatGBP;
  const vatRecoverableGBP = vatRecoverable ? importVatGBP : 0;

  const grossSales = soldItems * x.sellPricePerItem;
  const refunds = grossSales * r;
  const ragGBP = ragKg * x.ragValuePerKg;
  const netGMVGBP = keptItems * x.sellPricePerItem;
  const revenueGBP = netGMVGBP + ragGBP;

  const handling = items * x.handlingPerItem;
  const lastMile = orders * x.lastMilePerOrder;
  const payment = grossSales * (x.paymentFeePct / 100);
  const returnsCost = soldItems * r * x.returnCostPerItem;

  const per = (v: number) => (keptItems > 0 ? v / keptItems : 0);
  const steps: Array<[string, string, number]> = [
    ['gross', 'Gross sales to UK buyers', grossSales],
    ['refunds', 'Refunds on returns', -refunds],
    ['rag', 'Reject (rag) recovery', ragGBP],
    ['goods', 'Goods at origin (FX converted)', -goodsGBP],
    ['freight', 'Freight', -freightGBP],
    ['insurance', 'Cargo insurance', -insuranceGBP],
    ['duty', 'Duty (illustrative rate)', -dutyGBP],
    ['vat', vatRecoverable ? 'Import VAT (recoverable: cash only, not expense)' : 'Import VAT (not recoverable: expense)', -vatExpenseGBP],
    ['broker', 'Customs broker / IOR fee', -x.brokerFee],
    ['handling', 'UK receiving and grading check', -handling],
    ['lastmile', 'Last mile to buyers', -lastMile],
    ['payment', 'Payment processing', -payment],
    ['returns', 'Return handling', -returnsCost],
  ];
  const waterfall: WaterfallStep[] = steps.map(([key, label, amount]) => ({ key, label, amount: amount || 0, perUnit: per(amount) || 0 }));
  const totalCostGBP = goodsGBP + freightGBP + insuranceGBP + dutyGBP + vatExpenseGBP + x.brokerFee + handling + lastMile + payment + returnsCost;
  const contributionGBP = revenueGBP - totalCostGBP;
  waterfall.push({ key: 'contribution', label: 'Contribution', amount: contributionGBP, perUnit: per(contributionGBP) });

  // Daily cash: supplier + freight paid day 0; duty, import VAT, broker, handling at arrival;
  // sales spread evenly over the sell-through window, buyer cash lands payoutDays later;
  // recoverable import VAT comes back vatRecoveryDays after arrival.
  const arrival = x.transitDays;
  const S = x.sellThroughDays;
  const vatRefundDay = vatRecoverable && importVatGBP > 0 ? arrival + x.vatRecoveryDays : null;
  const horizon = Math.max(arrival + S + x.payoutDays, vatRefundDay ?? 0) + 1;
  const flows = new Array<number>(horizon + 1).fill(0);
  const add = (day: number, v: number) => { flows[Math.min(day, horizon)] = (flows[Math.min(day, horizon)] ?? 0) + v; };
  add(0, -(goodsGBP + freightGBP + insuranceGBP));
  add(arrival, -(dutyGBP + importVatGBP + x.brokerFee + handling));
  add(arrival + x.payoutDays, ragGBP);
  for (let i = 0; i < S; i++) {
    const d = arrival + i;
    add(d, -(lastMile + payment + returnsCost) / S);
    add(d + x.payoutDays, (grossSales - refunds) / S);
  }
  if (vatRefundDay !== null) add(vatRefundDay, importVatGBP);
  const timeline = [];
  let cum = 0, min = 0, lastNeg = -1;
  for (let d = 0; d <= horizon; d++) {
    cum += flows[d] ?? 0;
    if (cum < min) min = cum;
    if (cum < -1e-9) lastNeg = d;
    timeline.push({ day: d, cumulative: cum });
  }
  const paybackDay = cum >= -1e-9 ? lastNeg + 1 : null;

  return {
    items, saleableItems, soldItems, keptItems, orders, ragKg,
    saleableYieldPct: items > 0 ? (keptItems / items) * 100 : 0,
    goodsGBP, freightGBP, insuranceGBP, customsValueGBP, dutyGBP, importVatGBP, vatExpenseGBP, vatRecoverableGBP,
    revenueGBP, netGMVGBP, totalCostGBP, contributionGBP,
    contributionPerUnit: per(contributionGBP),
    marginPct: revenueGBP > 0 ? (contributionGBP / revenueGBP) * 100 : -Infinity,
    waterfall,
    cash: { timeline, peakCashGBP: -min, paybackDay, vatRefundDay },
  };
}

export function scaleNeed(x: Inputs, e: Economics, targetGMV: number): ScaleNeed {
  const r = x.returnsPct / 100;
  const netUnits = Math.ceil(targetGMV / x.sellPricePerItem);
  const soldUnits = Math.ceil(netUnits / (1 - r));
  const orders = Math.ceil(soldUnits / x.itemsPerOrder);
  const lots = e.netGMVGBP > 0 ? Math.ceil(targetGMV / e.netGMVGBP) : Infinity;
  const cycleDays = e.cash.paybackDay ?? e.cash.timeline.length;
  const lotsInFlight = Number.isFinite(lots) ? Math.max(1, Math.ceil((lots * cycleDays) / 365)) : Infinity;
  return {
    targetGMV, netUnits, soldUnits, orders, lots, kg: lots * x.lotKg, cycleDays, lotsInFlight,
    capitalGBP: lotsInFlight * e.cash.peakCashGBP,
  };
}

function resolved(route: Route): Inputs {
  const out = {} as Inputs;
  for (const k of INPUT_KEYS) out[k] = route.inputs[k] ?? 0;
  return out;
}

export function sensitivity(route: Route, sc: Scenario): SensitivityRow[] {
  const base = resolved(route);
  const s = sc.stress;
  const variants: Array<[SensitivityRow['key'], string, Partial<Inputs>]> = [
    ['base', 'Base case', {}],
    ['freight', `Freight +${s.freightShockPct}%`, { freightFixed: base.freightFixed * (1 + s.freightShockPct / 100), freightPerKg: base.freightPerKg * (1 + s.freightShockPct / 100) }],
    ['fx', `GBP weakens ${s.fxAdversePct}% vs origin currency`, { originPerGBP: base.originPerGBP * (1 - s.fxAdversePct / 100) }],
    ['returns', `Returns +${s.returnsShockPts} pts`, { returnsPct: Math.min(99, base.returnsPct + s.returnsShockPts) }],
    ['combined', 'All three together', {
      freightFixed: base.freightFixed * (1 + s.freightShockPct / 100), freightPerKg: base.freightPerKg * (1 + s.freightShockPct / 100),
      originPerGBP: base.originPerGBP * (1 - s.fxAdversePct / 100), returnsPct: Math.min(99, base.returnsPct + s.returnsShockPts),
    }],
  ];
  return variants.map(([key, label, patch]) => {
    const x = { ...base, ...patch };
    if (!(x.originPerGBP > 0)) return { key, label, contributionPerUnit: null, marginPct: null, passes: false };
    const e = computeEconomics(x, route.vatRecoverable);
    const passes = e.contributionGBP > 0 && e.marginPct >= sc.limits.minMarginPct;
    return { key, label, contributionPerUnit: e.contributionPerUnit, marginPct: e.marginPct, passes };
  });
}

/** Generic sweep used for the sensitivity grid: margin at a list of multipliers on one driver. */
export function sweep(route: Route, driver: 'freight' | 'fx' | 'returns', steps: number[]): Array<{ step: number; marginPct: number; contributionPerUnit: number }> {
  const base = resolved(route);
  return steps.map((step) => {
    const x = { ...base };
    if (driver === 'freight') { x.freightFixed *= 1 + step / 100; x.freightPerKg *= 1 + step / 100; }
    if (driver === 'fx') x.originPerGBP *= 1 - step / 100;
    if (driver === 'returns') x.returnsPct = Math.min(99, Math.max(0, x.returnsPct + step));
    const e = computeEconomics(x, route.vatRecoverable);
    return { step, marginPct: e.marginPct, contributionPerUnit: e.contributionPerUnit };
  });
}

const LABELS: Record<DecisionCode, string> = {
  INVALID: 'Invalid inputs: no result',
  BLOCKED_EVIDENCE: 'Blocked: evidence gap, no scale recommendation',
  KILL_NEGATIVE: 'Kill: negative contribution',
  FAIL_MARGIN: 'Fail: below margin floor',
  FAIL_CAPITAL: 'Fail: exceeds capital limit',
  HOLD_STRESS: 'Hold: fails stress test',
  PROCEED_TO_SCALE_GATE: 'Proceed to scale gate (illustrative)',
};
export const decisionLabel = (c: DecisionCode) => LABELS[c];

export function evaluateRoute(route: Route, sc: Scenario): RouteResult {
  const errors = validateRoute(route);
  const asOf = parseDay(sc.asOfDate);
  if (asOf === null) errors.push('Scenario as-of date must be a real YYYY-MM-DD date');
  const lim = sc.limits;
  for (const [k, v] of Object.entries(lim)) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors.push(`Limit ${k}: must be a non-negative number`);
  if (!(lim.targetAnnualGMV > 0)) errors.push('Limit targetAnnualGMV: must be greater than 0');
  for (const [k, v] of Object.entries(sc.stress)) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors.push(`Stress ${k}: must be a non-negative number`);
  if (sc.stress.fxAdversePct >= 100) errors.push('Stress fxAdversePct: must be below 100');

  const missing: string[] = [];
  const stale: string[] = [];
  for (const key of EVIDENCE_KEYS) {
    if (!isCritical(key)) continue;
    const ev = route.evidence[key];
    const label = evidenceLabel(key);
    if (!ev || !ev.source.trim()) { missing.push(`${label}: no source`); continue; }
    const d = parseDay(ev.sourceDate);
    if (d === null) { missing.push(`${label}: no valid source date`); continue; }
    if (asOf !== null && d > asOf) stale.push(`${label}: source dated after the as-of date (${ev.sourceDate})`);
    else if (asOf !== null && asOf - d > sc.staleAfterDays) stale.push(`${label}: source is ${asOf - d} days old (limit ${sc.staleAfterDays})`);
  }

  const checks: Check[] = [];
  const tariffKnown = route.inputs.dutyRatePct !== null;
  checks.push({ id: 'tariff', ok: tariffKnown, blocking: true, label: 'Tariff rate known', detail: tariffKnown ? `${route.inputs.dutyRatePct}% illustrative assumption` : 'Unknown tariff: duty computed at 0 for display only' });
  checks.push({ id: 'ior', ok: route.importerOfRecord === 'confirmed', blocking: true, label: 'Importer of record confirmed', detail: `Status: ${route.importerOfRecord}` });
  checks.push({ id: 'evidence', ok: missing.length === 0, blocking: true, label: 'Critical inputs have source and date', detail: missing.length ? `${missing.length} missing` : 'All critical inputs sourced' });
  checks.push({ id: 'fresh', ok: stale.length === 0, blocking: true, label: `Evidence no older than ${sc.staleAfterDays} days`, detail: stale.length ? `${stale.length} stale or future-dated` : 'All fresh' });

  if (errors.length) {
    return { routeId: route.id, valid: false, errors, economics: null, scale: null, sensitivity: [], missing, stale, checks, decision: { code: 'INVALID', label: LABELS.INVALID, reasons: errors } };
  }

  const x = resolved(route);
  const e = computeEconomics(x, route.vatRecoverable);
  const scale = scaleNeed(x, e, lim.targetAnnualGMV);
  const sens = sensitivity(route, sc);
  const positive = e.contributionGBP > 0;
  const marginOk = positive && e.marginPct >= lim.minMarginPct;
  const pilotCapOk = e.cash.peakCashGBP <= lim.maxPilotCapitalGBP;
  const scaleCapOk = Number.isFinite(scale.capitalGBP) && scale.capitalGBP <= lim.maxScaleCapitalGBP;
  const failedStress = sens.filter((s) => s.key !== 'base' && s.key !== 'combined' && !s.passes);
  checks.push({ id: 'contribution', ok: positive, blocking: false, label: 'Contribution positive', detail: `GBP ${e.contributionPerUnit.toFixed(2)} per kept unit` });
  checks.push({ id: 'margin', ok: marginOk, blocking: false, label: `Margin at least ${lim.minMarginPct}%`, detail: `${Number.isFinite(e.marginPct) ? e.marginPct.toFixed(1) : 'n/a'}%` });
  checks.push({ id: 'pilotCapital', ok: pilotCapOk, blocking: false, label: 'Pilot cash within limit', detail: `GBP ${Math.round(e.cash.peakCashGBP).toLocaleString('en-GB')} vs ${lim.maxPilotCapitalGBP.toLocaleString('en-GB')}` });
  checks.push({ id: 'scaleCapital', ok: scaleCapOk, blocking: false, label: 'Scale cash within limit', detail: Number.isFinite(scale.capitalGBP) ? `GBP ${Math.round(scale.capitalGBP).toLocaleString('en-GB')} vs ${lim.maxScaleCapitalGBP.toLocaleString('en-GB')}` : 'No net GMV per lot' });
  checks.push({ id: 'stress', ok: failedStress.length === 0, blocking: false, label: 'Passes single stresses', detail: failedStress.length ? `Fails: ${failedStress.map((s) => s.label).join('; ')}` : 'Freight, FX and returns stresses all pass' });

  const reasons: string[] = [];
  const blockers = checks.filter((c) => c.blocking && !c.ok);
  let code: DecisionCode;
  if (blockers.length) {
    code = 'BLOCKED_EVIDENCE';
    reasons.push(...blockers.map((b) => `${b.label}: ${b.detail}`));
    if (positive) reasons.push('Margin is positive, but scale stays blocked until the gaps close.');
  } else if (!positive) code = 'KILL_NEGATIVE';
  else if (!marginOk) code = 'FAIL_MARGIN';
  else if (!pilotCapOk || !scaleCapOk) code = 'FAIL_CAPITAL';
  else if (failedStress.length) code = 'HOLD_STRESS';
  else code = 'PROCEED_TO_SCALE_GATE';
  if (code !== 'BLOCKED_EVIDENCE') reasons.push(...checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`));
  if (code === 'PROCEED_TO_SCALE_GATE') reasons.push('All gates pass on illustrative assumptions. Demand for the target volume is not evidenced here.');

  return { routeId: route.id, valid: true, errors: [], economics: e, scale, sensitivity: sens, missing, stale, checks, decision: { code, label: LABELS[code], reasons } };
}

export function evaluateScenario(sc: Scenario): [RouteResult, RouteResult] {
  return [evaluateRoute(sc.routes[0], sc), evaluateRoute(sc.routes[1], sc)];
}
