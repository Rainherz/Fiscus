import type { FunctionSummary, IngestRun, Investment } from './investment';

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
  beneficiaries: Numeric;
  registered_at: Text;
  viability_at: Text;
  first_accrual_month: Text;
  last_accrual_month: Text;
  viable_amount: Numeric;
  updated_cost: Numeric;
  updated_cost_valid: boolean | null | undefined;
  accrued_total: Numeric;
  cost_increase: Numeric;
  cost_increase_pct: Numeric;
  execution_progress: Numeric;
  department_code: number;
  department_name: Text;
  source_updated_at: Text;
}

export const INVESTMENT_COLUMNS =
  'cui,name,entity,status,situation,function,functional_division,functional_group,beneficiaries,' +
  'registered_at,viability_at,first_accrual_month,last_accrual_month,viable_amount,updated_cost,' +
  'updated_cost_valid,accrued_total,cost_increase,cost_increase_pct,execution_progress,department_code,' +
  'department_name,source_updated_at';

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
    accruedTotal: toNumber(row.accrued_total),
    costIncrease: toNumber(row.cost_increase),
    costIncreasePct: toNumber(row.cost_increase_pct),
    executionProgress: toNumber(row.execution_progress),
    departmentCode: row.department_code,
    departmentName: toText(row.department_name),
    sourceUpdatedAt: toText(row.source_updated_at),
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
