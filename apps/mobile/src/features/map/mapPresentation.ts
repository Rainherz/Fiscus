import { hasValidIncrease, type MapListItem, type MapPoint, type MapPoints } from '@/features/investments/domain/mapPoints';
import {
  formatInteger,
  formatMonthShort,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
} from '@/shared/format';

import type { MapFeature } from './mapBridge';

const INVALID_COST = 'Costo actualizado no válido en la fuente MEF';
const NO_INCREASE = 'Sin aumento';

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

const toPointFeature = (p: MapPoint): MapFeature => ({
  kind: 'point',
  id: p.cui,
  latitude: p.latitude,
  longitude: p.longitude,
  increased: hasValidIncrease(p),
});

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
  return result.points.map(toPointFeature);
}

/**
 * The features with the selected project drawn too: a project picked from the list may be inside
 * a cluster or outside what the map last loaded, and its highlight must still show.
 */
export function withSelected(features: MapFeature[], selected: MapPoint | null): MapFeature[] {
  if (!selected || features.some((f) => f.kind === 'point' && f.id === selected.cui)) return features;
  return [...features, toPointFeature(selected)];
}

/** The figure line of the bottom card. */
export function pointCardFigure(point: MapPoint): string {
  if (!point.updatedCostValid) return INVALID_COST;
  if (!hasValidIncrease(point)) return NO_INCREASE;
  return `${formatSignedSoles(point.costIncrease)} · ${formatSignedPercent(point.costIncreasePct)}`;
}

/** The figure lines of the card under its name, once the project's figures are known. */
export function pointCardFacts(item: MapListItem): string[] {
  const facts: string[] = [];
  if (item.updatedCostValid) {
    facts.push(`COSTO ACTUAL ${formatSoles(item.updatedCost)}`);
    facts.push(`GASTADO ${formatProgress(item.executionProgress)} DEL COSTO`);
  }
  if (item.physicalProgress !== null) facts.push(`AVANCE FÍSICO ${formatProgress(item.physicalProgress / 100)}`);
  if (item.stalled) facts.push(`Sin gasto desde ${formatMonthShort(item.lastAccrualMonth)}`);
  return facts;
}

/** "128 proyectos en esta zona": the head of the list and of the collapsed sheet. */
export function mapListCountText(total: number): string {
  return `${formatInteger(total)} ${total === 1 ? 'proyecto' : 'proyectos'} en esta zona`;
}

/** A row of the list: the increase as the value; entity and current cost below. */
export function mapListRow(item: MapListItem): { value: string; detail: string[]; summary: string } {
  const cost = formatSoles(item.updatedCost);
  const entity = item.entity ? [item.entity] : [];
  if (!item.updatedCostValid) {
    return { value: '—', detail: [...entity, INVALID_COST], summary: INVALID_COST };
  }
  if (!hasValidIncrease(item)) {
    return {
      value: NO_INCREASE,
      detail: [...entity, `Costo ${cost}`],
      summary: `sin aumento, costo actual ${cost}`,
    };
  }
  const amount = formatSignedSoles(item.costIncrease);
  const pct = formatSignedPercent(item.costIncreasePct);
  return {
    value: amount,
    detail: [...entity, `${pct} · costo ${cost}`],
    summary: `aumento ${amount}, ${pct}, costo actual ${cost}`,
  };
}
