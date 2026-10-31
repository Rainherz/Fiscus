import { canonicalFunction } from '../domain/functionCrosswalk';
import type { GovernmentLevel } from '../domain/governmentLevel';
import type { InvestmentClosure } from '../domain/investment';
import type { CostChangeRow, InvestmentRow } from '../domain/mappers';
import type { ParalyzedWork } from '../domain/paralyzed';

interface SampleInput {
  cui: string;
  name?: string | null;
  function?: string | null;
  /** Functional division; with `function` it derives `function_canonical` like the database trigger. */
  division?: string | null;
  viable?: number | null;
  updated?: number | null;
  /** Spent ratio (accrued / updated cost); derives the accrued total. */
  progress?: number | null;
  /** Accrued total, when it cannot be derived from `progress` (e.g. placeholder costs). */
  accrued?: number | null;
  viabilityAt?: string | null;
  /** First day of the month of the last accrual. */
  lastAccrualMonth?: string | null;
  /** Null: a national project spanning several departments. */
  departmentCode?: number | null;
  departmentName?: string | null;
  status?: string | null;
  /** Defaults to GR, the SSI level. */
  level?: GovernmentLevel;
  entity?: string | null;
  executingUnit?: string | null;
  province?: string | null;
  district?: string | null;
  physicalProgress?: number | null;
  coordinates?: { latitude: number; longitude: number };
  /** Defaults to the SSI. */
  dataSource?: 'ssi' | 'open_data' | 'open_data_closed';
  /** Closure facts (closed-investments file); every field defaults to null. */
  closure?: Partial<InvestmentClosure>;
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
    entity: input.entity ?? null,
    status: input.status === undefined ? 'ACTIVO' : input.status,
    situation: null,
    function: input.function ?? null,
    functional_division: input.division ?? null,
    functional_group: null,
    function_canonical: canonicalFunction(input.function, input.division),
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
    department_code: input.departmentCode === undefined ? 4 : input.departmentCode,
    department_name: input.departmentName === undefined ? 'AREQUIPA' : input.departmentName,
    source_updated_at: '2026-10-26T05:00:00Z',
    spent_anomaly: spentRatio !== null && spentRatio > SPENT_ANOMALY_RATIO,
    government_level: input.level ?? 'GR',
    executing_unit: input.executingUnit ?? null,
    province: input.province ?? null,
    district: input.district ?? null,
    physical_progress: input.physicalProgress ?? null,
    data_source: input.dataSource ?? 'ssi',
    latitude: input.coordinates?.latitude ?? null,
    longitude: input.coordinates?.longitude ?? null,
    closed_at: input.closure?.closedAt ?? null,
    closure_description: input.closure?.description ?? null,
    liquidation_amount: input.closure?.liquidationAmount ?? null,
    liquidated_at: input.closure?.liquidatedAt ?? null,
    culminated: input.closure?.culminated ?? null,
    physical_start_at: input.closure?.physicalStartAt ?? null,
    physical_end_at: input.closure?.physicalEndAt ?? null,
    operation_start_at: input.closure?.operationStartAt ?? null,
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

const DEMO_REGIONAL_ENTITY = 'GOBIERNO REGIONAL AREQUIPA (demo)';

/**
 * DEMO ONLY, not MEF data: invented projects and figures so the demo mode can show "Sin gasto
 * reciente". Three meet the rule; the fourth has a recent accrual and sets the reference month
 * (the latest accrual month of the dataset) to October 2026. Two carry labels of the old MEF
 * functional classification, so the demo shows the function crosswalk.
 */
export const STALLED_DEMO_SAMPLE: InvestmentRow[] = [
  sampleRow({
    cui: '9900001',
    name: 'Planta de tratamiento de aguas residuales (demo)',
    entity: DEMO_REGIONAL_ENTITY,
    // Old MEF classification: grouped under SANEAMIENTO by the function crosswalk.
    function: 'SALUD Y SANEAMIENTO',
    division: 'SANEAMIENTO',
    viable: 184_500_000,
    updated: 184_500_000,
    progress: 0.41,
    lastAccrualMonth: '2025-02-01',
  }),
  sampleRow({
    cui: '9900002',
    name: 'Mejoramiento de carretera departamental (demo)',
    entity: DEMO_REGIONAL_ENTITY,
    function: 'TRANSPORTE',
    viable: 62_300_000,
    updated: 62_300_000,
    progress: 0.12,
    lastAccrualMonth: '2023-07-01',
  }),
  sampleRow({
    cui: '9900003',
    name: 'Institución educativa secundaria (demo)',
    entity: DEMO_REGIONAL_ENTITY,
    // Old MEF classification: grouped under EDUCACIÓN by the function crosswalk.
    function: 'EDUCACION Y CULTURA',
    division: 'INFRAESTRUCTURA EDUCATIVA',
    viable: 18_750_000,
    updated: 18_750_000,
    progress: 0.77,
    lastAccrualMonth: '2025-08-01',
  }),
  sampleRow({
    cui: '9900004',
    name: 'Ampliación de canal de riego (demo)',
    entity: DEMO_REGIONAL_ENTITY,
    function: 'AGRARIA',
    viable: 40_000_000,
    updated: 40_000_000,
    progress: 0.5,
    lastAccrualMonth: '2026-10-01',
  }),
];

const DEMO_MINISTRY = 'MINISTERIO DE TRANSPORTES Y COMUNICACIONES (demo)';
const DEMO_CAYMA = 'MUNICIPALIDAD DISTRITAL DE CAYMA (demo)';

/**
 * DEMO ONLY, not MEF data: invented national (GN) and local (GL) projects, as the open-data ingest
 * loads them, so the demo mode exercises the level filter, the entity ranking and the detail
 * (physical progress, location). One national project spans several departments (no department):
 * it only appears nationwide.
 */
export const LEVELS_DEMO_SAMPLE: InvestmentRow[] = [
  sampleRow({
    cui: '9900101',
    name: 'Red vial nacional tramo multirregional (demo)',
    level: 'GN',
    entity: DEMO_MINISTRY,
    executingUnit: 'PROVIAS NACIONAL (demo)',
    function: 'TRANSPORTE',
    viable: 2_400_000_000,
    updated: 3_150_000_000,
    progress: 0.36,
    physicalProgress: 31,
    viabilityAt: '2014-03-12',
    lastAccrualMonth: '2026-09-01',
    departmentCode: null,
    departmentName: null,
    // As MEF writes it for a project spanning several provinces and districts.
    province: '- TODOS -',
    district: '- TODOS -',
    dataSource: 'open_data',
  }),
  sampleRow({
    cui: '9900102',
    name: 'Puente vehicular sobre el río Chili (demo)',
    level: 'GN',
    entity: DEMO_MINISTRY,
    executingUnit: 'PROVIAS NACIONAL (demo)',
    function: 'TRANSPORTE',
    viable: 180_000_000,
    updated: 236_000_000,
    progress: 0.58,
    viabilityAt: '2019-08-01',
    lastAccrualMonth: '2026-10-01',
    province: 'AREQUIPA',
    district: 'AREQUIPA',
    dataSource: 'open_data',
  }),
  sampleRow({
    cui: '9900201',
    name: 'Mejoramiento de pistas y veredas en Cayma (demo)',
    level: 'GL',
    entity: DEMO_CAYMA,
    executingUnit: DEMO_CAYMA,
    function: 'TRANSPORTE',
    viable: 8_600_000,
    updated: 12_900_000,
    progress: 0.61,
    physicalProgress: 42,
    viabilityAt: '2021-05-20',
    lastAccrualMonth: '2026-10-01',
    province: 'AREQUIPA',
    district: 'CAYMA',
    coordinates: { latitude: -16.3667, longitude: -71.55 },
    dataSource: 'open_data',
  }),
  sampleRow({
    cui: '9900202',
    name: 'Ampliación del servicio de agua potable en Cayma (demo)',
    level: 'GL',
    entity: DEMO_CAYMA,
    executingUnit: DEMO_CAYMA,
    function: 'SANEAMIENTO',
    viable: 4_200_000,
    updated: 4_950_000,
    progress: 0.22,
    viabilityAt: '2023-02-14',
    lastAccrualMonth: '2026-08-01',
    province: 'AREQUIPA',
    district: 'CAYMA',
    dataSource: 'open_data',
  }),
  sampleRow({
    cui: '9900203',
    name: 'Mercado de abastos de San Jerónimo (demo)',
    level: 'GL',
    entity: 'MUNICIPALIDAD DISTRITAL DE SAN JERONIMO (demo)',
    function: 'COMERCIO',
    viable: 15_000_000,
    updated: 21_300_000,
    progress: 0.47,
    physicalProgress: 55,
    viabilityAt: '2020-11-09',
    lastAccrualMonth: '2026-07-01',
    departmentCode: 8,
    departmentName: 'CUSCO',
    province: 'CUSCO',
    district: 'SAN JERONIMO',
    dataSource: 'open_data',
  }),
];

/**
 * DEMO ONLY, not MEF data: invented closed projects (status CERRADO) for the status filter, the
 * CERRADO tag, the closure facts on the detail screen and the hollow map markers. One is owned by
 * the SSI (closed regional projects come from both sources), one was not completed and would be
 * "sin gasto reciente" if it were active (closed projects never are).
 */
export const CLOSED_DEMO_SAMPLE: InvestmentRow[] = [
  sampleRow({
    cui: '9900301',
    name: 'Puente peatonal Chilina (demo)',
    status: 'CERRADO',
    level: 'GL',
    entity: 'MUNICIPALIDAD PROVINCIAL DE AREQUIPA (demo)',
    executingUnit: 'MUNICIPALIDAD PROVINCIAL DE AREQUIPA (demo)',
    function: 'TRANSPORTE',
    viable: 6_200_000,
    updated: 7_450_000,
    progress: 0.99,
    viabilityAt: '2019-05-10',
    lastAccrualMonth: '2024-05-01',
    province: 'AREQUIPA',
    district: 'AREQUIPA',
    coordinates: { latitude: -16.385, longitude: -71.535 },
    dataSource: 'open_data_closed',
    closure: {
      closedAt: '2024-08-15',
      description: 'Sí, con liquidación',
      liquidationAmount: 7_380_000,
      liquidatedAt: '2024-06-30',
      culminated: true,
      physicalStartAt: '2021-03-01',
      physicalEndAt: '2023-11-30',
      operationStartAt: '2024-01-15',
    },
  }),
  sampleRow({
    cui: '9900302',
    name: 'Instalación del sistema de riego en Chiguata (demo)',
    status: 'CERRADO',
    level: 'GL',
    entity: 'MUNICIPALIDAD DISTRITAL DE CHIGUATA (demo)',
    function: 'AGROPECUARIA',
    viable: 3_100_000,
    updated: 3_100_000,
    progress: 0.42,
    viabilityAt: '2017-09-04',
    lastAccrualMonth: '2022-02-01',
    province: 'AREQUIPA',
    district: 'CHIGUATA',
    coordinates: { latitude: -16.4, longitude: -71.4 },
    dataSource: 'open_data_closed',
    closure: { closedAt: '2023-05-20', description: 'No culminada', culminated: false },
  }),
  sampleRow({
    cui: '9900303',
    name: 'Hospital de apoyo de Camaná (demo)',
    status: 'CERRADO',
    entity: 'GOBIERNO REGIONAL AREQUIPA',
    function: 'SALUD',
    viable: 95_000_000,
    updated: 132_000_000,
    progress: 1.02,
    viabilityAt: '2012-02-20',
    lastAccrualMonth: '2022-10-01',
    coordinates: { latitude: -16.63, longitude: -72.7 },
    closure: {
      closedAt: '2022-12-01',
      description: 'Sí, con liquidación',
      liquidationAmount: 131_500_000,
      liquidatedAt: '2022-11-10',
      culminated: true,
    },
  }),
];

/**
 * DEMO ONLY, not MEF data: approximate map positions (city or district level) so the demo mode can
 * show the map. The SSI records carry no coordinates in the source. Left out on purpose: the
 * multi-region national project and one unverified record, as projects without coordinates.
 */
const DEMO_COORDINATES: Record<string, [latitude: number, longitude: number]> = {
  '2088142': [-16.35, -72.15],
  '2178454': [-16.42, -71.63],
  '2233862': [-16.48, -71.78],
  '2322531': [-16.36, -71.57],
  '2331873': [-16.3, -71.6],
  '2094808': [-13.53, -71.97],
  '2045951': [-16.45, -71.49],
  '2057689': [-16.41, -71.52],
  '9900001': [-16.44, -71.58],
  '9900002': [-15.84, -72.42],
  '9900003': [-16.39, -71.54],
  '9900004': [-16.62, -72.71],
  '9900102': [-16.4, -71.54],
  '9900202': [-16.37, -71.54],
  '9900203': [-13.55, -71.89],
};

function withDemoCoordinates(row: InvestmentRow): InvestmentRow {
  const demo = DEMO_COORDINATES[row.cui];
  return demo && row.latitude === null ? { ...row, latitude: demo[0], longitude: demo[1] } : row;
}

/** Rows behind the demo mode (EXPO_PUBLIC_USE_MOCK=1). */
export const MOCK_ROWS: InvestmentRow[] = [
  ...AREQUIPA_SAMPLE,
  ...EDGE_CASE_SAMPLE,
  ...STALLED_DEMO_SAMPLE,
  ...LEVELS_DEMO_SAMPLE,
  ...CLOSED_DEMO_SAMPLE,
].map(withDemoCoordinates);

const DEMO_EDITION = { editionCutoff: '2026-06-30', publishedAt: '2026-08-17' };

function demoWork(work: Omit<ParalyzedWork, 'editionCutoff' | 'publishedAt' | 'mefReportUrl'>): ParalyzedWork {
  return { ...DEMO_EDITION, mefReportUrl: null, ...work };
}

/**
 * DEMO ONLY, not Contraloría data: invented obras of the paralyzed-works report, linked to demo CUIs,
 * so the demo mode shows the Contraloría block, ranking, home block and map ring. One project has two
 * obras and also meets "Sin gasto reciente" (the two are independent); one is closed, so it only
 * shows with the "Todos" status. INFOBRAS codes are made up (above any real ObraId seen) and no MEF
 * report is linked.
 */
export const MOCK_PARALYZED_WORKS: ParalyzedWork[] = [
  demoWork({
    infobrasCode: 990001,
    cui: '9900001',
    obraDescription: 'Planta de tratamiento, primera etapa (demo)',
    causalCode: 2,
    causalLabel: 'INCUMPLIMIENTO DE CONTRATO',
    physicalProgress: 38.5,
    remainingWorkBalance: 61_250_000,
  }),
  demoWork({
    infobrasCode: 990002,
    cui: '9900001',
    obraDescription: 'Planta de tratamiento, emisor (demo)',
    causalCode: 10,
    causalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
    physicalProgress: 52,
    remainingWorkBalance: 18_400_000,
  }),
  demoWork({
    infobrasCode: 990003,
    cui: '9900102',
    obraDescription: 'Puente vehicular sobre el río Chili (demo)',
    causalCode: 5,
    causalLabel: 'DEFICIENCIA EN EL EXPEDIENTE TÉCNICO',
    physicalProgress: 57,
    remainingWorkBalance: 94_000_000,
  }),
  demoWork({
    infobrasCode: 990004,
    cui: '9900203',
    obraDescription: 'Mercado de abastos de San Jerónimo (demo)',
    causalCode: 10,
    causalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
    physicalProgress: 41,
    remainingWorkBalance: 9_800_000,
  }),
  demoWork({
    infobrasCode: 990005,
    cui: '9900003',
    obraDescription: 'Institución educativa secundaria (demo)',
    causalCode: 3,
    causalLabel: 'DISCREPANCIAS, CONTROVERSIAS Y ARBITRAJE',
    physicalProgress: 74,
    remainingWorkBalance: 4_100_000,
  }),
  demoWork({
    infobrasCode: 990006,
    cui: '9900302',
    obraDescription: 'Sistema de riego en Chiguata (demo)',
    causalCode: 1,
    causalLabel: 'ABANDONO DE OBRA',
    physicalProgress: 40,
    remainingWorkBalance: 1_750_000,
  }),
];

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
