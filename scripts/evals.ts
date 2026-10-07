// Eval harness: named cases with expected engine decisions. Prints a Markdown table; exits 1 on any mismatch.
import { evaluateRoute, parseScenarioCSV, parseScenarioFile, parseScenarioJSON, scenarioToCSV, seedScenarios, type DecisionCode, type Scenario } from '../src/engine';
declare const process: { exit(code: number): never };

type Case = { id: string; what: string; build: () => Scenario; route: 0 | 1; expect: DecisionCode };
const seed = (i: number) => seedScenarios()[i]!;
const mod = (i: number, f: (s: Scenario) => void) => () => { const s = seed(i); f(s); return s; };

const cases: Case[] = [
  { id: 'E01', what: 'Profitable pilot, Route A', build: () => seed(0), route: 0, expect: 'PROCEED_TO_SCALE_GATE' },
  { id: 'E02', what: 'Profitable pilot, Route B', build: () => seed(0), route: 1, expect: 'PROCEED_TO_SCALE_GATE' },
  { id: 'E03', what: 'Freight stress: long-haul Route A passes base margin, fails +25% freight', build: () => seed(1), route: 0, expect: 'HOLD_STRESS' },
  { id: 'E04', what: 'Evidence gap: Route B best margin but unknown tariff + IOR + missing sources', build: () => seed(2), route: 1, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E05', what: 'Unknown tariff alone on a passing route', build: mod(0, (s) => { s.routes[0].inputs.dutyRatePct = null; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E06', what: 'Importer of record only "proposed"', build: mod(0, (s) => { s.routes[0].importerOfRecord = 'proposed'; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E07', what: 'Freight quote 120 days old', build: mod(0, (s) => { s.routes[0].evidence.freightPerKg.sourceDate = '2026-06-03'; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E08', what: 'Freight quote dated in the future', build: mod(0, (s) => { s.routes[0].evidence.freightPerKg.sourceDate = '2026-11-01'; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E09', what: 'Impossible source date 2026-02-30', build: mod(0, (s) => { s.routes[0].evidence.lotKg.sourceDate = '2026-02-30'; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E10', what: 'Margin floor raised to 25%', build: mod(0, (s) => { s.limits.minMarginPct = 25; }), route: 0, expect: 'FAIL_MARGIN' },
  { id: 'E11', what: 'Pilot capital limit GBP 5,000', build: mod(0, (s) => { s.limits.maxPilotCapitalGBP = 5000; }), route: 0, expect: 'FAIL_CAPITAL' },
  { id: 'E12', what: 'Scale capital limit GBP 500,000', build: mod(0, (s) => { s.limits.maxScaleCapitalGBP = 500000; }), route: 0, expect: 'FAIL_CAPITAL' },
  { id: 'E13', what: 'Sell price cut to GBP 3', build: mod(0, (s) => { s.routes[0].inputs.sellPricePerItem = 3; }), route: 0, expect: 'KILL_NEGATIVE' },
  { id: 'E14', what: 'VAT not recoverable: import VAT becomes expense', build: mod(0, (s) => { s.routes[1].vatRecoverable = false; }), route: 1, expect: 'FAIL_MARGIN' },
  { id: 'E15', what: 'Zero lot weight', build: mod(0, (s) => { s.routes[0].inputs.lotKg = 0; }), route: 0, expect: 'INVALID' },
  { id: 'E16', what: 'Negative freight', build: mod(0, (s) => { s.routes[0].inputs.freightFixed = -1; }), route: 0, expect: 'INVALID' },
  { id: 'E17', what: 'Returns 100%', build: mod(0, (s) => { s.routes[0].inputs.returnsPct = 100; }), route: 0, expect: 'INVALID' },
  { id: 'E18', what: 'Unknown tariff AND negative contribution still reports the evidence block first', build: mod(0, (s) => { s.routes[0].inputs.dutyRatePct = null; s.routes[0].inputs.sellPricePerItem = 3; }), route: 0, expect: 'BLOCKED_EVIDENCE' },
  { id: 'E19', what: 'Closing the gaps on evidence-gap Route B (tariff 12%, IOR confirmed, sources dated)', build: mod(2, (s) => {
    const r = s.routes[1]; r.inputs.dutyRatePct = 12; r.importerOfRecord = 'confirmed';
    for (const k of ['dutyRatePct', 'gradingYieldPct', 'returnsPct'] as const) r.evidence[k] = { source: 'Synthetic follow-up note KQ-003', sourceDate: '2026-09-30' };
  }), route: 1, expect: 'PROCEED_TO_SCALE_GATE' },
  { id: 'E20', what: 'Stress off (0/0/0) on freight-stress Route A', build: mod(1, (s) => { s.stress = { freightShockPct: 0, fxAdversePct: 0, returnsShockPts: 0 }; }), route: 0, expect: 'PROCEED_TO_SCALE_GATE' },
];

let fail = 0;
console.log('| ID | Case | Expected | Actual | Margin | Result |\n|---|---|---|---|---|---|');
for (const c of cases) {
  const sc = c.build();
  const r = evaluateRoute(sc.routes[c.route], sc);
  const ok = r.decision.code === c.expect;
  if (!ok) fail++;
  const m = r.economics && Number.isFinite(r.economics.marginPct) ? `${r.economics.marginPct.toFixed(1)}%` : 'n/a';
  console.log(`| ${c.id} | ${c.what} | ${c.expect} | ${r.decision.code} | ${m} | ${ok ? 'PASS' : 'FAIL'} |`);
}

// Import/export evals
const io: Array<[string, boolean, boolean]> = [];
for (const s of seedScenarios()) {
  const j = parseScenarioJSON(JSON.stringify(s)); io.push([`JSON round trip ${s.id}`, j.ok && JSON.stringify(j.value) === JSON.stringify(s), true]);
  const c = parseScenarioCSV(scenarioToCSV(s)); io.push([`CSV round trip ${s.id}`, c.ok && JSON.stringify(c.value) === JSON.stringify(s), true]);
}
io.push(['Reject truncated JSON', parseScenarioFile('{"schema":').ok, false]);
io.push(['Reject CSV with unclosed quote', parseScenarioFile('section,route,key,value,source,sourceDate\nmeta,,name,"open').ok, false]);
io.push(['Reject plain text', parseScenarioFile('route a is fine').ok, false]);
console.log('\n| Import/export eval | Expected ok | Actual ok | Result |\n|---|---|---|---|');
for (const [name, actual, want] of io) { const ok = actual === want; if (!ok) fail++; console.log(`| ${name} | ${want} | ${actual} | ${ok ? 'PASS' : 'FAIL'} |`); }
console.log(`\n${cases.length + io.length - fail}/${cases.length + io.length} evals passed`);
if (fail) process.exit(1);
