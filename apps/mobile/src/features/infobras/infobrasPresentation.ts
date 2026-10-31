import type {
  ContractorRankingItem,
  ContractorSort,
  ContractorSummary,
  ContractorWork,
  InfobrasWork,
  Party,
  PartyKind,
} from '@/features/investments/domain/infobras';
import { formatDate, formatInteger, formatMonthShort, formatSoles } from '@/shared/format';
import { INFOBRAS_DATA_SOURCE_NAME } from '@/shared/ui/DataFooter';

/**
 * Wording of the INFOBRAS data. Always dated ("Datos de INFOBRAS al …"): the file is regenerated
 * daily but its content lags, so a status is never presented as current. Natural persons are never
 * named. Factual only: no judgement about companies.
 */

export const INFOBRAS_TITLE = 'OBRAS EN INFOBRAS';
/** Obras shown before "Ver más". */
export const INFOBRAS_VISIBLE_WORKS = 5;

export const CONTRACTORS_EMPTY = 'No hay empresas ni consorcios con obras en INFOBRAS';

export function infobrasDataAsOfText(dataAsOf: string | null): string {
  return dataAsOf ? `Datos de INFOBRAS al ${formatDate(dataAsOf)}.` : 'Datos de INFOBRAS.';
}

/** "Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado." */
export function infobrasCaveat(dataAsOf: string | null): string {
  return `${infobrasDataAsOfText(dataAsOf)} El estado puede haber cambiado.`;
}

/** "RUC 20…" for a RUC, "código C…" for an OSCE consortium code. */
export function identifierText(ruc: string): string {
  return /^C/i.test(ruc) ? `código ${ruc}` : `RUC ${ruc}`;
}

/** Contractor or supervision firm; a natural person is never named. Null when nothing is registered. */
export function partyText(party: Party): string | null {
  if (party.kind === 'persona_natural') return 'Persona natural';
  if (party.name === null && party.ruc === null) return null;
  if (party.ruc === null) return party.name;
  return party.name ? `${party.name} · ${identifierText(party.ruc)}` : identifierText(party.ruc);
}

export interface InfobrasFact {
  label: string;
  value: string;
  /** The source figure is not valid (Regla de Fiscus): value is a notice, shown muted. */
  invalid?: true;
}

/** Shown instead of a contract amount above 10 times the expediente cost of the same obra. */
export const INVALID_CONTRACT_AMOUNT_TEXT = 'Monto de contrato no válido en la fuente INFOBRAS';

/** "3 montos no válidos excluidos": the contract amounts a total leaves out; null for none. */
export function invalidContractsText(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 monto no válido excluido' : `${formatInteger(count)} montos no válidos excluidos`;
}

function progressText(work: InfobrasWork): string | null {
  const { physicalProgressActual: actual, physicalProgressPlanned: planned, progressPeriod } = work;
  if (actual === null && planned === null) return null;
  const parts = [
    ...(actual === null ? [] : [`${formatInteger(actual)} % real`]),
    ...(planned === null ? [] : [`${formatInteger(planned)} % programado`]),
  ];
  return `${parts.join(' · ')}${progressPeriod ? ` (${formatMonthShort(progressPeriod)})` : ''}`;
}

function paralysisText(work: InfobrasWork): string | null {
  if (!work.hasParalysis) return null;
  const parts = [
    ...(work.paralysisDate ? [`Desde ${formatDate(work.paralysisDate)}`] : []),
    ...(work.paralysisDays ? [`${formatInteger(work.paralysisDays)} ${work.paralysisDays === 1 ? 'día' : 'días'}`] : []),
    ...(work.paralysisCause ? [work.paralysisCause] : []),
  ];
  return parts.length ? parts.join(' · ') : 'Sí';
}

/** The registered facts of one obra, in reading order; unregistered ones are left out. */
export function infobrasObraFacts(work: InfobrasWork): InfobrasFact[] {
  const facts: InfobrasFact[] = [];
  const add = (label: string, value: string | null) => {
    if (value) facts.push({ label, value });
  };
  add('Estado de ejecución', work.executionStatus);
  add('Avance físico', progressText(work));
  add('Contratista', partyText(work.contractor));
  if (work.contractAmount !== null && !work.contractAmountValid) {
    facts.push({ label: 'Monto de contrato', value: INVALID_CONTRACT_AMOUNT_TEXT, invalid: true });
  } else {
    add('Monto de contrato', work.contractAmount === null ? null : formatSoles(work.contractAmount));
  }
  add('Supervisión', partyText(work.supervisor));
  add('Adicionales de obra', work.additionalWorksAmount === null ? null : formatSoles(work.additionalWorksAmount));
  add('Deductivos', work.deductionsAmount === null ? null : formatSoles(work.deductionsAmount));
  add(
    'Ampliaciones de plazo',
    work.extensionDays === null ? null : `${formatInteger(work.extensionDays)} ${work.extensionDays === 1 ? 'día' : 'días'}`,
  );
  add('Paralización informada', paralysisText(work));
  add('Recepción', work.receptionDate ? formatDate(work.receptionDate) : null);
  add('Liquidación', work.liquidationDate ? formatDate(work.liquidationDate) : null);
  add('Modalidad', work.modality);
  return facts;
}

