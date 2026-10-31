import { isGovernmentLevel, type GovernmentLevel } from './governmentLevel';

/**
 * "Obra paralizada (Contraloría)": the official quarterly list of the Contraloría General de la
 * República ("Informe de obras paralizadas en el territorio nacional", Anexo N° 01), one row per
 * obra registered in INFOBRAS. It is not a rule of Fiscus, unlike "Sin gasto reciente" (stalled.ts).
 *
 * Keep in sync with supabase/migrations/20261107000000_official_paralyzed_works.sql.
 */

/** One obra of the latest edition (`latest_paralyzed_works`). */
export interface ParalyzedWork {
  infobrasCode: number;
  cui: string | null;
  /** yyyy-mm-dd: cut-off of the edition. */
  editionCutoff: string;
  /** yyyy-mm-dd: publication on gob.pe; null when unknown. */
  publishedAt: string | null;
  obraDescription: string | null;
  causalCode: number | null;
  causalLabel: string | null;
  /** 0-100 as published. */
  physicalProgress: number | null;
  /** SALDO DE OBRA: the obra cost not yet valued, soles. */
  remainingWorkBalance: number | null;
  /** The situational report filed with the MEF (PDF); null when none. */
  mefReportUrl: string | null;
}

/** The obras of one CUI in the latest edition (`paralyzed_by_cui`). */
export interface ParalyzedSummary {
  cui: string;
  editionCutoff: string;
  publishedAt: string | null;
  obraCount: number;
  /** The causal of the obra with the largest remaining balance. */
  mainCausalLabel: string | null;
  minPhysicalProgress: number | null;
  maxPhysicalProgress: number | null;
  totalRemainingWorkBalance: number | null;
  infobrasCodes: number[];
}

/** The detail screen's block: the CUI's summary and each obra. */
export interface ParalyzedDetail {
  summary: ParalyzedSummary;
  works: ParalyzedWork[];
}

/** A row of the "Paralizadas (Contraloría)" ranking (`paralyzed_investments`). */
export interface ParalyzedInvestment extends ParalyzedSummary {
  name: string | null;
  entity: string | null;
  departmentCode: number | null;
  governmentLevel: GovernmentLevel | null;
  status: string | null;
}

/** Cut-off and publication of the latest edition. */
export interface ParalyzedEdition {
  editionCutoff: string;
  publishedAt: string | null;
}

/** The public INFOBRAS ficha of an obra (its ObraId is the CODIGO INFOBRAS of the report). */
export function infobrasUrl(infobrasCode: number): string {
  return `https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=${infobrasCode}`;
}

