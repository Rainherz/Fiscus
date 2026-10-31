import { isGovernmentLevel, type GovernmentLevel, type LevelFilter } from './governmentLevel';
import { matchesStatus, type StatusFilter } from './investmentStatus';

/**
 * INFOBRAS: the open dataset of obras of the Contraloría General de la República (execution status,
 * progress, contract, contractor, supervision, additional works, deductions, time extensions). The
 * file is regenerated daily but its content lags (data_as_of, the latest progress registration), so
 * its status is never presented as current; the Contraloría paralyzed report (paralyzed.ts) stays
 * the authoritative list of paralyzed works.
 *
 * Privacy: natural-person contractors and supervisors have neither name nor RUC here, only their
 * kind ('persona_natural').
 *
 * Keep in sync with supabase/migrations/20261108000000_infobras_works.sql and
 * 20261109000000_infobras_contract_amount_validity.sql (Regla de Fiscus on contract amounts).
 */

/** data_freshness.source of the INFOBRAS dataset (its data_as_of is the date the data describes). */
export const INFOBRAS_FRESHNESS_SOURCE = 'infobras_obras';

/** Obras read per CUI: the detail shows five and expands to the rest. */
export const INFOBRAS_WORKS_LIMIT = 100;

export type PartyKind = 'empresa' | 'consorcio' | 'persona_natural';

export const EXECUTION_STATUSES = ['Finalizado', 'En Ejecución', 'Sin Ejecución', 'Paralizada'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** A contractor or supervision firm. Natural persons: kind only. */
export interface Party {
  kind: PartyKind | null;
  /** RUC (20…) or OSCE consortium code (C…); null for natural persons. */
  ruc: string | null;
  name: string | null;
}

/** One obra of `infobras_works`. */
export interface InfobrasWork {
  infobrasCode: number;
  cui: string | null;
  executionStatus: ExecutionStatus | null;
  hasParalysis: boolean | null;
  paralysisCause: string | null;
  paralysisDate: string | null;
  paralysisDays: number | null;
  /** 0-100 as published. */
  physicalProgressPlanned: number | null;
  physicalProgressActual: number | null;
  /** yyyy-mm-01: month of the last progress report. */
  progressPeriod: string | null;
  contractAmount: number | null;
  /**
   * Regla de Fiscus (infobras_works.contract_amount_valid): false when the contract amount is greater
   * than 10 times the expediente técnico cost of the same obra, a typing error in the source; the
   * figure is then not shown nor summed.
   */
  contractAmountValid: boolean;
  contractor: Party;
  supervisor: Party;
  additionalWorksAmount: number | null;
  deductionsAmount: number | null;
  /** Days added by time extensions. */
  extensionDays: number | null;
  receptionDate: string | null;
  liquidationDate: string | null;
  modality: string | null;
}

/** A row of the "Contratistas" ranking (`contractor_ranking`). */
export interface ContractorRankingItem {
  ruc: string;
  name: string | null;
  kind: PartyKind | null;
  obraCount: number;
  /** Sum of the valid contract amounts only (see InfobrasWork.contractAmountValid). */
  totalContractAmount: number;
  totalAdditionalWorks: number;
  /** Obras in the latest Contraloría report of paralyzed works. */
  contraloriaParalyzedCount: number;
  /** Contract amounts left out of totalContractAmount by the Regla de Fiscus. */
  invalidContractCount: number;
}

export interface ContractorRankingPage {
  items: ContractorRankingItem[];
  /** Contractors in the scope. */
  total: number;
  /** yyyy-mm-dd: the date the INFOBRAS data describes; null before the first ingest. */
  dataAsOf: string | null;
}

export const CONTRACTOR_SORTS = ['contract', 'additional', 'paralyzed'] as const;
export type ContractorSort = (typeof CONTRACTOR_SORTS)[number];

export function isContractorSort(value: unknown): value is ContractorSort {
  return typeof value === 'string' && (CONTRACTOR_SORTS as readonly string[]).includes(value);
}

/** National totals of one contractor (`contractor_summary`). */
export interface ContractorSummary extends ContractorRankingItem {
  finishedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  /** Obras whose INFOBRAS status is "Paralizada" (as reported by the entity). */
  infobrasParalyzedCount: number;
  dataAsOf: string | null;
}

/** One obra of a contractor with its investment (`contractor_works`). */
export interface ContractorWork {
  infobrasCode: number;
  cui: string | null;
  executionStatus: ExecutionStatus | null;
  contractAmount: number | null;
  /** See InfobrasWork.contractAmountValid. */
  contractAmountValid: boolean;
  additionalWorksAmount: number | null;
  physicalProgressActual: number | null;
  /** Null when Fiscus does not have the CUI. */
  investmentName: string | null;
  entity: string | null;
  departmentCode: number | null;
  governmentLevel: GovernmentLevel | null;
  investmentStatus: string | null;
  contraloriaParalyzed: boolean;
}

type Numeric = number | string | null | undefined;
type Text = string | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const toText = (value: Text): string | null => value ?? null;
const toBoolean = (value: boolean | null | undefined): boolean | null => (typeof value === 'boolean' ? value : null);
/** contract_amount_valid: only an explicit false marks an amount as invalid. */
const toValidity = (value: boolean | null | undefined): boolean => value !== false;

export function isPartyKind(value: unknown): value is PartyKind {
  return value === 'empresa' || value === 'consorcio' || value === 'persona_natural';
}

export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return typeof value === 'string' && (EXECUTION_STATUSES as readonly string[]).includes(value);
}

