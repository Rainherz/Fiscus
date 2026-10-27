import type { CostChangeRow, InvestmentRow } from '../domain/mappers';

interface SampleInput {
  cui: string;
  name?: string | null;
  function?: string | null;
  viable?: number | null;
  updated?: number | null;
  /** Spent ratio (accrued / updated cost); derives the accrued total. */
  progress?: number | null;
  /** Accrued total, when it cannot be derived from `progress` (e.g. placeholder costs). */
  accrued?: number | null;
  viabilityAt?: string | null;
  /** First day of the month of the last accrual. */
  lastAccrualMonth?: string | null;
  departmentCode?: number;
  departmentName?: string | null;
  status?: string | null;
}

/** Mirror the database rule for MEF placeholder and truncated updated costs. */
const MIN_VALID_UPDATED_COST = 1000;
const MIN_UPDATED_COST_RATIO = 0.01;
/** Mirrors investments.spent_anomaly: spent ratio above this is flagged as unusual. */
const SPENT_ANOMALY_RATIO = 10;

function isValidUpdatedCost(updated: number | null, viable: number | null): updated is number {
  if (updated === null || updated < MIN_VALID_UPDATED_COST) return false;
  if (viable === null || viable <= 0) return true;
  return updated >= viable * MIN_UPDATED_COST_RATIO;
}

/** Builds an `investments` row, deriving the generated columns the way Postgres does. */
export function sampleRow(input: SampleInput): InvestmentRow {
  const viable = input.viable ?? null;
  const updated = input.updated ?? null;
  const progress = input.progress ?? null;
  const valid = isValidUpdatedCost(updated, viable);
  const accrued =
    input.accrued !== undefined
      ? input.accrued
      : progress !== null && updated !== null
        ? progress * updated
        : null;
  const increase = valid && viable !== null ? updated - viable : null;
  const spentRatio = valid && accrued !== null ? accrued / updated : null;
  return {
    cui: input.cui,
    name: input.name === undefined ? `Proyecto ${input.cui}` : input.name,
    entity: null,
    status: input.status === undefined ? 'ACTIVO' : input.status,
    situation: null,
    function: input.function === undefined ? null : input.function,
    functional_division: null,
    functional_group: null,
    beneficiaries: null,
    registered_at: null,
    viability_at: input.viabilityAt ?? null,
    first_accrual_month: null,
    last_accrual_month: input.lastAccrualMonth ?? null,
    viable_amount: viable,
    updated_cost: updated,
    updated_cost_valid: valid,
    accrued_total: accrued,
    cost_increase: increase,
    cost_increase_pct: increase !== null && viable ? (increase / viable) * 100 : null,
    execution_progress: spentRatio,
    department_code: input.departmentCode ?? 4,
    department_name: input.departmentName === undefined ? 'AREQUIPA' : input.departmentName,
    source_updated_at: '2026-10-26T05:00:00Z',
    spent_anomaly: spentRatio !== null && spentRatio > SPENT_ANOMALY_RATIO,
  };
}

/**
 * Real Arequipa records (MEF SSI, October 2026) used by the demo/mock mode and screenshots.
 * Only the amounts, progress, viability date and function come from the source; status is
 * assumed ACTIVO and the remaining fields are left empty.
 */
export const AREQUIPA_SAMPLE: InvestmentRow[] = [
  sampleRow({
    cui: '2088142',
    name: 'Majes Siguas II etapa',
    function: 'AGRARIA',
    viable: 1_338_419_640,
    updated: 5_147_912_126,
    progress: 0.18,
    viabilityAt: '2008-01-10',
  }),
  sampleRow({
    cui: '2178454',
    name: 'Variante de Uchumayo',
    function: 'TRANSPORTE',
    viable: 214_432_065,
    updated: 654_874_567,
    progress: 0.89,
    viabilityAt: '2013-06-06',
  }),
  sampleRow({
    cui: '2233862',
    name: 'Vía regional Arequipa – La Joya',
    function: 'TRANSPORTE',
    viable: 590_385_602,
    updated: 899_350_626,
    progress: 0.3,
    viabilityAt: '2016-01-25',
  }),
  sampleRow({
    cui: '2322531',
    name: 'Hospital Maritza Campos Díaz',
    function: 'SALUD',
    viable: 112_169_982,
    updated: 348_989_175,
    progress: 0.73,
    viabilityAt: '2016-06-30',
  }),
  sampleRow({
    cui: '2331873',
    name: 'Eje de integración vial norte',
    function: 'TRANSPORTE',
    viable: 266_710_991,
    updated: 423_484_886,
    progress: 0.64,
    viabilityAt: '2017-05-09',
  }),
];

/**
 * Edge cases verified against the MEF data (October 2026), for the demo mode and screenshots.
 * Fields not verified are left empty rather than invented.
 */
