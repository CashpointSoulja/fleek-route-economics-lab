export const SCHEMA = 'fleek-route-economics/v1' as const;

export const INPUT_KEYS = [
  'lotKg', 'avgItemKg', 'purchasePricePerKg', 'originPerGBP', 'gradingYieldPct', 'ragValuePerKg',
  'sellThroughPct', 'sellPricePerItem', 'itemsPerOrder', 'returnsPct', 'returnCostPerItem',
  'freightFixed', 'freightPerKg', 'insurancePct', 'dutyRatePct', 'importVatPct', 'brokerFee',
  'handlingPerItem', 'lastMilePerOrder', 'paymentFeePct', 'transitDays', 'sellThroughDays',
  'payoutDays', 'vatRecoveryDays',
] as const;
export type InputKey = (typeof INPUT_KEYS)[number];

export const FLAG_KEYS = ['importerOfRecord', 'vatRecoverable'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];
export type EvidenceKey = InputKey | FlagKey;
export const EVIDENCE_KEYS: readonly EvidenceKey[] = [...INPUT_KEYS, ...FLAG_KEYS];

export type ImporterOfRecord = 'confirmed' | 'proposed' | 'unknown';
export const IOR_VALUES: readonly ImporterOfRecord[] = ['confirmed', 'proposed', 'unknown'];

export interface Evidence {
  source: string;
  sourceDate: string; // YYYY-MM-DD, '' when missing
}

export interface Route {
  id: 'A' | 'B';
  name: string;
  origin: string;
  mode: string;
  originCurrency: string;
  inputs: Record<InputKey, number | null>; // null only allowed for dutyRatePct (= unknown tariff)
  importerOfRecord: ImporterOfRecord;
  vatRecoverable: boolean;
  evidence: Record<EvidenceKey, Evidence>;
}

export interface Limits {
  minMarginPct: number;
  maxPilotCapitalGBP: number;
  maxScaleCapitalGBP: number;
  targetAnnualGMV: number;
}

export interface Stress {
  freightShockPct: number;
  fxAdversePct: number;
  returnsShockPts: number;
}

export interface Scenario {
  schema: typeof SCHEMA;
  id: string;
  name: string;
  description: string;
  asOfDate: string;
  staleAfterDays: number;
  limits: Limits;
  stress: Stress;
  routes: [Route, Route];
}

export type DecisionCode =
  | 'INVALID'
  | 'BLOCKED_EVIDENCE'
  | 'KILL_NEGATIVE'
  | 'FAIL_MARGIN'
  | 'FAIL_CAPITAL'
  | 'HOLD_STRESS'
  | 'PROCEED_TO_SCALE_GATE';

export interface WaterfallStep {
  key: string;
  label: string;
  amount: number; // GBP per lot, positive = revenue, negative = cost
  perUnit: number; // GBP per net unit kept by buyers
}

export interface CashPoint { day: number; cumulative: number }

export interface Economics {
  items: number;
  saleableItems: number;
  soldItems: number;
  keptItems: number;
  orders: number;
  ragKg: number;
  saleableYieldPct: number; // kept units / purchased items
  goodsGBP: number;
  freightGBP: number;
  insuranceGBP: number;
  customsValueGBP: number;
  dutyGBP: number;
  importVatGBP: number;
  vatExpenseGBP: number;
  vatRecoverableGBP: number;
  revenueGBP: number;
  netGMVGBP: number;
  totalCostGBP: number;
  contributionGBP: number;
  contributionPerUnit: number;
  marginPct: number;
  waterfall: WaterfallStep[];
  cash: { timeline: CashPoint[]; peakCashGBP: number; paybackDay: number | null; vatRefundDay: number | null };
}

export interface ScaleNeed {
  targetGMV: number;
  netUnits: number;
  soldUnits: number;
  orders: number;
  lots: number;
  kg: number;
  lotsInFlight: number;
  capitalGBP: number;
  cycleDays: number;
}

export interface SensitivityRow {
  key: 'base' | 'freight' | 'fx' | 'returns' | 'combined';
  label: string;
  contributionPerUnit: number | null;
  marginPct: number | null;
  passes: boolean;
}

export interface Check { id: string; ok: boolean; label: string; detail: string; blocking: boolean }

export interface RouteResult {
  routeId: 'A' | 'B';
  valid: boolean;
  errors: string[];
  economics: Economics | null;
  scale: ScaleNeed | null;
  sensitivity: SensitivityRow[];
  missing: string[];
  stale: string[];
  checks: Check[];
  decision: { code: DecisionCode; label: string; reasons: string[] };
}
