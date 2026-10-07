import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './style.css';
import {
  INPUT_KEYS, INPUT_META, allowedCalls, evaluateScenario, evidenceLabel, fingerprint, parseDecisionLog, parseScenario,
  parseScenarioFile, scenarioToCSV, seedScenarios, sweep,
  type DecisionCode, type DecisionEntry, type EvidenceKey, type InputKey, type Route, type RouteResult, type Scenario,
} from './engine';

const REPO = 'https://github.com/CashpointSoulja/fleek-route-economics-lab/blob/main/';
const STORE = 'fleek-route-economics-lab/v1';

interface State { scenario: Scenario; log: DecisionEntry[]; notice: { kind: 'ok' | 'error'; text: string; detail?: string[] } | null }

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const gbp = (v: number, dp = 0) => (Number.isFinite(v) ? `${v < 0 ? '−' : ''}£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}` : 'n/a');
const num = (v: number, dp = 0) => (Number.isFinite(v) ? v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : 'n/a');
const pct = (v: number | null, dp = 1) => (v !== null && Number.isFinite(v) ? `${v.toFixed(dp)}%` : 'n/a');

function load(): State {
  const fresh: State = { scenario: seedScenarios()[0]!, log: [], notice: null };
  const raw = localStorage.getItem(STORE);
  if (!raw) return fresh;
  try {
    const data = JSON.parse(raw);
    const sc = parseScenario(data?.scenario);
    const log = parseDecisionLog(data?.log);
    if (sc.ok && log.ok) return { scenario: sc.value, log: log.value, notice: null };
  } catch { /* fall through */ }
  localStorage.removeItem(STORE);
  return { ...fresh, notice: { kind: 'error', text: 'Saved state failed validation and was discarded. Loaded the Profitable pilot case.' } };
}

const state = load();
const save = () => localStorage.setItem(STORE, JSON.stringify({ scenario: state.scenario, log: state.log }));

function badgeClass(c: DecisionCode) {
  return c === 'PROCEED_TO_SCALE_GATE' ? 'b-go' : c === 'HOLD_STRESS' ? 'b-hold' : 'b-stop';
}
const badge = (r: RouteResult) => `<span class="badge ${badgeClass(r.decision.code)}" data-testid="verdict-${r.routeId}">${esc(r.decision.label)}</span>`;

function routeCard(route: Route, r: RouteResult) {
  const e = r.economics;
  if (!e) {
    return `<article class="card route" id="route-${route.id}"><header><p class="eyebrow">Route ${route.id}</p><h3>${esc(route.name)}</h3>${badge(r)}</header>
      <ul class="errs">${r.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></article>`;
  }
  const max = Math.max(...e.waterfall.map((s) => Math.abs(s.amount)), 1);
  const bars = e.waterfall.map((s) => {
    const cls = s.key === 'contribution' ? (s.amount >= 0 ? 'w-contrib' : 'w-neg') : s.amount >= 0 ? 'w-rev' : 'w-cost';
    return `<div class="wf-row ${s.key === 'contribution' ? 'wf-total' : ''}"><span class="wf-label">${esc(s.label)}</span>
      <span class="wf-track"><span class="wf-bar ${cls}" style="width:${((Math.abs(s.amount) / max) * 100).toFixed(1)}%"></span></span>
      <span class="wf-val">${gbp(s.amount)}</span><span class="wf-unit">${gbp(s.perUnit, 2)}</span></div>`;
  }).join('');
  return `<article class="card route" id="route-${route.id}" data-testid="route-card-${route.id}">
    <header><p class="eyebrow">Route ${route.id} · ${esc(route.mode)}</p><h3>${esc(route.name)}</h3><p class="muted">${esc(route.origin)} → UK buyers · currency ${esc(route.originCurrency)}</p>${badge(r)}</header>
    <div class="kpis">
      <div><span>Contribution per kept unit</span><strong>${gbp(e.contributionPerUnit, 2)}</strong></div>
      <div><span>Contribution margin</span><strong>${pct(e.marginPct)}</strong></div>
      <div><span>Saleable yield</span><strong>${pct(e.saleableYieldPct)}</strong><em>${num(e.keptItems)} kept of ${num(e.items)} bought</em></div>
      <div><span>Peak cash tied up per lot</span><strong>${gbp(e.cash.peakCashGBP)}</strong><em>${e.cash.paybackDay === null ? 'never pays back' : `cash back by day ${e.cash.paybackDay}`}</em></div>
    </div>
    <div class="vat-split"><div><span>Import VAT paid at arrival</span><strong>${gbp(e.importVatGBP)}</strong></div>
      <div><span>of which expense</span><strong>${gbp(e.vatExpenseGBP)}</strong></div>
      <div><span>of which recoverable (cash only)</span><strong>${gbp(e.vatRecoverableGBP)}</strong></div></div>
    <h4>Cost waterfall per lot <span class="muted">(${num(route.inputs.lotKg ?? 0)} kg · last column per kept unit)</span></h4>
    <div class="wf" data-testid="waterfall-${route.id}">${bars}</div>
    <h4>Why this verdict</h4><ul class="reasons">${r.decision.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </article>`;
}

