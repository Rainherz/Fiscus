import type { TermId } from '@/features/glossary/terms';
import { formatInteger, formatSignedPercent, formatSignedSoles, formatSoles } from '@/shared/format';

import type { RegionComparison } from '../investments/domain/regionComparison';

const DASH = '—';

/** One side of a metric: the raw figure (for the bar) and its printed form. */
export interface MetricValue {
  value: number | null;
  text: string;
}

export interface MetricRow {
  key: string;
  label: string;
  /** Glossary term explained by a hint next to the label. */
  term?: TermId;
  a: MetricValue;
  b: MetricValue;
}

export interface MetricSection {
  title: string;
  /** A factual line under the title, when the section needs one. */
  note?: string;
  rows: MetricRow[];
}

/** `part` over `base` on a 0-100 scale; null without a base. */
export function shareOf(part: number, base: number): number | null {
  return base > 0 ? (part / base) * 100 : null;
}

function formatShare(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  if (value > 0 && value < 0.5) return '<1%';
  return `${formatInteger(value)}%`;
}

interface MetricSpec {
  key: string;
  label: string;
  term?: TermId;
  pick: (region: RegionComparison) => number | null;
  format: (value: number | null) => string;
}

const SECTIONS: { title: string; note?: string; metrics: MetricSpec[] }[] = [
  {
    title: 'TAMAÑO',
    metrics: [
      { key: 'projects', label: 'Proyectos', pick: (r) => r.projectCount, format: formatInteger },
      { key: 'active', label: 'Proyectos activos', term: 'estado', pick: (r) => r.activeCount, format: formatInteger },
      { key: 'updated-cost', label: 'Costo actualizado total', term: 'costo-actualizado', pick: (r) => r.totalUpdatedCost, format: formatSoles },
    ],
  },
  {
    title: 'AUMENTOS',
    note: 'Los porcentajes de proyectos se calculan sobre los que tienen un costo actualizado válido.',
    metrics: [
      { key: 'increase', label: 'Aumento total (S/)', term: 'aumento', pick: (r) => r.totalCostIncrease, format: formatSignedSoles },
      {
        key: 'increase-pct',
        label: 'Aumento sobre lo aprobado (%)',
        pick: (r) => r.costIncreasePct,
        format: formatSignedPercent,
      },
      { key: 'with-increase', label: 'Proyectos con aumento', pick: (r) => r.projectsWithIncrease, format: formatInteger },
      {
        key: 'with-increase-share',
        label: '% de proyectos con aumento',
        pick: (r) => shareOf(r.projectsWithIncrease, r.validCostCount),
        format: formatShare,
      },
    ],
  },
  {
    title: 'EJECUCIÓN',
    metrics: [
      { key: 'overspent', label: 'Gastaron más que su costo', term: 'gastado', pick: (r) => r.overspentCount, format: formatInteger },
      {
        key: 'overspent-share',
        label: '% que gastó más que su costo',
        pick: (r) => shareOf(r.overspentCount, r.validCostCount),
        format: formatShare,
      },
      { key: 'stalled', label: 'Sin gasto reciente', term: 'sin-gasto-reciente', pick: (r) => r.stalledCount, format: formatInteger },
      {
        key: 'stalled-pending',
        label: 'S/ por ejecutar en obras sin gasto reciente',
        pick: (r) => r.stalledPendingAmount,
        format: formatSoles,
      },
    ],
  },
];

function valueOf(spec: MetricSpec, region: RegionComparison | null): MetricValue {
  if (!region) return { value: null, text: DASH };
  const value = spec.pick(region);
  return { value, text: spec.format(value) };
}

/** The comparison table; a region without a `region_comparison` row (null) shows empty values. */
export function compareSections(a: RegionComparison | null, b: RegionComparison | null): MetricSection[] {
  return SECTIONS.map(({ title, note, metrics }) => ({
    title,
    ...(note ? { note } : {}),
    rows: metrics.map((spec) => ({
      key: spec.key,
      label: spec.label,
      ...(spec.term ? { term: spec.term } : {}),
      a: valueOf(spec, a),
      b: valueOf(spec, b),
    })),
  }));
}

const positive = (value: number | null) => (value !== null && Number.isFinite(value) && value > 0 ? value : 0);

/** Bar lengths (0-1) of a mirrored pair: the larger value fills its half, the other is proportional. */
export function mirroredBarRatios(a: number | null, b: number | null): { a: number; b: number } {
  const x = positive(a);
  const y = positive(b);
  const max = Math.max(x, y);
  return max === 0 ? { a: 0, b: 0 } : { a: x / max, b: y / max };
}
