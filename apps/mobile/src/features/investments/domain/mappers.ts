import type { CostChange, CostChangeKind, RecentCostIncrease } from './costChange';
import type { EntityComparison } from './entityComparison';
import { isGovernmentLevel } from './governmentLevel';
import type { Coordinates, FunctionSummary, IngestRun, Investment } from './investment';
import type { MapListPage, MapPoints } from './mapPoints';
import type { RegionComparison } from './regionComparison';
import type { StalledInvestment } from './stalled';

type Numeric = number | string | null | undefined;
type Text = string | null | undefined;

/** Row shape of `public.investments` (subset read by the app). PostgREST may send numerics as strings. */
export interface InvestmentRow {
  cui: string;
  name: Text;
  entity: Text;
  status: Text;
  situation: Text;
  function: Text;
  functional_division: Text;
  functional_group: Text;
  /** Set by the database trigger from function and functional_division (function crosswalk). */
  function_canonical: Text;
  beneficiaries: Numeric;
  registered_at: Text;
  viability_at: Text;
  first_accrual_month: Text;
  last_accrual_month: Text;
  viable_amount: Numeric;
  updated_cost: Numeric;
  updated_cost_valid: boolean | null | undefined;
  spent_anomaly: boolean | null | undefined;
  accrued_total: Numeric;
  cost_increase: Numeric;
  cost_increase_pct: Numeric;
  execution_progress: Numeric;
  department_code: number | null;
  department_name: Text;
  source_updated_at: Text;
  government_level?: Text;
  physical_progress?: Numeric;
  /** Not in stalled_investments_by_level. */
  executing_unit?: Text;
  province?: Text;
  district?: Text;
  data_source?: Text;
  /** Open data; null when MEF has none or an invalid one. Not in stalled_investments_by_level. */
  latitude?: Numeric;
  longitude?: Numeric;
}

/** Columns shared by `investments` and `stalled_investments_by_level`. */
const SHARED_COLUMNS =
  'cui,name,entity,status,situation,function,functional_division,functional_group,beneficiaries,' +
  'registered_at,viability_at,first_accrual_month,last_accrual_month,viable_amount,updated_cost,' +
  'updated_cost_valid,accrued_total,cost_increase,cost_increase_pct,execution_progress,department_code,' +
  'department_name,source_updated_at,spent_anomaly,government_level,physical_progress,function_canonical';

export const INVESTMENT_COLUMNS = `${SHARED_COLUMNS},executing_unit,province,district,data_source,latitude,longitude`;

/** Row shape of the `stalled_investments_by_level` view. */
export interface StalledInvestmentRow extends InvestmentRow {
  months_without_accrual: Numeric;
  pending_amount: Numeric;
}

export const STALLED_INVESTMENT_COLUMNS = `${SHARED_COLUMNS},months_without_accrual,pending_amount`;

export interface FunctionSummaryRow {
  department_code: number;
  function: Text;
  investment_count: Numeric;
  total_updated_cost: Numeric;
  total_cost_increase: Numeric;
}

export interface IngestRunRow {
  started_at: string;
  finished_at: string;
}

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const toText = (value: Text): string | null => value ?? null;

export function mapInvestmentRow(row: InvestmentRow): Investment {
  return {
    cui: row.cui,
    name: toText(row.name),
    entity: toText(row.entity),
    status: toText(row.status),
    situation: toText(row.situation),
    function: toText(row.function),
    functionCanonical: toText(row.function_canonical),
    functionalDivision: toText(row.functional_division),
    functionalGroup: toText(row.functional_group),
    beneficiaries: toNumber(row.beneficiaries),
    registeredAt: toText(row.registered_at),
    viabilityAt: toText(row.viability_at),
    firstAccrualMonth: toText(row.first_accrual_month),
    lastAccrualMonth: toText(row.last_accrual_month),
    viableAmount: toNumber(row.viable_amount),
    updatedCost: toNumber(row.updated_cost),
    updatedCostValid: row.updated_cost_valid === true,
    spentAnomaly: row.spent_anomaly === true,
    accruedTotal: toNumber(row.accrued_total),
    costIncrease: toNumber(row.cost_increase),
    costIncreasePct: toNumber(row.cost_increase_pct),
    executionProgress: toNumber(row.execution_progress),
    departmentCode: row.department_code ?? null,
    departmentName: toText(row.department_name),
    sourceUpdatedAt: toText(row.source_updated_at),
    governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
    executingUnit: toText(row.executing_unit),
    province: toText(row.province),
    district: toText(row.district),
    physicalProgress: toNumber(row.physical_progress),
    dataSource: row.data_source === 'open_data' ? 'open_data' : 'ssi',
    coordinates: toCoordinates(row.latitude, row.longitude),
  };
}

function toCoordinates(latitude: Numeric, longitude: Numeric): Coordinates | null {
  const lat = toNumber(latitude);
  const lon = toNumber(longitude);
  return lat === null || lon === null ? null : { latitude: lat, longitude: lon };
}

