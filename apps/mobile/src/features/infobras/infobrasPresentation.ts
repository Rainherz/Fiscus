import type {
  ContractorRankingItem,
  ContractorSort,
  ContractorSummary,
  ContractorWork,
  InfobrasWork,
  Party,
  PartyKind,
} from '@/features/investments/domain/infobras';
import type { TermId } from '@/features/glossary/terms';
import { paralyzedProgressText } from '@/features/paralyzed/paralyzedPresentation';
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

/** Shown instead of a contract amount above 10 times the expediente cost of the same obra. */
export const INVALID_CONTRACT_AMOUNT_TEXT = 'Monto de contrato no válido en la fuente INFOBRAS';
/** The same notice within a sentence. */
const INVALID_CONTRACT_AMOUNT_INLINE = 'monto de contrato no válido en la fuente INFOBRAS';

/** "3 montos no válidos excluidos": the contract amounts a total leaves out; null for none. */
export function invalidContractsText(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 monto no válido excluido' : `${formatInteger(count)} montos no válidos excluidos`;
}

/** A fact of a line; `term` is the glossary term it names. */
interface InfobrasLinePart {
  text: string;
  term?: TermId;
}

/** A line of an obra row: its facts joined by " · ", and the glossary terms they use. */
export interface InfobrasObraLine {
  text: string;
  terms: TermId[];
}

export interface InfobrasObraRow {
  infobrasCode: number;
  summary: string;
  lines: InfobrasObraLine[];
}

export const INFOBRAS_ATTRIBUTION = 'Fuente: Contraloría General de la República – INFOBRAS.';

