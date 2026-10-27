import {
  hasInvalidUpdatedCost,
  spentOverUpdatedCost,
  type Investment,
} from '@/features/investments/domain/investment';
import { stalledStatus } from '@/features/investments/domain/stalled';
import { stalledSinceSentence } from '@/features/stalled/stalledPresentation';
import {
  formatDate,
  formatProgress,
  formatSignedPercent,
  formatSolesCompact,
  formatYear,
} from '@/shared/format';
import { MULTI_REGION_LABEL } from '@/features/department/departments';
import { sourceNameOf } from '@/shared/ui/DataFooter';
import { SPENT_ANOMALY_NOTICE, overspendSentence } from '@/shared/ui/HazardProgressBar';

/** Pixel size of the shared image: 4:5 portrait, accepted as-is by WhatsApp, Instagram and X. */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export const INVALID_COST_NOTICE = 'Costo actualizado no válido en la fuente MEF';
export const MISSING_COST_NOTICE = 'Sin costo actualizado en la fuente MEF';

/** The large element of the card: a figure from the source, or a notice when there is none. */
export type ShareCardHero =
  | { kind: 'figure'; label: string; text: string }
  | { kind: 'notice'; text: string; detail: string | null };

export interface ShareCardContent {
  brand: string;
  region: string;
  name: string;
  hero: ShareCardHero;
  /** "S/ 1,338 M aprobado en 2008", "S/ 5,148 M cuesta hoy" (the latter only when not the hero). */
  costLines: string[];
  /** Share of the updated cost spent; null when the updated cost is not usable. */
  spent: { label: string; ratio: number; notes: string[] } | null;
  footer: string;
  /** Whole card as one sentence, for the preview image. */
  accessibilityLabel: string;
}

/**
 * Longest name shown whole. At 80 px Big Shoulders a card line holds 22 to 30 characters, so this
 * stays within the 3 lines the card allows; numberOfLines still clamps as a backstop. Truncated
 * here because html2canvas (web capture) clips line-clamped text without drawing the ellipsis.
 */
const NAME_MAX_CHARS = 64;

function shortenName(name: string): string {
  if (name.length <= NAME_MAX_CHARS) return name;
  const cut = name.slice(0, NAME_MAX_CHARS - 1);
  const atWord = cut.lastIndexOf(' ') > 0 ? cut.slice(0, cut.lastIndexOf(' ')) : cut;
  return `${atWord.replace(/[\s,;:.\-–]+$/, '')}…`;
}

function heroFor(inv: Investment): ShareCardHero {
  if (hasInvalidUpdatedCost(inv)) {
    return {
      kind: 'notice',
      text: INVALID_COST_NOTICE,
      detail: `El MEF publica ${formatSolesCompact(inv.updatedCost)} como costo actualizado.`,
    };
  }
  if (inv.updatedCost === null) return { kind: 'notice', text: MISSING_COST_NOTICE, detail: null };
  if ((inv.costIncrease ?? 0) > 0 && inv.costIncreasePct !== null) {
    return { kind: 'figure', label: 'AUMENTO DEL COSTO', text: formatSignedPercent(inv.costIncreasePct) };
  }
  return { kind: 'figure', label: 'CUESTA HOY', text: formatSolesCompact(inv.updatedCost) };
}

function costLinesFor(inv: Investment, hero: ShareCardHero): string[] {
  const lines: string[] = [];
  if (inv.viableAmount !== null) {
    const year = inv.viabilityAt ? ` en ${formatYear(inv.viabilityAt)}` : '';
    lines.push(`${formatSolesCompact(inv.viableAmount)} aprobado${year}`);
  }
  const updatedIsHero = hero.kind === 'figure' && hero.label === 'CUESTA HOY';
  if (hero.kind === 'figure' && !updatedIsHero) {
    lines.push(`${formatSolesCompact(inv.updatedCost)} cuesta hoy`);
  }
  return lines;
}

function spentFor(inv: Investment, referenceMonth: string | null): ShareCardContent['spent'] {
  if (!inv.updatedCostValid || inv.executionProgress === null) return null;
  const notes: string[] = [];
  const over = spentOverUpdatedCost(inv);
  if (over !== null) notes.push(overspendSentence(over));
  if (inv.spentAnomaly) notes.push(SPENT_ANOMALY_NOTICE);
  const stalled = stalledStatus(inv, referenceMonth);
  if (stalled) notes.push(stalledSinceSentence(stalled));
  return {
    label: `GASTADO ${formatProgress(inv.executionProgress)} DEL COSTO`,
    ratio: inv.executionProgress,
    notes,
  };
}

/** Everything the share card states, derived from the same rules as the detail screen. */
export function shareCardContent(
  inv: Investment,
  options: { referenceMonth: string | null },
): ShareCardContent {
  const hero = heroFor(inv);
  const costLines = costLinesFor(inv, hero);
  const spent = spentFor(inv, options.referenceMonth);
  const footer = [
    `CUI ${inv.cui}`,
    `Fuente: ${sourceNameOf(inv.dataSource)}`,
    // source_updated_at moves only when the figures change.
    ...(inv.sourceUpdatedAt ? [`Último cambio en los datos: ${formatDate(inv.sourceUpdatedAt)}`] : []),
  ].join(' · ');
  const brand = 'FISCUS';
  const region = inv.departmentCode === null ? MULTI_REGION_LABEL.toUpperCase() : (inv.departmentName ?? 'PERÚ');
  const name = inv.name ? shortenName(inv.name) : 'Sin nombre';
  const heroSentence =
    hero.kind === 'figure' ? `${hero.label}: ${hero.text}` : [hero.text, hero.detail?.replace(/\.$/, '')].filter(Boolean).join('. ');
  const accessibilityLabel = [
    `${brand}, ${region}`,
    name,
    heroSentence,
    ...costLines,
    ...(spent ? [spent.label, ...spent.notes] : []),
  ]
    .map((part) => `${part.replace(/\.$/, '')}. `)
    .join('')
    .concat(footer);
  return { brand, region, name, hero, costLines, spent, footer, accessibilityLabel };
}

export function shareFileName(cui: string): string {
  return `fiscus-${cui}.png`;
}
