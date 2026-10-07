import type { EvidenceKey, InputKey } from './types';

export interface InputMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  minExclusive?: boolean;
  integer?: boolean;
  nullable?: boolean;
  critical: boolean;
  group: 'Supply' | 'Demand' | 'Landing' | 'Last mile' | 'Timing';
}

export const INPUT_META: Record<InputKey, InputMeta> = {
  lotKg: { label: 'Lot weight', unit: 'kg per lot', min: 0, max: 1e7, minExclusive: true, critical: true, group: 'Supply' },
  avgItemKg: { label: 'Average item weight', unit: 'kg per item', min: 0, max: 50, minExclusive: true, critical: true, group: 'Supply' },
  purchasePricePerKg: { label: 'Purchase price', unit: 'origin currency per kg', min: 0, max: 1e6, minExclusive: true, critical: true, group: 'Supply' },
  originPerGBP: { label: 'FX rate', unit: 'origin currency per GBP 1', min: 0, max: 1e6, minExclusive: true, critical: true, group: 'Supply' },
  gradingYieldPct: { label: 'Grading yield (saleable)', unit: '% of items', min: 0, max: 100, minExclusive: true, critical: true, group: 'Supply' },
  ragValuePerKg: { label: 'Reject (rag) recovery', unit: 'GBP per reject kg', min: 0, max: 1000, critical: false, group: 'Supply' },
  sellThroughPct: { label: 'Sell-through', unit: '% of saleable items', min: 0, max: 100, minExclusive: true, critical: true, group: 'Demand' },
  sellPricePerItem: { label: 'Sell price to UK buyer', unit: 'GBP per item, ex VAT', min: 0, max: 1e5, minExclusive: true, critical: true, group: 'Demand' },
  itemsPerOrder: { label: 'Items per buyer order', unit: 'items per order', min: 1, max: 1e5, critical: true, group: 'Demand' },
  returnsPct: { label: 'Returns', unit: '% of sold items', min: 0, max: 99, critical: true, group: 'Demand' },
  returnCostPerItem: { label: 'Cost per return', unit: 'GBP per returned item', min: 0, max: 1e4, critical: false, group: 'Demand' },
  freightFixed: { label: 'Freight, fixed', unit: 'GBP per shipment', min: 0, max: 1e7, critical: true, group: 'Landing' },
  freightPerKg: { label: 'Freight, variable', unit: 'GBP per kg', min: 0, max: 1e4, critical: true, group: 'Landing' },
  insurancePct: { label: 'Cargo insurance', unit: '% of goods + freight', min: 0, max: 100, critical: false, group: 'Landing' },
  dutyRatePct: { label: 'Duty rate (illustrative)', unit: '% of customs value', min: 0, max: 100, nullable: true, critical: true, group: 'Landing' },
  importVatPct: { label: 'Import VAT rate', unit: '% of customs value + duty', min: 0, max: 100, critical: true, group: 'Landing' },
  brokerFee: { label: 'Customs broker / IOR fee', unit: 'GBP per shipment', min: 0, max: 1e6, critical: true, group: 'Landing' },
  handlingPerItem: { label: 'UK receiving and grading check', unit: 'GBP per purchased item', min: 0, max: 1e4, critical: false, group: 'Landing' },
  lastMilePerOrder: { label: 'Last mile to buyer', unit: 'GBP per order', min: 0, max: 1e4, critical: true, group: 'Last mile' },
  paymentFeePct: { label: 'Payment processing', unit: '% of gross sales', min: 0, max: 100, critical: false, group: 'Last mile' },
  transitDays: { label: 'Transit + clearance', unit: 'days', min: 0, max: 365, integer: true, critical: true, group: 'Timing' },
  sellThroughDays: { label: 'Sell-through window', unit: 'days', min: 1, max: 730, integer: true, critical: true, group: 'Timing' },
  payoutDays: { label: 'Buyer cash received after sale', unit: 'days', min: 0, max: 365, integer: true, critical: false, group: 'Timing' },
  vatRecoveryDays: { label: 'Import VAT recovered after arrival', unit: 'days', min: 0, max: 730, integer: true, critical: true, group: 'Timing' },
};

export const FLAG_META = {
  importerOfRecord: { label: 'Importer of record', critical: true },
  vatRecoverable: { label: 'Import VAT recoverable (assumption)', critical: true },
} as const;

export function evidenceLabel(key: EvidenceKey): string {
  return key in INPUT_META ? INPUT_META[key as InputKey].label : FLAG_META[key as keyof typeof FLAG_META].label;
}

export function isCritical(key: EvidenceKey): boolean {
  return key in INPUT_META ? INPUT_META[key as InputKey].critical : FLAG_META[key as keyof typeof FLAG_META].critical;
}
