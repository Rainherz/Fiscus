import { AREQUIPA_SAMPLE } from '@/features/investments/adapters/sampleData';
import { mapInvestmentRow } from '@/features/investments/domain/mappers';

/** The five sample Arequipa projects, mapped to the domain, ordered by absolute increase. */
export const arequipa = AREQUIPA_SAMPLE.map(mapInvestmentRow).sort(
  (a, b) => (b.costIncrease ?? 0) - (a.costIncrease ?? 0),
);

export const [majes, uchumayo] = arequipa;

export const NOW = new Date('2026-10-26T12:00:00Z');