/** A party as the app may show it: a natural person never keeps a name or RUC, even if one arrived. */
export function toParty(kind: Text, ruc: Text, name: Text): Party {
  const k = isPartyKind(kind) ? kind : null;
  if (k === 'persona_natural') return { kind: k, ruc: null, name: null };
  return { kind: k, ruc: toText(ruc), name: toText(name) };
}

/** Row shape of `infobras_works` (the columns the app reads). */
export interface InfobrasWorkRow {
  infobras_code: Numeric;
  cui?: Text;
  execution_status?: Text;
  has_paralysis?: boolean | null;
  paralysis_cause?: Text;
  paralysis_date?: Text;
  paralysis_days?: Numeric;
  physical_progress_planned?: Numeric;
  physical_progress_actual?: Numeric;
  progress_period?: Text;
  contract_amount?: Numeric;
  contract_amount_valid?: boolean | null;
  contractor_kind?: Text;
  contractor_ruc?: Text;
  contractor_name?: Text;
  supervisor_kind?: Text;
  supervisor_ruc?: Text;
  supervisor_name?: Text;
  additional_works_amount?: Numeric;
  deductions_amount?: Numeric;
  extension_days?: Numeric;
  reception_date?: Text;
  liquidation_date?: Text;
  modality?: Text;
}

export const INFOBRAS_WORK_COLUMNS =
  'infobras_code,cui,execution_status,has_paralysis,paralysis_cause,paralysis_date,paralysis_days,' +
  'physical_progress_planned,physical_progress_actual,progress_period,contract_amount,contract_amount_valid,contractor_kind,' +
  'contractor_ruc,contractor_name,supervisor_kind,supervisor_ruc,supervisor_name,additional_works_amount,' +
  'deductions_amount,extension_days,reception_date,liquidation_date,modality';