export const EDGE_CASE_SAMPLE: InvestmentRow[] = [
  // Accrued total exceeds the updated cost (101.9 %).
  sampleRow({
    cui: '2094808',
    name: 'Hospital Antonio Lorena',
    updated: 1_432_976_292.23,
    accrued: 1_459_731_800.72,
    departmentCode: 8,
    departmentName: 'CUSCO',
    status: null,
  }),
  // MEF publishes S/ 10 as updated cost. Name and region are not verified: the record is placed
  // in Arequipa only so the demo region shows it.
  sampleRow({
    cui: '2196297',
    name: null,
    viable: 166_262_211,
    updated: 10,
    departmentName: null,
    status: null,
  }),
  // Updated cost S/ 4,558.66 against a S/ 1,990,720 viable amount (below 1%): invalid. Name and
  // region are not verified; placed in Arequipa only so the demo region shows it.
  sampleRow({
    cui: '2045951',
    name: null,
    viable: 1_990_720,
    updated: 4_558.66,
    accrued: 1_422_564.44,
    departmentName: null,
    status: null,
  }),
  // Cost coherent with the viable amount, but S/ 18.8 M accrued (6,262 %): unusual source figure,
  // kept visible with a notice. Name and region are not verified, as above.
  sampleRow({
    cui: '2057689',
    name: null,
    viable: 299_700,
    updated: 299_700,
    accrued: 18_768_455.33,
    departmentName: null,
    status: null,
  }),
];

/**
 * DEMO ONLY, not MEF data: invented projects and figures so the demo mode can show "Sin gasto
 * reciente". Three meet the rule; the fourth has a recent accrual and sets the reference month
 * (the latest accrual month of the dataset) to October 2026.
 */
export const STALLED_DEMO_SAMPLE: InvestmentRow[] = [
  sampleRow({
    cui: '9900001',
    name: 'Planta de tratamiento de aguas residuales (demo)',
    function: 'SANEAMIENTO',
    viable: 184_500_000,
    updated: 184_500_000,
    progress: 0.41,
    lastAccrualMonth: '2025-02-01',
  }),
  sampleRow({
    cui: '9900002',
    name: 'Mejoramiento de carretera departamental (demo)',
    function: 'TRANSPORTE',
    viable: 62_300_000,
    updated: 62_300_000,
    progress: 0.12,
    lastAccrualMonth: '2023-07-01',
  }),
  sampleRow({
    cui: '9900003',
    name: 'Institución educativa secundaria (demo)',
    function: 'EDUCACION',
    viable: 18_750_000,
    updated: 18_750_000,
    progress: 0.77,
    lastAccrualMonth: '2025-08-01',
  }),
  sampleRow({
    cui: '9900004',
    name: 'Ampliación de canal de riego (demo)',
    function: 'AGRARIA',
    viable: 40_000_000,
    updated: 40_000_000,
    progress: 0.5,
    lastAccrualMonth: '2026-10-01',
  }),
];

/** Rows behind the demo mode (EXPO_PUBLIC_USE_MOCK=1). */
export const MOCK_ROWS: InvestmentRow[] = [...AREQUIPA_SAMPLE, ...EDGE_CASE_SAMPLE, ...STALLED_DEMO_SAMPLE];

type Amount = number | string | null | undefined;
const amount = (value: Amount): number | null => (value === null || value === undefined ? null : Number(value));

interface ChangeInput {
  cui: string;
  kind: CostChangeRow['change_kind'];
  observedAt: string;
  previousViable?: Amount;
  viable: Amount;
  previousUpdated?: Amount;
  updated: Amount;
  accrued: Amount;
}

/** Builds an `investment_cost_changes` row, deriving updated_cost_delta like the generated column. */
function sampleChange(id: number, input: ChangeInput): CostChangeRow {
  const previousUpdated = amount(input.previousUpdated);
  const updated = amount(input.updated);
  return {
    id,
    cui: input.cui,
    change_kind: input.kind,
    observed_at: input.observedAt,
    source_updated_at: null,
    previous_viable_amount: amount(input.previousViable),
    viable_amount: amount(input.viable),
    previous_updated_cost: previousUpdated,
    updated_cost: updated,
    accrued_total: amount(input.accrued),
    updated_cost_delta: updated !== null && previousUpdated !== null ? updated - previousUpdated : null,
  };
}

const BASELINE_AT = '2026-10-27T10:00:00Z';
const MAJES_CUI = '2088142';

/**
 * DEMO ONLY, not MEF data: an invented cost history for Majes Siguas II so the demo mode can show
 * the history timeline and the recent increases. It ends at the sample row's current values.
 */
const MAJES_DEMO_HISTORY: Omit<ChangeInput, 'cui' | 'accrued'>[] = [
  { kind: 'baseline', observedAt: BASELINE_AT, viable: 1_300_000_000, updated: 5_101_412_126 },
  {
    kind: 'changed',
    observedAt: '2026-11-03T10:00:00Z',
    previousViable: 1_300_000_000,
    viable: 1_300_000_000,
    previousUpdated: 5_101_412_126,
    updated: 5_145_412_126,
  },
  {
    kind: 'changed',
    observedAt: '2026-11-17T10:00:00Z',
    previousViable: 1_300_000_000,
    viable: 1_338_419_640,
    previousUpdated: 5_145_412_126,
    updated: 5_147_912_126,
  },
];

function mockCostChanges(rows: InvestmentRow[]): CostChangeRow[] {
  const inputs = rows.flatMap((row): ChangeInput[] =>
    row.cui === MAJES_CUI
      ? MAJES_DEMO_HISTORY.map((entry) => ({ ...entry, cui: row.cui, accrued: row.accrued_total }))
      : [
          {
            cui: row.cui,
            kind: 'baseline',
            observedAt: BASELINE_AT,
            viable: row.viable_amount,
            updated: row.updated_cost,
            accrued: row.accrued_total,
          },
        ],
  );
  return inputs.map((input, index) => sampleChange(index + 1, input));
}

/** Cost history behind the demo mode: a baseline for every mock row, plus the Majes demo history. */
export const MOCK_COST_CHANGES: CostChangeRow[] = mockCostChanges(MOCK_ROWS);
