import { hasValidIncrease, type MapPoint, type MapPoints } from '@/features/investments/domain/mapPoints';
import { formatSignedPercent, formatSignedSoles } from '@/shared/format';

import type { MapFeature } from './mapBridge';

const oneDecimal = (value: number) => value.toFixed(1).replace(/\.0$/, '');

/** Compact counts for cluster labels: "999", "1.2 mil", "127 mil", "1.3 M". */
export function formatClusterCount(count: number): string {
  if (count < 1_000) return String(Math.round(count));
  const thousands = count / 1_000;
  if (thousands < 9.95) return `${oneDecimal(thousands)} mil`;
  if (Math.round(thousands) < 1_000) return `${Math.round(thousands)} mil`;
  const millions = count / 1_000_000;
  return `${millions < 9.95 ? oneDecimal(millions) : Math.round(millions)} M`;
}

const MIN_RADIUS = 14;
const MAX_RADIUS = 34;

/** Circle radius in px: logarithmic, so 10 and 10,000 projects stay readable side by side. */
export function clusterRadius(count: number): number {
  const radius = MIN_RADIUS + 5 * Math.log10(Math.max(count, 1));
  return Math.min(Math.round(radius), MAX_RADIUS);
}

export function toMapFeatures(result: MapPoints): MapFeature[] {
  if (result.kind === 'clusters') {
    return result.clusters.map((c, index) => ({
      kind: 'cluster',
      id: `c${index}`,
      latitude: c.latitude,
      longitude: c.longitude,
      label: formatClusterCount(c.count),
      radius: clusterRadius(c.count),
    }));
  }
  return result.points.map((p) => ({
    kind: 'point',
    id: p.cui,
    latitude: p.latitude,
    longitude: p.longitude,
    increased: hasValidIncrease(p),
  }));
}

/** The figure line of the bottom card. */
export function pointCardFigure(point: MapPoint): string {
  if (!point.updatedCostValid) return 'Costo actualizado no válido en la fuente MEF';
  if (!hasValidIncrease(point)) return 'Sin aumento de costo';
  return `${formatSignedSoles(point.costIncrease)} · ${formatSignedPercent(point.costIncreasePct)}`;
}
