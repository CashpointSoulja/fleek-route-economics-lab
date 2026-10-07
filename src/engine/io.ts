import { INPUT_META } from './meta';
import { parseDay } from './dates';
import { EVIDENCE_KEYS, FLAG_KEYS, INPUT_KEYS, IOR_VALUES, SCHEMA, type DecisionCode, type Evidence, type EvidenceKey, type InputKey, type Route, type Scenario } from './types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function checkEvidence(v: unknown, path: string, errors: string[]): Evidence {
  if (!isObj(v) || !isStr(v.source) || !isStr(v.sourceDate)) { errors.push(`${path}: needs string source and sourceDate`); return { source: '', sourceDate: '' }; }
  if (v.sourceDate !== '' && parseDay(v.sourceDate) === null) errors.push(`${path}.sourceDate: "${v.sourceDate}" is not a real YYYY-MM-DD date`);
  return { source: v.source, sourceDate: v.sourceDate };
}

function checkRoute(v: unknown, idx: number, errors: string[]): Route | null {
  const p = `routes[${idx}]`;
  if (!isObj(v)) { errors.push(`${p}: must be an object`); return null; }
  const want = idx === 0 ? 'A' : 'B';
  if (v.id !== want) errors.push(`${p}.id: must be "${want}"`);
  for (const f of ['name', 'origin', 'mode', 'originCurrency'] as const) if (!isStr(v[f]) || !(v[f] as string).trim()) errors.push(`${p}.${f}: must be a non-empty string`);
  const inputs = {} as Record<InputKey, number | null>;
  if (!isObj(v.inputs)) errors.push(`${p}.inputs: must be an object`);
  else {
    for (const k of Object.keys(v.inputs)) if (!(INPUT_KEYS as readonly string[]).includes(k)) errors.push(`${p}.inputs.${k}: unknown field`);
    for (const k of INPUT_KEYS) {
      const val = v.inputs[k];
      if (val === null && INPUT_META[k].nullable) inputs[k] = null;
      else if (isNum(val)) inputs[k] = val;
      else { errors.push(`${p}.inputs.${k}: must be a finite number${INPUT_META[k].nullable ? ' or null (unknown)' : ''}`); inputs[k] = null; }
    }
  }
  if (!IOR_VALUES.includes(v.importerOfRecord as Route['importerOfRecord'])) errors.push(`${p}.importerOfRecord: must be one of ${IOR_VALUES.join(', ')}`);
  if (typeof v.vatRecoverable !== 'boolean') errors.push(`${p}.vatRecoverable: must be true or false`);
  const evidence = {} as Record<EvidenceKey, Evidence>;
  if (!isObj(v.evidence)) errors.push(`${p}.evidence: must be an object`);
  else {
    for (const k of Object.keys(v.evidence)) if (!(EVIDENCE_KEYS as readonly string[]).includes(k)) errors.push(`${p}.evidence.${k}: unknown field`);
    for (const k of EVIDENCE_KEYS) evidence[k] = checkEvidence(v.evidence[k], `${p}.evidence.${k}`, errors);
  }
  return {
    id: want, name: String(v.name ?? ''), origin: String(v.origin ?? ''), mode: String(v.mode ?? ''), originCurrency: String(v.originCurrency ?? ''),
    inputs, importerOfRecord: v.importerOfRecord as Route['importerOfRecord'], vatRecoverable: v.vatRecoverable as boolean, evidence,
  };
}

/** Validates every nested field. Never throws. Accepts a bare scenario or an export wrapper { scenario, decisionLog }. */
export function parseScenario(input: unknown): Parsed<Scenario> {
  const errors: string[] = [];
  let v = input;
  if (isObj(v) && 'scenario' in v) v = v.scenario;
  if (!isObj(v)) return { ok: false, errors: ['Scenario must be a JSON object'] };
  if (v.schema !== SCHEMA) errors.push(`schema: must be "${SCHEMA}"`);
  for (const f of ['id', 'name', 'description'] as const) if (!isStr(v[f])) errors.push(`${f}: must be a string`);
  if (parseDay(v.asOfDate) === null) errors.push('asOfDate: must be a real YYYY-MM-DD date');
  if (!isNum(v.staleAfterDays) || v.staleAfterDays < 0) errors.push('staleAfterDays: must be a non-negative number');
  const limits = { minMarginPct: 0, maxPilotCapitalGBP: 0, maxScaleCapitalGBP: 0, targetAnnualGMV: 0 };
  if (!isObj(v.limits)) errors.push('limits: must be an object');
  else for (const k of Object.keys(limits) as (keyof typeof limits)[]) { const n = v.limits[k]; if (!isNum(n) || n < 0) errors.push(`limits.${k}: must be a non-negative number`); else limits[k] = n; }
  const stress = { freightShockPct: 0, fxAdversePct: 0, returnsShockPts: 0 };
  if (!isObj(v.stress)) errors.push('stress: must be an object');
  else for (const k of Object.keys(stress) as (keyof typeof stress)[]) { const n = v.stress[k]; if (!isNum(n) || n < 0) errors.push(`stress.${k}: must be a non-negative number`); else stress[k] = n; }
  if (!Array.isArray(v.routes) || v.routes.length !== 2) { errors.push('routes: must be an array of exactly two routes'); return { ok: false, errors }; }
  const a = checkRoute(v.routes[0], 0, errors);
  const b = checkRoute(v.routes[1], 1, errors);
  if (errors.length || !a || !b) return { ok: false, errors };
  return { ok: true, value: { schema: SCHEMA, id: v.id as string, name: v.name as string, description: v.description as string, asOfDate: v.asOfDate as string, staleAfterDays: v.staleAfterDays as number, limits, stress, routes: [a, b] } };
}