/** Row shape of the `map_points` function (see its migration): a project or a grid cluster. */
export interface MapPointRow {
  kind: Text;
  cui: Text;
  name: Text;
  latitude: Numeric;
  longitude: Numeric;
  point_count: Numeric;
  government_level: Text;
  cost_increase: Numeric;
  cost_increase_pct: Numeric;
  updated_cost_valid: boolean | null | undefined;
  total_cost_increase: Numeric;
  max_cost_increase_pct: Numeric;
  increased_count: Numeric;
}

/** Clusters when the function returned clusters (it never mixes kinds); points otherwise. */
export function mapMapPointRows(rows: MapPointRow[]): MapPoints {
  const located = rows.flatMap((row) => {
    const at = toCoordinates(row.latitude, row.longitude);
    return at ? [{ row, at }] : [];
  });
  if (rows.some((row) => row.kind === 'cluster')) {
    return {
      kind: 'clusters',
      clusters: located
        .filter(({ row }) => row.kind === 'cluster')
        .map(({ row, at }) => ({
          ...at,
          count: toNumber(row.point_count) ?? 0,
          totalCostIncrease: toNumber(row.total_cost_increase) ?? 0,
          maxCostIncreasePct: toNumber(row.max_cost_increase_pct),
          increasedCount: toNumber(row.increased_count) ?? 0,
        })),
    };
  }
  return {
    kind: 'points',
    points: located.flatMap(({ row, at }) =>
      row.cui
        ? [
            {
              cui: row.cui,
              name: toText(row.name),
              ...at,
              governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
              costIncrease: toNumber(row.cost_increase),
              costIncreasePct: toNumber(row.cost_increase_pct),
              updatedCostValid: row.updated_cost_valid === true,
            },
          ]
        : [],
    ),
  };
}

/** Row shape of the `map_list` function (see its migration). */
export interface MapListRow {
  cui: Text;
  name: Text;
  entity: Text;
  government_level: Text;
  status: Text;
  latitude: Numeric;
  longitude: Numeric;
  updated_cost: Numeric;
  updated_cost_valid: boolean | null | undefined;
  accrued_total: Numeric;
  cost_increase: Numeric;
  cost_increase_pct: Numeric;
  execution_progress: Numeric;
  spent_anomaly: boolean | null | undefined;
  physical_progress: Numeric;
  last_accrual_month: Text;
  stalled: boolean | null | undefined;
  /** count(*) over (): the matching projects in the view, on every row. */
  total_count: Numeric;
}

export function mapMapListRows(rows: MapListRow[]): MapListPage {
  const total = rows.length ? (toNumber(rows[0].total_count) ?? 0) : 0;
  const items = rows.flatMap((row) => {
    const at = toCoordinates(row.latitude, row.longitude);
    if (!at || !row.cui) return [];
    return [
      {
        cui: row.cui,
        name: toText(row.name),
        entity: toText(row.entity),
        governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
        status: toText(row.status),
        ...at,
        updatedCost: toNumber(row.updated_cost),
        updatedCostValid: row.updated_cost_valid === true,
        accruedTotal: toNumber(row.accrued_total),
        costIncrease: toNumber(row.cost_increase),
        costIncreasePct: toNumber(row.cost_increase_pct),
        executionProgress: toNumber(row.execution_progress),
        spentAnomaly: row.spent_anomaly === true,
        physicalProgress: toNumber(row.physical_progress),
        lastAccrualMonth: toText(row.last_accrual_month),
        stalled: row.stalled === true,
      },
    ];
  });
  return { items, total };
}

export function mapStalledInvestmentRow(row: StalledInvestmentRow): StalledInvestment {
  return {
    ...mapInvestmentRow(row),
    monthsWithoutAccrual: toNumber(row.months_without_accrual) ?? 0,
    pendingAmount: toNumber(row.pending_amount) ?? 0,
  };
}

export function mapFunctionSummaryRow(row: FunctionSummaryRow): FunctionSummary {
  return {
    function: toText(row.function),
    investmentCount: toNumber(row.investment_count) ?? 0,
    totalUpdatedCost: toNumber(row.total_updated_cost),
    totalCostIncrease: toNumber(row.total_cost_increase),
  };
}

export function mapIngestRunRow(row: IngestRunRow): IngestRun {
  return { startedAt: row.started_at, finishedAt: row.finished_at };
}

/** Row shape of `public.investment_cost_changes`. */
export interface CostChangeRow {
  id: number | string;
  cui: string;
  change_kind: CostChangeKind;
  observed_at: string;
  source_updated_at: Text;
  previous_viable_amount: Numeric;
  viable_amount: Numeric;
  previous_updated_cost: Numeric;
  updated_cost: Numeric;
  accrued_total: Numeric;
  updated_cost_delta: Numeric;
}

export const COST_CHANGE_COLUMNS =
  'id,cui,change_kind,observed_at,source_updated_at,previous_viable_amount,viable_amount,' +
  'previous_updated_cost,updated_cost,accrued_total,updated_cost_delta';