/** The first five obras until "Ver más" is pressed. */
export function visibleInfobrasWorks<T>(works: readonly T[], expanded: boolean): { shown: T[]; hidden: number } {
  if (expanded || works.length <= INFOBRAS_VISIBLE_WORKS) return { shown: [...works], hidden: 0 };
  return { shown: works.slice(0, INFOBRAS_VISIBLE_WORKS), hidden: works.length - INFOBRAS_VISIBLE_WORKS };
}

export function contractorKindLabel(kind: PartyKind | null): string {
  if (kind === 'empresa') return 'Empresa';
  if (kind === 'consorcio') return 'Consorcio';
  return 'Contratista';
}

export const CONTRACTOR_SORT_OPTIONS: readonly { key: ContractorSort; label: string }[] = [
  { key: 'contract', label: 'Monto contratado' },
  { key: 'additional', label: 'Adicionales' },
  { key: 'paralyzed', label: 'Obras paralizadas' },
];

/** The figure a contractor is ranked by. */
export function contractorSortValue(sort: ContractorSort, item: ContractorRankingItem): string {
  switch (sort) {
    case 'contract':
      return formatSoles(item.totalContractAmount);
    case 'additional':
      return formatSoles(item.totalAdditionalWorks);
    case 'paralyzed':
      return formatInteger(item.contraloriaParalyzedCount);
  }
}

const obras = (count: number) => `${formatInteger(count)} ${count === 1 ? 'obra' : 'obras'}`;

/**
 * "Empresa · RUC … · 12 obras · S/ 2.5 M en adicionales · 1 paralizada (Contraloría) · 2 montos no
 * válidos excluidos".
 */
export function contractorRowDetail(item: ContractorRankingItem): string {
  const excluded = invalidContractsText(item.invalidContractCount);
  return [
    contractorKindLabel(item.kind),
    identifierText(item.ruc),
    obras(item.obraCount),
    ...(item.totalAdditionalWorks > 0 ? [`${formatSoles(item.totalAdditionalWorks)} en adicionales`] : []),
    ...(item.contraloriaParalyzedCount > 0
      ? [`${formatInteger(item.contraloriaParalyzedCount)} ${item.contraloriaParalyzedCount === 1 ? 'paralizada' : 'paralizadas'} (Contraloría)`]
      : []),
    ...(excluded ? [excluded] : []),
  ].join(' · ');
}

/** The note under the "Contratistas" tabs. */
export function contractorsNote(dataAsOf: string | null): string {
  return (
    'Empresas y consorcios con obras registradas en INFOBRAS; no incluye personas naturales. ' +
    'La región, el nivel y el estado son los del proyecto de cada obra. ' +
    `Los montos de contrato no válidos en la fuente no se suman. ${infobrasDataAsOfText(dataAsOf)}`
  );
}

const counted = (count: number, one: string, many: string) => `${formatInteger(count)} ${count === 1 ? one : many}`;

/** "Según INFOBRAS: 1 finalizada · 1 en ejecución · 1 paralizada"; statuses without obras are left out. */
export function contractorStatusLine(summary: ContractorSummary): string | null {
  const parts = [
    ...(summary.finishedCount ? [counted(summary.finishedCount, 'finalizada', 'finalizadas')] : []),
    ...(summary.inProgressCount ? [`${formatInteger(summary.inProgressCount)} en ejecución`] : []),
    ...(summary.notStartedCount ? [`${formatInteger(summary.notStartedCount)} sin ejecución`] : []),
    ...(summary.infobrasParalyzedCount ? [counted(summary.infobrasParalyzedCount, 'paralizada', 'paralizadas')] : []),
  ];
  return parts.length ? `Según INFOBRAS: ${parts.join(' · ')}` : null;
}

/** Name and two factual lines of one obra on the contractor page. */
export function contractorWorkRow(work: ContractorWork): { name: string; detail: [string, string] } {
  const known = work.cui !== null && work.investmentName !== null;
  const where = known
    ? `CUI ${work.cui}${work.entity ? ` · ${work.entity}` : ''}`
    : `Sin CUI en Fiscus${work.cui ? ` (CUI ${work.cui})` : ''} · ver ficha en INFOBRAS`;
  const facts = [
    work.executionStatus ?? 'Estado no informado',
    ...(work.contractAmount === null
      ? []
      : work.contractAmountValid
        ? [`contrato ${formatSoles(work.contractAmount)}`]
        : ['monto de contrato no válido en la fuente INFOBRAS']),
    ...(work.contraloriaParalyzed ? ['en el informe de obras paralizadas'] : []),
  ];
  return { name: known ? work.investmentName! : `Obra ${work.infobrasCode} en INFOBRAS`, detail: [where, facts.join(' · ')] };
}

/** The footer's source line for INFOBRAS. */
export function infobrasSourceName(dataAsOf: string | null): string {
  return dataAsOf ? `${INFOBRAS_DATA_SOURCE_NAME} (datos al ${formatDate(dataAsOf)})` : INFOBRAS_DATA_SOURCE_NAME;
}
