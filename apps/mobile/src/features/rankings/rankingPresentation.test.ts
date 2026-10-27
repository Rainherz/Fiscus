import { mapInvestmentRow } from '../investments/domain/mappers';
import { sampleRow } from '../investments/adapters/sampleData';
import { RANKING_OPTIONS, rankingDetail, rankingNote, rankingValue } from './rankingPresentation';

const majes = mapInvestmentRow(
  sampleRow({
    cui: '2088142',
    viable: 1_338_419_640,
    updated: 5_147_912_126,
    progress: 0.18,
    viabilityAt: '2008-01-10',
  }),
);
const now = new Date('2026-10-26T12:00:00Z');

describe('ranking presentation', () => {
  it('labels the four rankings in Spanish', () => {
    expect(RANKING_OPTIONS.map((o) => o.label)).toEqual([
      'Mayor aumento (S/)',
      'Mayor aumento (%)',
      'Mayor costo',
      'Más tiempo en curso',
    ]);
  });

  it('shows the ranked metric for each kind', () => {
    expect(rankingValue('increase-amount', majes, now)).toBe('+S/ 3,809 M');
    expect(rankingValue('increase-pct', majes, now)).toBe('+285%');
    expect(rankingValue('cost', majes, now)).toBe('S/ 5,148 M');
    expect(rankingValue('duration', majes, now)).toBe('18 años');
  });

  it('adds a factual detail line', () => {
    expect(rankingDetail('increase-amount', majes)).toBe('S/ 1,338 M → S/ 5,148 M');
    expect(rankingDetail('increase-pct', majes)).toBe('S/ 1,338 M → S/ 5,148 M');
    expect(rankingDetail('cost', majes)).toBe('Avance 18 %');
    expect(rankingDetail('duration', majes)).toBe('Viable desde 10/01/2008');
  });

  it('explains the filters behind some rankings', () => {
    expect(rankingNote('increase-pct')).toBe('Solo proyectos aprobados por más de S/ 1 M.');
    expect(rankingNote('duration')).toBe('Proyectos activos, contados desde su fecha de viabilidad.');
    expect(rankingNote('increase-amount')).toBeNull();
  });
});