export function parseScenarioJSON(text: string): Parsed<Scenario> {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, errors: ['File is not valid JSON'] }; }
  return parseScenario(data);
}

// ---------- CSV ----------
const CSV_HEADER = ['section', 'route', 'key', 'value', 'source', 'sourceDate'];

function cell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function scenarioToCSV(sc: Scenario): string {
  const rows: string[][] = [CSV_HEADER];
  rows.push(['meta', '', 'schema', sc.schema, '', ''], ['meta', '', 'id', sc.id, '', ''], ['meta', '', 'name', sc.name, '', ''],
    ['meta', '', 'description', sc.description, '', ''], ['meta', '', 'asOfDate', sc.asOfDate, '', ''], ['meta', '', 'staleAfterDays', String(sc.staleAfterDays), '', '']);
  for (const [k, v] of Object.entries(sc.limits)) rows.push(['limit', '', k, String(v), '', '']);
  for (const [k, v] of Object.entries(sc.stress)) rows.push(['stress', '', k, String(v), '', '']);
  for (const r of sc.routes) {
    for (const f of ['name', 'origin', 'mode', 'originCurrency'] as const) rows.push(['route', r.id, f, r[f], '', '']);
    for (const k of INPUT_KEYS) rows.push(['input', r.id, k, r.inputs[k] === null ? 'unknown' : String(r.inputs[k]), r.evidence[k].source, r.evidence[k].sourceDate]);
    rows.push(['flag', r.id, 'importerOfRecord', r.importerOfRecord, r.evidence.importerOfRecord.source, r.evidence.importerOfRecord.sourceDate]);
    rows.push(['flag', r.id, 'vatRecoverable', String(r.vatRecoverable), r.evidence.vatRecoverable.source, r.evidence.vatRecoverable.sourceDate]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

/** RFC 4180-style parser. Rejects unclosed quotes and stray characters after a closing quote. */
export function parseCSVRows(text: string): Parsed<string[][]> {
  const rows: string[][] = [];
  let row: string[] = [], field = '', i = 0, inQ = false, wasQuoted = false;
  const src = text.replace(/^\uFEFF/, '');
  while (i < src.length) {
    const c = src[i]!;
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') {
      if (field !== '' || wasQuoted) return { ok: false, errors: [`Row ${rows.length + 1}: quote in the middle of a field`] };
      inQ = true; wasQuoted = true; i++; continue;
    }
    if (c === ',') { row.push(field); field = ''; wasQuoted = false; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; wasQuoted = false;
      if (c === '\r' && src[i + 1] === '\n') i++;
      i++; continue;
    }
    if (wasQuoted) return { ok: false, errors: [`Row ${rows.length + 1}: characters after a closing quote`] };
    field += c; i++;
  }
  if (inQ) return { ok: false, errors: ['Unclosed quote: the file ends inside a quoted field'] };
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { ok: true, value: rows.filter((r) => !(r.length === 1 && r[0] === '')) };
}

function strictNumber(s: string): number | null {
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s.trim())) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseScenarioCSV(text: string): Parsed<Scenario> {
  const parsed = parseCSVRows(text);
  if (!parsed.ok) return parsed;
  const [header, ...body] = parsed.value;
  if (!header || header.join(',') !== CSV_HEADER.join(',')) return { ok: false, errors: [`Header must be exactly: ${CSV_HEADER.join(',')}`] };
  const errors: string[] = [];
  const seen = new Set<string>();
  const meta: Record<string, string> = {};
  const limits: Record<string, unknown> = {};
  const stress: Record<string, unknown> = {};
  const routes: Record<'A' | 'B', Record<string, unknown>> = { A: { id: 'A', inputs: {}, evidence: {} }, B: { id: 'B', inputs: {}, evidence: {} } };
  body.forEach((r, n) => {
    const line = n + 2;
    if (r.length !== CSV_HEADER.length) { errors.push(`Row ${line}: expected ${CSV_HEADER.length} columns, found ${r.length}`); return; }
    const [section, rid, key, value, source, sourceDate] = r as [string, string, string, string, string, string];
    const id = `${section}|${rid}|${key}`;
    if (seen.has(id)) { errors.push(`Row ${line}: duplicate ${section} ${rid} ${key}`); return; }
    seen.add(id);
    if (section === 'meta') meta[key] = value;
    else if (section === 'limit' || section === 'stress') { const num = strictNumber(value); (section === 'limit' ? limits : stress)[key] = num === null ? value : num; }
    else if (rid === 'A' || rid === 'B') {
      const route = routes[rid];
      if (section === 'route') route[key] = value;
      else if (section === 'input') {
        if (!(INPUT_KEYS as readonly string[]).includes(key)) { errors.push(`Row ${line}: unknown input ${key}`); return; }
        const num = value.trim().toLowerCase() === 'unknown' ? null : strictNumber(value);
        if (num === null && value.trim().toLowerCase() !== 'unknown') { errors.push(`Row ${line}: ${key} value "${value}" is not a number`); return; }
        (route.inputs as Record<string, unknown>)[key] = num;
        (route.evidence as Record<string, unknown>)[key] = { source, sourceDate };
      } else if (section === 'flag') {
        if (!(FLAG_KEYS as readonly string[]).includes(key)) { errors.push(`Row ${line}: unknown flag ${key}`); return; }
        route[key] = key === 'vatRecoverable' ? (value === 'true' ? true : value === 'false' ? false : value) : value;
        (route.evidence as Record<string, unknown>)[key] = { source, sourceDate };
      } else errors.push(`Row ${line}: unknown section ${section}`);
    } else errors.push(`Row ${line}: route must be A or B for section ${section}`);
  });
  if (errors.length) return { ok: false, errors };
  return parseScenario({
    schema: meta.schema, id: meta.id, name: meta.name, description: meta.description, asOfDate: meta.asOfDate,
    staleAfterDays: meta.staleAfterDays === undefined ? undefined : strictNumber(meta.staleAfterDays), limits, stress, routes: [routes.A, routes.B],
  });
}

/** Detect by content, not filename. */
export function parseScenarioFile(text: string): Parsed<Scenario> {
  const t = text.replace(/^\uFEFF/, '').trimStart();
  if (t.startsWith('{') || t.startsWith('[')) return parseScenarioJSON(t);
  if (t.startsWith('section,')) return parseScenarioCSV(t);
  return { ok: false, errors: ['Unrecognised file: expected scenario JSON or the scenario CSV format'] };
}

// ---------- fingerprint + decision log ----------
export function fingerprint(sc: Scenario): string {
  const s = JSON.stringify(sc);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export interface DecisionEntry {
  id: string;
  at: string; // ISO timestamp
  scenarioId: string;
  routeId: 'A' | 'B';
  decisionCode: DecisionCode;
  call: 'scale-gate' | 'hold' | 'kill' | 'gather-evidence';
  note: string;
  fingerprint: string;
}

const CODES: DecisionCode[] = ['INVALID', 'BLOCKED_EVIDENCE', 'KILL_NEGATIVE', 'FAIL_MARGIN', 'FAIL_CAPITAL', 'HOLD_STRESS', 'PROCEED_TO_SCALE_GATE'];
const CALLS: DecisionEntry['call'][] = ['scale-gate', 'hold', 'kill', 'gather-evidence'];

/** Which human calls are allowed for each engine decision. A scale-gate call needs PROCEED. */
export function allowedCalls(code: DecisionCode): DecisionEntry['call'][] {
  if (code === 'PROCEED_TO_SCALE_GATE') return ['scale-gate', 'hold', 'kill'];
  if (code === 'BLOCKED_EVIDENCE') return ['gather-evidence', 'kill'];
  if (code === 'INVALID') return [];
  return ['hold', 'kill'];
}

export function parseDecisionLog(v: unknown): Parsed<DecisionEntry[]> {
  if (!Array.isArray(v)) return { ok: false, errors: ['decisionLog must be an array'] };
  const errors: string[] = [];
  const out: DecisionEntry[] = [];
  v.forEach((e, i) => {
    if (!isObj(e)) { errors.push(`decisionLog[${i}]: must be an object`); return; }
    const ok = isStr(e.id) && isStr(e.at) && !Number.isNaN(Date.parse(e.at)) && isStr(e.scenarioId) && (e.routeId === 'A' || e.routeId === 'B') &&
      CODES.includes(e.decisionCode as DecisionCode) && CALLS.includes(e.call as DecisionEntry['call']) && isStr(e.note) && isStr(e.fingerprint) &&
      allowedCalls(e.decisionCode as DecisionCode).includes(e.call as DecisionEntry['call']);
    if (!ok) errors.push(`decisionLog[${i}]: invalid entry`);
    else out.push(e as unknown as DecisionEntry);
  });
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}