function limitsPanel(sc: Scenario) {
  const f = (path: string, label: string, v: number, unit: string, step = 'any') =>
    `<label class="field"><span>${label}</span><span class="inline"><input type="number" step="${step}" min="0" data-limit="${path}" value="${v}" aria-label="${label}" /><em>${unit}</em></span></label>`;
  return `<section class="band cream" id="limits"><div class="wrap"><p class="eyebrow">Your limits</p><h2>Margin, capital and stress settings</h2>
    <p class="muted">You set the gates. Nothing here is a recommendation of what the limits should be.</p>
    <div class="limits">
      ${f('limits.minMarginPct', 'Minimum contribution margin', sc.limits.minMarginPct, '%')}
      ${f('limits.maxPilotCapitalGBP', 'Max cash tied up in the pilot lot', sc.limits.maxPilotCapitalGBP, 'GBP')}
      ${f('limits.maxScaleCapitalGBP', 'Max cash tied up at target scale', sc.limits.maxScaleCapitalGBP, 'GBP')}
      ${f('limits.targetAnnualGMV', 'Illustrative annual GMV target', sc.limits.targetAnnualGMV, 'GBP')}
      ${f('stress.freightShockPct', 'Freight stress', sc.stress.freightShockPct, '% up')}
      ${f('stress.fxAdversePct', 'FX stress (GBP weakens)', sc.stress.fxAdversePct, '%')}
      ${f('stress.returnsShockPts', 'Returns stress', sc.stress.returnsShockPts, 'pts up')}
      ${f('staleAfterDays', 'Evidence goes stale after', sc.staleAfterDays, 'days', '1')}
      <label class="field"><span>As-of date</span><input type="date" data-meta="asOfDate" value="${esc(sc.asOfDate)}" aria-label="As-of date" /></label>
    </div></div></section>`;
}

function evCells(route: Route, key: EvidenceKey, ri: number) {
  const ev = route.evidence[key];
  return `<input class="src" type="text" data-ev="${ri}|${key}|source" value="${esc(ev.source)}" placeholder="Source (missing)" aria-label="Route ${route.id} ${esc(evidenceLabel(key))} source" />
    <input class="date" type="date" data-ev="${ri}|${key}|sourceDate" value="${esc(ev.sourceDate)}" aria-label="Route ${route.id} ${esc(evidenceLabel(key))} source date" />`;
}