type Numeric = number | string | null | undefined;
type Text = string | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const toText = (value: Text): string | null => value ?? null;
const httpUrl = (value: Text): string | null => (value && /^https?:\/\//i.test(value) ? value : null);

/** Row shape of `latest_paralyzed_works` (the columns the app reads). */
export interface ParalyzedWorkRow {
  infobras_code: Numeric;
  cui?: Text;
  edition_cutoff?: Text;
  published_at?: Text;
  obra_description?: Text;
  causal_code?: Numeric;
  causal_label?: Text;
  physical_progress?: Numeric;
  remaining_work_balance?: Numeric;
  mef_report_url?: Text;
}

export const PARALYZED_WORK_COLUMNS =
  'infobras_code,cui,edition_cutoff,published_at,obra_description,causal_code,causal_label,' +
  'physical_progress,remaining_work_balance,mef_report_url';

export function mapParalyzedWorkRow(row: ParalyzedWorkRow): ParalyzedWork {
  return {
    infobrasCode: toNumber(row.infobras_code) ?? 0,
    cui: toText(row.cui),
    editionCutoff: toText(row.edition_cutoff) ?? '',
    publishedAt: toText(row.published_at),
    obraDescription: toText(row.obra_description),
    causalCode: toNumber(row.causal_code),
    causalLabel: toText(row.causal_label),
    physicalProgress: toNumber(row.physical_progress),
    remainingWorkBalance: toNumber(row.remaining_work_balance),
    mefReportUrl: httpUrl(row.mef_report_url),
  };
}

/** Row shape of `paralyzed_by_cui` (the columns the app reads). */
export interface ParalyzedSummaryRow {
  cui: string;
  edition_cutoff: Text;
  published_at: Text;
  obra_count: Numeric;
  main_causal_label: Text;
  min_physical_progress: Numeric;
  max_physical_progress: Numeric;
  total_remaining_work_balance: Numeric;
  infobras_codes: Numeric[] | null | undefined;
}

export const PARALYZED_SUMMARY_COLUMNS =
  'cui,edition_cutoff,published_at,obra_count,main_causal_label,min_physical_progress,max_physical_progress,' +
  'total_remaining_work_balance,infobras_codes';

export function mapParalyzedSummaryRow(row: ParalyzedSummaryRow): ParalyzedSummary {
  return {
    cui: row.cui,
    editionCutoff: toText(row.edition_cutoff) ?? '',
    publishedAt: toText(row.published_at),
    obraCount: toNumber(row.obra_count) ?? 0,
    mainCausalLabel: toText(row.main_causal_label),
    minPhysicalProgress: toNumber(row.min_physical_progress),
    maxPhysicalProgress: toNumber(row.max_physical_progress),
    totalRemainingWorkBalance: toNumber(row.total_remaining_work_balance),
    infobrasCodes: (row.infobras_codes ?? []).flatMap((code) => {
      const value = toNumber(code);
      return value === null ? [] : [value];
    }),
  };
}

/** Row shape of `paralyzed_investments`: a summary row plus the investment's columns. */
export interface ParalyzedInvestmentRow extends ParalyzedSummaryRow {
  name: Text;
  entity: Text;
  department_code: Numeric;
  government_level: Text;
  status: Text;
}

export const PARALYZED_INVESTMENT_COLUMNS = `${PARALYZED_SUMMARY_COLUMNS},name,entity,department_code,government_level,status`;

export function mapParalyzedInvestmentRow(row: ParalyzedInvestmentRow): ParalyzedInvestment {
  return {
    ...mapParalyzedSummaryRow(row),
    name: toText(row.name),
    entity: toText(row.entity),
    departmentCode: toNumber(row.department_code),
    governmentLevel: isGovernmentLevel(row.government_level) ? row.government_level : null,
    status: toText(row.status),
  };
}

const sumOrNull = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

/**
 * The obras of one CUI aggregated like the `paralyzed_by_cui` view (the in-memory adapter's
 * implementation): the main causal is the one of the obra with the largest remaining balance.
 */
export function summarizeParalyzedWorks(works: readonly ParalyzedWork[]): ParalyzedSummary | null {
  const cui = works[0]?.cui ?? null;
  if (cui === null) return null;
  const byBalance = [...works].sort(
    (a, b) => (b.remainingWorkBalance ?? -Infinity) - (a.remainingWorkBalance ?? -Infinity) || a.infobrasCode - b.infobrasCode,
  );
  const progress = works.flatMap((w) => (w.physicalProgress === null ? [] : [w.physicalProgress]));
  return {
    cui,
    editionCutoff: works.reduce((max, w) => (w.editionCutoff > max ? w.editionCutoff : max), ''),
    publishedAt: works.reduce<string | null>(
      (max, w) => (w.publishedAt !== null && (max === null || w.publishedAt > max) ? w.publishedAt : max),
      null,
    ),
    obraCount: works.length,
    mainCausalLabel: byBalance[0]?.causalLabel ?? null,
    minPhysicalProgress: progress.length ? Math.min(...progress) : null,
    maxPhysicalProgress: progress.length ? Math.max(...progress) : null,
    totalRemainingWorkBalance: sumOrNull(works.map((w) => w.remainingWorkBalance)),
    infobrasCodes: works.map((w) => w.infobrasCode).sort((a, b) => a - b),
  };
}