const days = (count: number) => `${formatInteger(count)} ${count === 1 ? 'día' : 'días'}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The line of these facts, the first one capitalized; null for none. */
function toLine(facts: InfobrasLinePart[]): InfobrasObraLine | null {
  if (!facts.length) return null;
  const parts = facts.map((part, i) => (i === 0 ? { ...part, text: capitalize(part.text) } : part));
  return {
    text: parts.map((part) => part.text).join(' · '),
    terms: parts.flatMap((part) => (part.term ? [part.term] : [])),
  };
}

/** A party within a sentence: "NAME (código C…)", "persona natural"; null when nothing is registered. */
function partyInline(party: Party): string | null {
  if (party.kind === 'persona_natural') return 'persona natural';
  if (party.ruc === null) return party.name;
  return party.name ? `${party.name} (${identifierText(party.ruc)})` : identifierText(party.ruc);
}

/** "Obra 171686 · Finalizado · avance 52 % (prog. 100 %, jun 2024)". */
export function infobrasObraSummary(work: InfobrasWork): string {
  const { physicalProgressActual: actual, physicalProgressPlanned: planned, progressPeriod } = work;
  const parts = [`Obra ${work.infobrasCode}`, work.executionStatus ?? 'Estado no informado'];
  if (actual !== null || planned !== null) {
    const context = [
      ...(planned === null ? [] : [`prog. ${formatInteger(planned)} %`]),
      ...(progressPeriod ? [formatMonthShort(progressPeriod)] : []),
    ];
    const real = actual === null ? '—' : `${formatInteger(actual)} %`;
    parts.push(`avance ${real}${context.length ? ` (${context.join(', ')})` : ''}`);
  }
  return parts.join(' · ');
}

/** Contractor, contract amount (or its invalid notice), additional works and deductions; null when none is registered. */
export function infobrasContractLine(work: InfobrasWork): InfobrasObraLine | null {
  const contractor = partyInline(work.contractor);
  const invalid = work.contractAmount !== null && !work.contractAmountValid;
  const parts: InfobrasLinePart[] = [];
  if (contractor) parts.push({ text: `Contratista: ${contractor}`, term: 'contratista' });
  if (invalid) {
    parts.push({ text: INVALID_CONTRACT_AMOUNT_INLINE, term: 'monto-contrato-no-valido' });
  } else if (work.contractAmount !== null) {
    parts.push({ text: formatSoles(work.contractAmount) });
  }
  if (work.additionalWorksAmount !== null) {
    parts.push({ text: `adicionales ${formatSoles(work.additionalWorksAmount)}`, term: 'adicional-de-obra' });
  }
  if (work.deductionsAmount !== null) {
    parts.push({ text: `deductivos ${formatSoles(work.deductionsAmount)}`, term: 'deductivo' });
  }
  if (parts.length && !contractor && !invalid) parts.unshift({ text: 'Contratista no registrado' });
  return toLine(parts);
}

/** Supervision, paralysis reported in INFOBRAS, extensions, dates and an uncommon modality; null when none. */
export function infobrasDetailLine(work: InfobrasWork): InfobrasObraLine | null {
  const parts: InfobrasLinePart[] = [];
  const supervisor = partyInline(work.supervisor);
  if (supervisor) parts.push({ text: `Supervisión: ${supervisor}`, term: 'supervision' });
  if (work.hasParalysis) {
    const since = work.paralysisDate ? ` desde ${formatDate(work.paralysisDate)}` : '';
    parts.push({ text: `paralización informada${since}` });
    if (work.paralysisDays) parts.push({ text: days(work.paralysisDays) });
    if (work.paralysisCause) parts.push({ text: work.paralysisCause });
  }
  if (work.extensionDays !== null) {
    parts.push({ text: `ampliaciones de plazo ${days(work.extensionDays)}`, term: 'ampliacion-de-plazo' });
  }
  if (work.receptionDate) parts.push({ text: `recepción ${formatDate(work.receptionDate)}` });
  if (work.liquidationDate) parts.push({ text: `liquidación ${formatDate(work.liquidationDate)}` });
  if (work.modality && work.modality.trim().toLowerCase() !== 'contrata') parts.push({ text: `modalidad ${work.modality}` });
  return toLine(parts);
}

/** One compact row per obra, all with the same structure: plain lines, no hint inside them. */
export function infobrasObraRows(works: readonly InfobrasWork[]): InfobrasObraRow[] {
  return works.map((work) => ({
    infobrasCode: work.infobrasCode,
    summary: infobrasObraSummary(work),
    lines: [infobrasContractLine(work), infobrasDetailLine(work)].filter((line): line is InfobrasObraLine => line !== null),
  }));
}

/** The glossary terms these rows use, once each and in the order they first appear: the panel's legend. */
export function infobrasTerms(rows: readonly InfobrasObraRow[]): TermId[] {
  return [...new Set(rows.flatMap((row) => row.lines.flatMap((line) => line.terms)))];
}

/** Key figures: obras, sum of the valid contract amounts and the range of real physical progress. */
export function infobrasFigures(works: readonly InfobrasWork[]): { label: string; value: string }[] {
  const amounts = works.filter((w) => w.contractAmount !== null && w.contractAmountValid).map((w) => w.contractAmount!);
  const progress = works.map((w) => w.physicalProgressActual).filter((p): p is number => p !== null);
  return [
    { label: 'Obras', value: formatInteger(works.length) },
    { label: 'Monto contratado', value: amounts.length ? formatSoles(amounts.reduce((a, b) => a + b, 0)) : formatSoles(null) },
    {
      label: 'Avance físico real',
      value: paralyzedProgressText({
        minPhysicalProgress: progress.length ? Math.min(...progress) : null,
        maxPhysicalProgress: progress.length ? Math.max(...progress) : null,
      }),
    },
  ];
}

/** Footer: the invalid amounts the total leaves out, the date of the data and the source. */
export function infobrasFooter(works: readonly InfobrasWork[], dataAsOf: string | null): string[] {
  const excluded = invalidContractsText(works.filter((w) => w.contractAmount !== null && !w.contractAmountValid).length);
  return [...(excluded ? [`Monto contratado: ${excluded}.`] : []), infobrasCaveat(dataAsOf), INFOBRAS_ATTRIBUTION];
}

export function infobrasMoreLabel(hidden: number): string {
  return `Ver ${formatInteger(hidden)} ${hidden === 1 ? 'obra' : 'obras'} más`;
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
        : [INVALID_CONTRACT_AMOUNT_INLINE]),
    ...(work.contraloriaParalyzed ? ['en el informe de obras paralizadas'] : []),
  ];
  return { name: known ? work.investmentName! : `Obra ${work.infobrasCode} en INFOBRAS`, detail: [where, facts.join(' · ')] };
}

/** The footer's source line for INFOBRAS. */
export function infobrasSourceName(dataAsOf: string | null): string {
  return dataAsOf ? `${INFOBRAS_DATA_SOURCE_NAME} (datos al ${formatDate(dataAsOf)})` : INFOBRAS_DATA_SOURCE_NAME;
}