function assumptions(sc: Scenario) {
  const groups = [...new Set(INPUT_KEYS.map((k) => INPUT_META[k].group))];
  const cell = (route: Route, ri: number, k: InputKey) => {
    const m = INPUT_META[k];
    const v = route.inputs[k];
    const missing = !route.evidence[k].source.trim() || !route.evidence[k].sourceDate;
    const unknown = m.nullable && v === null;
    return `<div class="acell ${missing && m.critical ? 'gap' : ''}">
      <span class="inline"><input type="number" step="any" data-in="${ri}|${k}" value="${v === null || Number.isNaN(v) ? '' : v}" ${unknown ? 'disabled' : ''} aria-label="Route ${route.id} ${esc(m.label)}" />
      ${m.nullable ? `<label class="chk"><input type="checkbox" data-unknown="${ri}|${k}" ${unknown ? 'checked' : ''} /> Unknown</label>` : ''}</span>
      ${evCells(route, k, ri)}</div>`;
  };
  const rows = groups.map((g) => `<div class="agroup">${esc(g)}</div>` + INPUT_KEYS.filter((k) => INPUT_META[k].group === g).map((k) => {
    const m = INPUT_META[k];
    return `<div class="arow"><div class="alabel"><strong>${esc(m.label)}</strong><em>${esc(m.unit)}${m.critical ? ' · critical' : ''}</em></div>${cell(sc.routes[0], 0, k)}${cell(sc.routes[1], 1, k)}</div>`;
  }).join('')).join('');
  const flagCell = (route: Route, ri: number) => `<div class="acell">
    <select data-ior="${ri}" aria-label="Route ${route.id} importer of record">${['confirmed', 'proposed', 'unknown'].map((o) => `<option ${route.importerOfRecord === o ? 'selected' : ''}>${o}</option>`).join('')}</select>${evCells(route, 'importerOfRecord', ri)}</div>`;
  const vatCell = (route: Route, ri: number) => `<div class="acell"><label class="chk"><input type="checkbox" data-vat="${ri}" ${route.vatRecoverable ? 'checked' : ''} /> Recoverable</label>${evCells(route, 'vatRecoverable', ri)}</div>`;
  return `<section class="band cream" id="assumptions"><div class="wrap"><p class="eyebrow">Assumptions</p><h2>Every rate is an editable illustrative assumption</h2>
    <p class="muted">Not a customs classification, tariff ruling or tax/legal advice. Each value carries a source and a source date; critical inputs without both block a scale recommendation.</p>
    <div class="atable"><div class="arow ahead"><div></div><div>${esc(sc.routes[0].name)}</div><div>${esc(sc.routes[1].name)}</div></div>
    <div class="agroup">Gates</div>
    <div class="arow"><div class="alabel"><strong>Importer of record</strong><em>must be confirmed to scale</em></div>${flagCell(sc.routes[0], 0)}${flagCell(sc.routes[1], 1)}</div>
    <div class="arow"><div class="alabel"><strong>Import VAT recoverable</strong><em>explicit assumption: VAT-registered importer</em></div>${vatCell(sc.routes[0], 0)}${vatCell(sc.routes[1], 1)}</div>
    ${rows}</div></div></section>`;
}

