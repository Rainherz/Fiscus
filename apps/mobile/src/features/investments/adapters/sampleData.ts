import type { InvestmentRow } from '../domain/mappers';

interface SampleInput {
  cui: string;
  name?: string;
  function?: string | null;
  viable?: number | null;
  updated?: number | null;
  /** Execution progress as a ratio (accrued / updated cost). */
  progress?: number | null;
  viabilityAt?: string | null;
  departmentCode?: number;
  status?: string;
}

/** Builds an `investments` row, deriving the generated columns the way Postgres does. */
export function sampleRow(input: SampleInput): InvestmentRow {
  const viable = input.viable ?? null;
  const updated = input.updated ?? null;
  const progress = input.progress ?? null;
  const accrued = progress !== null && updated !== null ? progress * updated : null;
  const increase = viable !== null && updated !== null ? updated - viable : null;
  return {
    cui: input.cui,
    name: input.name ?? `Proyecto ${input.cui}`,
    entity: null,
    status: input.status ?? 'ACTIVO',
    situation: null,
    function: input.function === undefined ? null : input.function,
    functional_division: null,
    functional_group: null,
    beneficiaries: null,
    registered_at: null,
    viability_at: input.viabilityAt ?? null,
    first_accrual_month: null,
    last_accrual_month: null,
    viable_amount: viable,
    updated_cost: updated,
    accrued_total: accrued,
    cost_increase: increase,
    cost_increase_pct: increase !== null && viable ? (increase / viable) * 100 : null,
    execution_progress: accrued !== null && updated ? accrued / updated : null,
    department_code: input.departmentCode ?? 4,
    department_name: 'AREQUIPA',
    source_updated_at: '2026-10-26T05:00:00Z',
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