export function mapInfobrasWorkRow(row: InfobrasWorkRow): InfobrasWork {
  return {
    infobrasCode: toNumber(row.infobras_code) ?? 0,
    cui: toText(row.cui),
    executionStatus: isExecutionStatus(row.execution_status) ? row.execution_status : null,
    hasParalysis: toBoolean(row.has_paralysis),
    paralysisCause: toText(row.paralysis_cause),
    paralysisDate: toText(row.paralysis_date),
    paralysisDays: toNumber(row.paralysis_days),
    physicalProgressPlanned: toNumber(row.physical_progress_planned),
    physicalProgressActual: toNumber(row.physical_progress_actual),
    progressPeriod: toText(row.progress_period),
    contractAmount: toNumber(row.contract_amount),
    contractAmountValid: toValidity(row.contract_amount_valid),
    contractor: toParty(row.contractor_kind, row.contractor_ruc, row.contractor_name),
    supervisor: toParty(row.supervisor_kind, row.supervisor_ruc, row.supervisor_name),
    additionalWorksAmount: toNumber(row.additional_works_amount),
    deductionsAmount: toNumber(row.deductions_amount),
    extensionDays: toNumber(row.extension_days),
    receptionDate: toText(row.reception_date),
    liquidationDate: toText(row.liquidation_date),
    modality: toText(row.modality),
  };
}

/** Row shape of `contractor_ranking(...)`. */
export interface ContractorRankingRow {
  contractor_ruc: string;
  contractor_name: Text;
  contractor_kind: Text;
  obra_count: Numeric;
  total_contract_amount: Numeric;
  total_additional_works: Numeric;
  contraloria_paralyzed_count: Numeric;
  invalid_contract_count?: Numeric;
  total_count?: Numeric;
  data_as_of?: Text;
}

function mapRankingItem(row: ContractorRankingRow): ContractorRankingItem {
  return {
    ruc: row.contractor_ruc,
    name: toText(row.contractor_name),
    kind: isPartyKind(row.contractor_kind) ? row.contractor_kind : null,
    obraCount: toNumber(row.obra_count) ?? 0,
    totalContractAmount: toNumber(row.total_contract_amount) ?? 0,
    totalAdditionalWorks: toNumber(row.total_additional_works) ?? 0,
    contraloriaParalyzedCount: toNumber(row.contraloria_paralyzed_count) ?? 0,
    invalidContractCount: toNumber(row.invalid_contract_count) ?? 0,
  };
}

export function mapContractorRankingRows(rows: readonly ContractorRankingRow[]): ContractorRankingPage {
  return {
    items: rows.map(mapRankingItem),
    total: toNumber(rows[0]?.total_count) ?? 0,
    dataAsOf: toText(rows[0]?.data_as_of),
  };
}

/** Row shape of `contractor_summary`. */
export interface ContractorSummaryRow extends ContractorRankingRow {
  finished_count: Numeric;
  in_progress_count: Numeric;
  not_started_count: Numeric;
  infobras_paralyzed_count: Numeric;
}

export const CONTRACTOR_SUMMARY_COLUMNS =
  'contractor_ruc,contractor_name,contractor_kind,obra_count,total_contract_amount,total_additional_works,' +
  'finished_count,in_progress_count,not_started_count,infobras_paralyzed_count,contraloria_paralyzed_count,data_as_of,' +
  'invalid_contract_count';

export function mapContractorSummaryRow(row: ContractorSummaryRow): ContractorSummary {
  return {
    ...mapRankingItem(row),
    finishedCount: toNumber(row.finished_count) ?? 0,
    inProgressCount: toNumber(row.in_progress_count) ?? 0,
    notStartedCount: toNumber(row.not_started_count) ?? 0,
    infobrasParalyzedCount: toNumber(row.infobras_paralyzed_count) ?? 0,
    dataAsOf: toText(row.data_as_of),
  };
}

/** Row shape of `contractor_works`. */
export interface ContractorWorkRow {
  infobras_code: Numeric;
  cui: Text;
  execution_status: Text;
  contract_amount: Numeric;
  additional_works_amount: Numeric;
  physical_progress_actual: Numeric;
  investment_name: Text;
  entity: Text;
  department_code: Numeric;
  government_level: Text;
  investment_status: Text;
  contraloria_paralyzed: boolean | null | undefined;
  contract_amount_valid?: boolean | null;
}