function sensitivityView(sc: Scenario, res: RouteResult[]) {
  const steps = { freight: [0, 10, 25, 50], fx: [0, 5, 10, 20], returns: [0, 2, 4, 8] } as const;
  const unit = { freight: (s: number) => `+${s}%`, fx: (s: number) => `−${s}%`, returns: (s: number) => `+${s} pts` };
  const name = { freight: 'Freight cost', fx: 'GBP vs origin currency', returns: 'Returns rate' };
  const tables = sc.routes.map((route, i) => {
    const r = res[i]!;
    if (!r.economics) return `<div class="card"><h3>${esc(route.name)}</h3><p class="muted">No sensitivity: inputs are invalid.</p></div>`;
    const rows = r.sensitivity.map((s) => `<tr class="${s.passes ? '' : 'fail'}"><td>${esc(s.label)}</td><td>${gbp(s.contributionPerUnit ?? NaN, 2)}</td><td>${pct(s.marginPct)}</td><td>${s.passes ? 'Passes' : 'Fails'}</td></tr>`).join('');
    const grid = (Object.keys(steps) as Array<keyof typeof steps>).map((d) => `<tr><th>${name[d]}</th>${sweep(route, d, [...steps[d]]).map((p) => {
      const ok = p.marginPct >= sc.limits.minMarginPct && p.contributionPerUnit > 0;
      return `<td class="${ok ? 'ok' : 'bad'}"><span>${unit[d](p.step)}</span>${pct(p.marginPct)}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="card" data-testid="sens-${route.id}"><h3>${esc(route.name)}</h3>
      <table class="tbl"><thead><tr><th>Stress</th><th>Per kept unit</th><th>Margin</th><th>vs ${sc.limits.minMarginPct}% floor</th></tr></thead><tbody>${rows}</tbody></table>
      <h4>Margin sweep</h4><table class="tbl sweep"><tbody>${grid}</tbody></table></div>`;
  }).join('');
  return `<section class="band" id="sensitivity"><div class="wrap"><p class="eyebrow">Sensitivity</p><h2>Returns, FX and freight stress</h2>
    <p class="muted">A route must clear the margin floor under each single stress to proceed. The combined row is shown for context.</p><div class="two">${tables}</div></div></section>`;
}

function cashView(sc: Scenario, res: RouteResult[]) {
  const W = 480, H = 240, P = 26;
  const lines = res.map((r) => r.economics?.cash.timeline ?? []);
  const all = lines.flat();
  if (!all.length) return '';
  const maxDay = Math.max(...all.map((p) => p.day)), lo = Math.min(...all.map((p) => p.cumulative), 0), hi = Math.max(...all.map((p) => p.cumulative), 1);
  const x = (d: number) => P + (d / maxDay) * (W - 2 * P), y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = (tl: { day: number; cumulative: number }[]) => tl.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join('');
  const markers = res.map((r, i) => {
    const e = r.economics; if (!e) return '';
    const vd = e.cash.vatRefundDay;
    return vd !== null ? `<line x1="${x(vd)}" x2="${x(vd)}" y1="${P}" y2="${H - P}" class="vatline r${i}" />` : '';
  }).join('');
  const rows = res.map((r, i) => {
    const e = r.economics; const route = sc.routes[i]!;
    if (!e) return `<tr><td>${esc(route.name)}</td><td colspan="5">invalid inputs</td></tr>`;
    return `<tr><td><span class="key r${i}"></span>${esc(route.name)}</td><td>${gbp(-(e.goodsGBP + e.freightGBP + e.insuranceGBP))} day 0</td><td>${gbp(-(e.dutyGBP + e.importVatGBP))} day ${route.inputs.transitDays}</td><td>${gbp(e.cash.peakCashGBP)}</td><td>${e.cash.vatRefundDay === null ? 'not recoverable (expense)' : `${gbp(e.vatRecoverableGBP)} day ${e.cash.vatRefundDay}`}</td><td>${e.cash.paybackDay ?? 'never'}</td></tr>`;
  }).join('');
  return `<section class="band" id="cash"><div class="wrap"><p class="eyebrow">Cash timing</p><h2>Cash tied up per lot, by day</h2>
    <p class="muted">Supplier and freight paid on day 0; duty and import VAT at arrival; buyer cash lands after payout days; recoverable VAT returns later. VAT recovery changes cash, not contribution.</p>
    <div class="card"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative cash by day for both routes" class="cashsvg">
      <line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" class="zero" /><text x="${P}" y="${y(0) - 4}" class="lbl">£0</text>
      ${lines.map((tl, i) => `<path d="${path(tl)}" class="cl r${i}" />`).join('')}${markers}
      <text x="${W - P}" y="${H - 8}" text-anchor="end" class="lbl">day ${maxDay}</text><text x="${P}" y="${H - 8}" class="lbl">day 0 · dotted lines = VAT refund</text></svg>
    <table class="tbl"><thead><tr><th>Route</th><th>Paid at origin</th><th>Duty + VAT at arrival</th><th>Peak cash</th><th>VAT refund</th><th>Payback day</th></tr></thead><tbody>${rows}</tbody></table></div></div></section>`;
}

function scaleView(sc: Scenario, res: RouteResult[]) {
  const rows = res.map((r, i) => {
    const s = r.scale; const route = sc.routes[i]!;
    if (!s) return `<div class="card"><h3>${esc(route.name)}</h3><p class="muted">No result: invalid inputs.</p></div>`;
    const blocked = r.decision.code !== 'PROCEED_TO_SCALE_GATE';
    return `<div class="card scale ${blocked ? 'blocked' : ''}" data-testid="scale-${route.id}"><h3>${esc(route.name)}</h3>${badge(r)}
      <dl><div><dt>Net units kept by buyers</dt><dd>${num(s.netUnits)}</dd></div><div><dt>Units sold (before returns)</dt><dd>${num(s.soldUnits)}</dd></div>
      <div><dt>Buyer orders</dt><dd>${num(s.orders)}</dd></div><div><dt>Lots per year</dt><dd>${num(s.lots)}</dd></div>
      <div><dt>Kg purchased per year</dt><dd>${num(s.kg)}</dd></div><div><dt>Lots in flight (cycle ${s.cycleDays} days)</dt><dd>${num(s.lotsInFlight)}</dd></div>
      <div><dt>Cash tied up at scale</dt><dd>${gbp(s.capitalGBP)}</dd></div></dl>
      <p class="note">${blocked ? 'Scale is not recommended for this route. These are the volumes the target would require, not a plan.' : 'Volumes the target would require. Demand at this volume is not evidenced here and must be tested.'}</p></div>`;
  }).join('');
  return `<section class="band" id="scale"><div class="wrap"><p class="eyebrow">Scale to target</p><h2>What ${gbp(sc.limits.targetAnnualGMV)} of annual GMV would require</h2>
    <p class="muted">Derived only from the target and each route's own price, returns, basket size and lot output. No demand is assumed or forecast.</p><div class="two">${rows}</div></div></section>`;
}

function evidenceView(sc: Scenario, res: RouteResult[]) {
  const cards = res.map((r, i) => {
    const route = sc.routes[i]!;
    const checks = r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'bad'}"><strong>${c.ok ? 'Pass' : c.blocking ? 'Blocks scale' : 'Fails'}</strong> ${esc(c.label)} <span class="muted">${esc(c.detail)}</span></li>`).join('');
    const gaps = [...r.missing, ...r.stale];
    return `<div class="card" data-testid="evidence-${route.id}"><h3>${esc(route.name)}</h3>${badge(r)}<ul class="checks">${checks}</ul>
      <h4>Missing or stale inputs (${gaps.length})</h4>${gaps.length ? `<ul class="gaps">${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}</div>`;
  }).join('');
  return `<section class="band cream" id="evidence"><div class="wrap"><p class="eyebrow">Evidence</p><h2>Gates that block scale even when margin is positive</h2>
    <p class="muted">Unknown tariff, an importer of record that is not confirmed, or a critical input without a dated source blocks the scale recommendation. These gates cannot be overridden in the decision log.</p><div class="two">${cards}</div></div></section>`;
}

function logView(sc: Scenario, res: RouteResult[]) {
  const fp = fingerprint(sc);
  const forms = res.map((r, i) => {
    const calls = allowedCalls(r.decision.code);
    return `<form class="card logform" data-log="${i}"><h3>${esc(sc.routes[i]!.name)}</h3>${badge(r)}
      ${calls.length ? `<label class="field"><span>Your call</span><select name="call" aria-label="Call for route ${sc.routes[i]!.id}">${calls.map((c) => `<option value="${c}">${c}</option>`).join('')}</select></label>
      <label class="field"><span>Note</span><input name="note" type="text" maxlength="280" placeholder="Why" /></label><button class="btn" type="submit">Record decision</button>`
      : '<p class="muted">Fix invalid inputs before recording a decision.</p>'}</form>`;
  }).join('');
  const rows = state.log.slice().reverse().map((e) => {
    const stale = e.fingerprint !== fp || e.scenarioId !== sc.id;
    return `<tr class="${stale ? 'stale' : ''}"><td>${esc(new Date(e.at).toISOString().replace('T', ' ').slice(0, 16))}</td><td>${esc(e.scenarioId)} · ${e.routeId}</td><td>${esc(e.decisionCode)}</td><td>${esc(e.call)}</td><td>${esc(e.note)}</td><td>${stale ? 'Stale: inputs changed since' : 'Current'}</td></tr>`;
  }).join('');
  return `<section class="band" id="log"><div class="wrap"><p class="eyebrow">Decision log</p><h2>Record the call, bound to these exact inputs</h2>
    <p class="muted">Each entry stores the engine verdict and a fingerprint of the scenario. A scale-gate call is only offered when the engine says proceed. Nothing here books, orders, contacts or pays anyone.</p>
    <div class="two">${forms}</div>
    <div class="card"><table class="tbl" data-testid="log-table"><thead><tr><th>When (UTC)</th><th>Case · route</th><th>Engine</th><th>Call</th><th>Note</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">No decisions recorded yet.</td></tr>'}</tbody></table>
    ${state.log.length ? '<button class="btn ghost" data-action="clear-log" type="button">Clear log</button>' : ''}</div></div></section>`;
}

function ioView() {
  return `<section class="band cream" id="io"><div class="wrap"><p class="eyebrow">Import / export</p><h2>Take the scenario with you</h2>
    <p class="muted">JSON carries the scenario plus decision log; CSV carries one row per input with its source and date. Imports are validated field by field and rejected whole if anything is wrong.</p>
    <div class="iorow"><button class="btn" data-action="export-json" type="button">Export JSON</button><button class="btn" data-action="export-csv" type="button">Export CSV</button>
    <label class="btn ghost filebtn">Import JSON or CSV<input type="file" accept=".json,.csv,application/json,text/csv" data-action="import" /></label>
    <button class="btn ghost" data-action="reset" type="button">Reset this case</button></div></div></section>`;
}

const DOCS: Array<[string, string]> = [
  ['PRD', 'docs/PRD.md'], ['ELI5', 'docs/ELI5.md'], ['5 Whys', 'docs/FIVE_WHYS.md'], ['Jobs to be done', 'docs/JTBD.md'],
  ['Source and assumption register', 'docs/SOURCE_REGISTER.md'], ['Viability memo', 'docs/VIABILITY_MEMO.md'], ['Metrics', 'docs/METRICS.md'],
  ['Test plan', 'docs/TEST_PLAN.md'], ['Test results', 'docs/TEST_RESULTS.md'], ['Eval cases and results', 'docs/EVALS.md'],
  ['Limitations', 'docs/LIMITATIONS.md'], ['Roadmap', 'docs/ROADMAP.md'], ['Deployment', 'docs/DEPLOYMENT.md'], ['Brand sheet', 'docs/BRAND.md'], ['Visual guide', 'docs/VISUAL_GUIDE.md'],
];

function render() {
  const sc = state.scenario;
  const res = evaluateScenario(sc);
  const seeds = seedScenarios();
  const n = state.notice;
  document.getElementById('app')!.innerHTML = `
  <div class="strip">Independent concept by Ayomide Ahmed. Not an official Fleek product. All data synthetic; every rate is an editable illustrative assumption, not customs classification or tax/legal advice.</div>
  <header class="top"><div class="wrap toprow">
    <a class="brand" href="#top" aria-label="Fleek logo, Route Economics Lab home"><img src="./brand/fleek-logo.webp" alt="Fleek" width="110" height="35" /></a>
    <span class="product">Route Economics Lab</span>
    <nav aria-label="Sections"><a href="#compare">Compare</a><a href="#limits">Limits</a><a href="#sensitivity">Sensitivity</a><a href="#cash">Cash</a><a href="#scale">Scale</a><a href="#evidence">Evidence</a><a href="#assumptions">Assumptions</a><a href="#log">Decision log</a><a href="#docs">Docs</a></nav>
    <label class="casepick"><span>Case</span><select data-action="case" aria-label="Case">${seeds.map((s) => `<option value="${s.id}" ${s.id === sc.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}${seeds.some((s) => s.id === sc.id) ? '' : `<option selected value="${esc(sc.id)}">${esc(sc.name)} (imported)</option>`}</select></label>
  </div></header>
  <main id="top">
  <section class="hero"><div class="wrap"><p class="eyebrow y">Category expansion · two synthetic routes into UK buyers</p>
    <h1>Open a sourcing route <span>on evidence</span></h1><p class="lede" data-testid="case-desc"><strong>${esc(sc.name)}.</strong> ${esc(sc.description)}</p>
    <div class="herobadges">${res.map((r, i) => `<div><span>${esc(sc.routes[i]!.name)}</span>${badge(r)}</div>`).join('')}</div></div></section>
  ${n ? `<div class="wrap"><div class="notice ${n.kind}" role="status">${esc(n.text)}${n.detail ? `<ul>${n.detail.slice(0, 12).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}<button type="button" data-action="dismiss" aria-label="Dismiss">×</button></div></div>` : ''}
  <section class="band" id="compare"><div class="wrap"><p class="eyebrow">Compare</p><h2>Landed economics per lot</h2><div class="two">${routeCard(sc.routes[0], res[0])}${routeCard(sc.routes[1], res[1])}</div></div></section>
  ${limitsPanel(sc)}${sensitivityView(sc, res)}${cashView(sc, res)}${scaleView(sc, res)}${evidenceView(sc, res)}${assumptions(sc)}${logView(sc, res)}${ioView()}
  <section class="band" id="docs"><div class="wrap"><p class="eyebrow">Docs</p><h2>PM package</h2><ul class="docs">${DOCS.map(([t, p]) => `<li><a href="${REPO}${p}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ul></div></section>
  </main>
  <footer><div class="wrap"><img src="./brand/fleek-logo.webp" alt="" width="80" height="26" class="flogo" /><p><strong>Independent concept by Ayomide Ahmed · Not an official Fleek product.</strong></p>
  <p>All routes, suppliers, origins, currencies and rates are synthetic. Not a customs classification, tariff ruling, tax or legal advice. No booking, ordering, outreach or payment actions exist in this app.</p>
  <p><a href="https://github.com/CashpointSoulja/fleek-route-economics-lab" target="_blank" rel="noopener">Source on GitHub</a></p></div></footer>`;
}

function setPath(sc: Scenario, path: string, v: number) {
  const [a, b] = path.split('.') as [string, string | undefined];
  if (b) ((sc as unknown as Record<string, Record<string, number>>)[a]!)[b] = v; else (sc as unknown as Record<string, number>)[a] = v;
}
const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s));

function commit(text?: string) { state.notice = text ? { kind: 'ok', text } : null; save(); const y = window.scrollY; render(); window.scrollTo(0, y); }

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportable(): boolean {
  const res = evaluateScenario(state.scenario);
  if (res.some((r) => !r.valid) || !parseScenario(state.scenario).ok) {
    state.notice = { kind: 'error', text: 'Export refused: fix invalid inputs first so the file round-trips exactly.', detail: res.flatMap((r) => r.errors) };
    const y = window.scrollY; render(); window.scrollTo(0, y); return false;
  }
  return true;
}

document.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement | HTMLSelectElement;
  const sc = state.scenario;
  const d = t.dataset;
  if (d.action === 'case') {
    const s = seedScenarios().find((x) => x.id === t.value);
    if (s) { state.scenario = s; commit(`Loaded case: ${s.name}`); }
    return;
  }
  if (d.action === 'import') {
    const file = (t as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const p = parseScenarioFile(text);
      if (!p.ok) { state.notice = { kind: 'error', text: `Import rejected: ${file.name} was not loaded; nothing changed.`, detail: p.errors }; render(); return; }
      let log = state.log;
      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && 'decisionLog' in data) {
          const l = parseDecisionLog(data.decisionLog);
          if (!l.ok) { state.notice = { kind: 'error', text: 'Import rejected: decision log failed validation.', detail: l.errors }; render(); return; }
          log = l.value;
        }
      } catch { /* CSV */ }
      state.scenario = p.value; state.log = log; commit(`Imported ${file.name}`);
    });
    return;
  }
  if (d.limit) { setPath(sc, d.limit, toNum(t.value)); return commit(); }
  if (d.meta === 'asOfDate') { sc.asOfDate = t.value; return commit(); }
  if (d.in) { const [ri, k] = d.in.split('|') as [string, InputKey]; sc.routes[+ri as 0 | 1].inputs[k] = toNum(t.value); return commit(); }
  if (d.unknown) {
    const [ri, k] = d.unknown.split('|') as [string, InputKey];
    const route = sc.routes[+ri as 0 | 1];
    route.inputs[k] = (t as HTMLInputElement).checked ? null : (seedScenarios()[0]!.routes[+ri as 0 | 1].inputs[k] ?? 0);
    return commit();
  }
  if (d.ev) { const [ri, k, f] = d.ev.split('|') as [string, EvidenceKey, 'source' | 'sourceDate']; sc.routes[+ri as 0 | 1].evidence[k][f] = t.value; return commit(); }
  if (d.ior) { sc.routes[+d.ior as 0 | 1].importerOfRecord = t.value as Route['importerOfRecord']; return commit(); }
  if (d.vat) { sc.routes[+d.vat as 0 | 1].vatRecoverable = (t as HTMLInputElement).checked; return commit(); }
});

document.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'dismiss') { state.notice = null; render(); }
  if (a === 'export-json' && exportable()) download(`${state.scenario.id}.json`, JSON.stringify({ scenario: state.scenario, decisionLog: state.log, fingerprint: fingerprint(state.scenario) }, null, 2), 'application/json');
  if (a === 'export-csv' && exportable()) download(`${state.scenario.id}.csv`, scenarioToCSV(state.scenario), 'text/csv');
  if (a === 'reset') { const s = seedScenarios().find((x) => x.id === state.scenario.id) ?? seedScenarios()[0]!; state.scenario = s; commit(`Reset: ${s.name}`); }
  if (a === 'clear-log') { state.log = []; commit('Decision log cleared'); }
});

document.addEventListener('submit', (ev) => {
  const f = ev.target as HTMLFormElement;
  if (!f.dataset.log) return;
  ev.preventDefault();
  const i = +f.dataset.log as 0 | 1;
  const r = evaluateScenario(state.scenario)[i];
  const call = (f.elements.namedItem('call') as HTMLSelectElement | null)?.value as DecisionEntry['call'] | undefined;
  if (!call || !allowedCalls(r.decision.code).includes(call)) { state.notice = { kind: 'error', text: 'That call is not allowed for the current verdict.' }; render(); return; }
  const note = (f.elements.namedItem('note') as HTMLInputElement).value.slice(0, 280);
  state.log.push({ id: `${Date.now()}-${i}`, at: new Date().toISOString(), scenarioId: state.scenario.id, routeId: state.scenario.routes[i].id, decisionCode: r.decision.code, call, note, fingerprint: fingerprint(state.scenario) });
  commit(`Recorded ${call} for ${state.scenario.routes[i].name}`);
});

render();