/** A cost change with its investment embedded through the `cui` foreign key. */
export interface RecentCostIncreaseRow extends CostChangeRow {
  investments: { name: Text; department_code: number | null; government_level?: Text } | null;
}

export function mapCostChangeRow(row: CostChangeRow): CostChange {
  return {
    id: Number(row.id),
    cui: row.cui,
    kind: row.change_kind,
    observedAt: row.observed_at,
    sourceUpdatedAt: toText(row.source_updated_at),
    previousViableAmount: toNumber(row.previous_viable_amount),
    viableAmount: toNumber(row.viable_amount),
    previousUpdatedCost: toNumber(row.previous_updated_cost),
    updatedCost: toNumber(row.updated_cost),
    accruedTotal: toNumber(row.accrued_total),
    updatedCostDelta: toNumber(row.updated_cost_delta),
  };
}

export function mapRecentCostIncreaseRow(row: RecentCostIncreaseRow): RecentCostIncrease {
  return {
    ...mapCostChangeRow(row),
    name: toText(row.investments?.name),
    departmentCode: row.investments?.department_code ?? null,
    governmentLevel: isGovernmentLevel(row.investments?.government_level) ? row.investments.government_level : null,
  };
}

/** Row shape of the `region_comparison` view. */
export interface RegionComparisonRow {
  department_code: number;
  department_name: Text;
  project_count: Numeric;
  active_count: Numeric;
  valid_cost_count: Numeric;
  total_viable_amount: Numeric;
  total_updated_cost: Numeric;
  total_cost_increase: Numeric;
  projects_with_increase: Numeric;
  cost_increase_pct: Numeric;
  overspent_count: Numeric;
  stalled_count: Numeric;
  stalled_pending_amount: Numeric;
}

export const REGION_COMPARISON_COLUMNS =
  'department_code,department_name,project_count,active_count,valid_cost_count,total_viable_amount,' +
  'total_updated_cost,total_cost_increase,projects_with_increase,cost_increase_pct,overspent_count,' +
  'stalled_count,stalled_pending_amount';

export function mapRegionComparisonRow(row: RegionComparisonRow): RegionComparison {
  return {
    departmentCode: row.department_code,
    departmentName: toText(row.department_name),
    projectCount: toNumber(row.project_count) ?? 0,
    activeCount: toNumber(row.active_count) ?? 0,
    validCostCount: toNumber(row.valid_cost_count) ?? 0,
    totalViableAmount: toNumber(row.total_viable_amount),
    totalUpdatedCost: toNumber(row.total_updated_cost),
    totalCostIncrease: toNumber(row.total_cost_increase) ?? 0,
    projectsWithIncrease: toNumber(row.projects_with_increase) ?? 0,
    costIncreasePct: toNumber(row.cost_increase_pct),
    overspentCount: toNumber(row.overspent_count) ?? 0,
    stalledCount: toNumber(row.stalled_count) ?? 0,
    stalledPendingAmount: toNumber(row.stalled_pending_amount) ?? 0,
  };
}

/** Row shape of the `entity_comparison` view. */
export interface EntityComparisonRow {
  entity: string;
  government_level: Text;
  scope_department_code: number;
  department_code: number | null;
  department_name: Text;
  project_count: Numeric;
  valid_cost_count: Numeric;
  total_updated_cost: Numeric;
  total_cost_increase: Numeric;
  projects_with_increase: Numeric;
  increased_viable_amount: Numeric;
  cost_increase_pct: Numeric;
  overspent_count: Numeric;
  stalled_count: Numeric;
  stalled_pending_amount: Numeric;
}

export const ENTITY_COMPARISON_COLUMNS =
  'entity,government_level,scope_department_code,department_code,department_name,project_count,' +
  'valid_cost_count,total_updated_cost,total_cost_increase,projects_with_increase,increased_viable_amount,' +
  'cost_increase_pct,overspent_count,stalled_count,stalled_pending_amount';

export function mapEntityComparisonRow(row: EntityComparisonRow): EntityComparison {
  return {
    entity: row.entity,
    governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
    departmentCode: row.department_code ?? null,
    departmentName: toText(row.department_name),
    projectCount: toNumber(row.project_count) ?? 0,
    validCostCount: toNumber(row.valid_cost_count) ?? 0,
    totalUpdatedCost: toNumber(row.total_updated_cost),
    totalCostIncrease: toNumber(row.total_cost_increase) ?? 0,
    projectsWithIncrease: toNumber(row.projects_with_increase) ?? 0,
    increasedViableAmount: toNumber(row.increased_viable_amount),
    costIncreasePct: toNumber(row.cost_increase_pct),
    overspentCount: toNumber(row.overspent_count) ?? 0,
    stalledCount: toNumber(row.stalled_count) ?? 0,
    stalledPendingAmount: toNumber(row.stalled_pending_amount) ?? 0,
  };
}
