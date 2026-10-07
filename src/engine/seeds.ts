import { EVIDENCE_KEYS, SCHEMA, type Evidence, type EvidenceKey, type InputKey, type Route, type Scenario } from './types';

// All seed data is synthetic. Origins, suppliers, currencies and quotes are invented for illustration.

const SRC: Partial<Record<EvidenceKey, string>> = {
  lotKg: 'Synthetic supplier lot sheet',
  avgItemKg: 'Synthetic sample weigh-in (50 items)',
  purchasePricePerKg: 'Synthetic supplier quote',
  originPerGBP: 'Illustrative FX assumption',
  gradingYieldPct: 'Synthetic grading sample (200 items)',
  ragValuePerKg: 'Illustrative rag buyer price',
  sellThroughPct: 'Illustrative: comparable category sell-through',
  sellPricePerItem: 'Illustrative buyer price point',
  itemsPerOrder: 'Illustrative average basket',
  returnsPct: 'Illustrative returns assumption',
  returnCostPerItem: 'Illustrative return handling cost',
  freightFixed: 'Synthetic forwarder quote',
  freightPerKg: 'Synthetic forwarder quote',
  insurancePct: 'Synthetic forwarder quote',
  dutyRatePct: 'Illustrative duty assumption (not a classification)',
  importVatPct: 'Illustrative standard-rate assumption',
  brokerFee: 'Synthetic broker quote',
  handlingPerItem: 'Illustrative UK receiving cost',
  lastMilePerOrder: 'Illustrative parcel rate',
  paymentFeePct: 'Illustrative processing fee',
  transitDays: 'Synthetic forwarder quote',
  sellThroughDays: 'Illustrative sell-through window',
  payoutDays: 'Illustrative payout timing',
  vatRecoveryDays: 'Illustrative VAT return timing',
  importerOfRecord: 'Synthetic IOR engagement note',
  vatRecoverable: 'Illustrative assumption: VAT-registered importer',
};

function ev(ref: string, date: string, drop: EvidenceKey[] = []): Record<EvidenceKey, Evidence> {
  const out = {} as Record<EvidenceKey, Evidence>;
  for (const k of EVIDENCE_KEYS) {
    out[k] = drop.includes(k) ? { source: '', sourceDate: '' } : { source: `${SRC[k] ?? 'Illustrative'} ${ref}`, sourceDate: date };
  }
  return out;
}

const baseA: Record<InputKey, number | null> = {
  lotKg: 1000, avgItemKg: 0.5, purchasePricePerKg: 9, originPerGBP: 3, gradingYieldPct: 70, ragValuePerKg: 0.2,
  sellThroughPct: 90, sellPricePerItem: 7.5, itemsPerOrder: 12, returnsPct: 4, returnCostPerItem: 3,
  freightFixed: 400, freightPerKg: 0.6, insurancePct: 1, dutyRatePct: 12, importVatPct: 20, brokerFee: 150,
  handlingPerItem: 0.5, lastMilePerOrder: 8, paymentFeePct: 2.5, transitDays: 28, sellThroughDays: 45,
  payoutDays: 7, vatRecoveryDays: 60,
};

const baseB: Record<InputKey, number | null> = {
  lotKg: 800, avgItemKg: 0.6, purchasePricePerKg: 20, originPerGBP: 6.5, gradingYieldPct: 78, ragValuePerKg: 0.15,
  sellThroughPct: 85, sellPricePerItem: 9, itemsPerOrder: 10, returnsPct: 6, returnCostPerItem: 3.5,
  freightFixed: 650, freightPerKg: 0.35, insurancePct: 0.8, dutyRatePct: 12, importVatPct: 20, brokerFee: 180,
  handlingPerItem: 0.55, lastMilePerOrder: 8, paymentFeePct: 2.5, transitDays: 9, sellThroughDays: 40,
  payoutDays: 7, vatRecoveryDays: 60,
};

function route(id: 'A' | 'B', name: string, origin: string, mode: string, ccy: string, inputs: Record<InputKey, number | null>, evidence: Record<EvidenceKey, Evidence>, ior: Route['importerOfRecord'] = 'confirmed'): Route {
  return { id, name, origin, mode, originCurrency: ccy, inputs, importerOfRecord: ior, vatRecoverable: true, evidence };
}

const limits = { minMarginPct: 15, maxPilotCapitalGBP: 15000, maxScaleCapitalGBP: 1200000, targetAnnualGMV: 5000000 };
const stress = { freightShockPct: 25, fxAdversePct: 10, returnsShockPts: 3 };

export function seedScenarios(): Scenario[] {
  return [
    {
      schema: SCHEMA, id: 'profitable-pilot', name: 'Profitable pilot',
      description: 'Two synthetic routes for graded vintage outerwear into existing UK buyers. Both clear every gate on illustrative assumptions.',
      asOfDate: '2026-10-01', staleAfterDays: 90, limits: { ...limits }, stress: { ...stress },
      routes: [
        route('A', 'Route A: Valdora sea lane', 'Valdora (synthetic origin)', 'Sea freight, 40ft share', 'VLD', { ...baseA }, ev('VQ-014', '2026-09-12')),
        route('B', 'Route B: Ostmark road lane', 'Ostmark (synthetic origin)', 'Road freight, groupage', 'OSK', { ...baseB }, ev('OQ-207', '2026-09-20')),
      ],
    },
    {
      schema: SCHEMA, id: 'freight-stress', name: 'Freight stress failure',
      description: 'Same buyers, but Route A moves to a long-haul lane with heavier freight. Base margin clears the floor; a 25% freight shock does not.',
      asOfDate: '2026-10-01', staleAfterDays: 90, limits: { ...limits }, stress: { ...stress },
      routes: [
        route('A', 'Route A: Valdora long-haul lane', 'Valdora (synthetic origin)', 'Sea + rail, long haul', 'VLD', { ...baseA, purchasePricePerKg: 7, freightFixed: 600, freightPerKg: 1.4, transitDays: 42 }, ev('VQ-031', '2026-09-18')),
        route('B', 'Route B: Ostmark road lane', 'Ostmark (synthetic origin)', 'Road freight, groupage', 'OSK', { ...baseB }, ev('OQ-207', '2026-09-20')),
      ],
    },
    {
      schema: SCHEMA, id: 'evidence-gap', name: 'Evidence gap',
      description: 'Route B shows the best margin, but its tariff rate is unknown, the importer of record is unconfirmed and two inputs have no source. Scale is blocked.',
      asOfDate: '2026-10-01', staleAfterDays: 90, limits: { ...limits }, stress: { ...stress },
      routes: [
        route('A', 'Route A: Valdora sea lane', 'Valdora (synthetic origin)', 'Sea freight, 40ft share', 'VLD', { ...baseA }, ev('VQ-014', '2026-09-12')),
        route('B', 'Route B: Kerrow direct lane', 'Kerrow (synthetic origin)', 'Air consolidation', 'KRW-S', { ...baseB, purchasePricePerKg: 17, freightFixed: 300, freightPerKg: 0.5, dutyRatePct: null, transitDays: 6 },
          ev('KQ-002', '2026-09-25', ['dutyRatePct', 'gradingYieldPct', 'returnsPct']), 'unknown'),
      ],
    },
  ];
}