export const CONTRACTOR_WORK_COLUMNS =
  'infobras_code,cui,execution_status,contract_amount,additional_works_amount,physical_progress_actual,' +
  'investment_name,entity,department_code,government_level,investment_status,contraloria_paralyzed,contract_amount_valid';

export function mapContractorWorkRow(row: ContractorWorkRow): ContractorWork {
  return {
    infobrasCode: toNumber(row.infobras_code) ?? 0,
    cui: toText(row.cui),
    executionStatus: isExecutionStatus(row.execution_status) ? row.execution_status : null,
    contractAmount: toNumber(row.contract_amount),
    contractAmountValid: toValidity(row.contract_amount_valid),
    additionalWorksAmount: toNumber(row.additional_works_amount),
    physicalProgressActual: toNumber(row.physical_progress_actual),
    investmentName: toText(row.investment_name),
    entity: toText(row.entity),
    departmentCode: toNumber(row.department_code),
    governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
    investmentStatus: toText(row.investment_status),
    contraloriaParalyzed: row.contraloria_paralyzed === true,
  };
}

/** The investment of an obra, as far as the ranking's scope needs it. */
export interface WorkScope {
  departmentCode: number | null;
  governmentLevel: GovernmentLevel | null;
  status: string | null;
}

export interface ContractorRankingParams {
  sort: ContractorSort;
  departmentCode?: number;
  level?: LevelFilter;
  status?: StatusFilter;
  page: number;
  pageSize?: number;
}

/**
 * The `contractor_ranking` function over in-memory rows (the demo adapter and tests): companies and
 * consortia with a RUC, the scope of each obra's investment (an obra without one counts only when
 * no filter is on), sorted by `sort`, then total contract amount, then RUC.
 */
export function rankContractors(
  works: readonly InfobrasWork[],
  scopeOf: (cui: string | null) => WorkScope | null,
  paralyzedCodes: ReadonlySet<number>,
  params: ContractorRankingParams,
): { items: ContractorRankingItem[]; total: number } {
  const level = params.level ?? 'ALL';
  const status = params.status ?? 'ALL';
  const filtered = level !== 'ALL' || params.departmentCode !== undefined || status !== 'ALL';
  const groups = new Map<string, ContractorRankingItem>();
  for (const work of works) {
    const { ruc, kind, name } = work.contractor;
    if (ruc === null || (kind !== 'empresa' && kind !== 'consorcio')) continue;
    const scope = scopeOf(work.cui);
    if (filtered) {
      if (scope === null) continue;
      if (level !== 'ALL' && scope.governmentLevel !== level) continue;
      if (params.departmentCode !== undefined && scope.departmentCode !== params.departmentCode) continue;
      if (status !== 'ALL' && !matchesStatus(scope.status, status)) continue;
    }
    const group = groups.get(ruc) ?? {
      ruc,
      name,
      kind,
      obraCount: 0,
      totalContractAmount: 0,
      totalAdditionalWorks: 0,
      contraloriaParalyzedCount: 0,
      invalidContractCount: 0,
    };
    group.obraCount++;
    if (work.contractAmountValid) group.totalContractAmount += work.contractAmount ?? 0;
    else group.invalidContractCount++;
    group.totalAdditionalWorks += work.additionalWorksAmount ?? 0;
    if (paralyzedCodes.has(work.infobrasCode)) group.contraloriaParalyzedCount++;
    groups.set(ruc, group);
  }
  const metric = (item: ContractorRankingItem) =>
    params.sort === 'additional'
      ? item.totalAdditionalWorks
      : params.sort === 'paralyzed'
        ? item.contraloriaParalyzedCount
        : item.totalContractAmount;
  const sorted = [...groups.values()].sort(
    (a, b) =>
      metric(b) - metric(a) ||
      b.totalContractAmount - a.totalContractAmount ||
      (a.ruc < b.ruc ? -1 : a.ruc > b.ruc ? 1 : 0),
  );
  const size = params.pageSize ?? 30;
  return { items: sorted.slice(params.page * size, (params.page + 1) * size), total: sorted.length };
}
