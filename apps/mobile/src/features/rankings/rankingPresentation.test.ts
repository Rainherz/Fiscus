import { mapInvestmentRow } from '../investments/domain/mappers';
import { sampleRow } from '../investments/adapters/sampleData';
import {
  RANKING_OPTIONS,
  PROJECT_TABS,
  RANKINGS_SCREEN_OPTIONS,
  RANKING_TABS,
  isProjectTab,
  isRankingTab,
  rankingDetail,
  rankingNote,
  rankingValue,
  isActiveOnlyTab,
} from './rankingPresentation';

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
  it('labels the four rankings and "Sin gasto reciente" in Spanish', () => {
    expect(RANKING_OPTIONS.map((o) => o.label)).toEqual([
      'Mayor aumento (S/)',
      'Mayor aumento (%)',
      'Mayor costo',
      'Más tiempo en curso',
      'Sin gasto reciente',
    ]);
    expect(RANKING_OPTIONS.map((o) => o.key)).toEqual(PROJECT_TABS);
  });

  it('adds "Paralizadas (Contraloría)" after "Sin gasto reciente" on the Rankings screen only', () => {
    const labels = RANKINGS_SCREEN_OPTIONS.map((o) => o.label);
    expect(labels.indexOf('Paralizadas (Contraloría)')).toBe(labels.indexOf('Sin gasto reciente') + 1);
    expect(isRankingTab('paralyzed')).toBe(true);
    expect(isProjectTab('paralyzed')).toBe(false);
    expect(rankingNote('paralyzed')).toMatch(/Contraloría/);
    // An official list, shown for every status like the other project rankings.
    expect(isActiveOnlyTab('paralyzed', 'CLOSED')).toBe(false);
  });

  it('adds "Contratistas" before "Entidades" on the Rankings screen only, for every status', () => {
    const labels = RANKINGS_SCREEN_OPTIONS.map((o) => o.label);
    expect(labels.indexOf('Contratistas')).toBe(labels.indexOf('Entidades') - 1);
    expect(isRankingTab('contractors')).toBe(true);
    expect(isProjectTab('contractors')).toBe(false);
    expect(isActiveOnlyTab('contractors', 'CLOSED')).toBe(false);
  });

  it('adds "Entidades" as the last tab of the Rankings screen only', () => {
    expect(RANKINGS_SCREEN_OPTIONS.map((o) => o.label).at(-1)).toBe('Entidades');
    expect(RANKINGS_SCREEN_OPTIONS.map((o) => o.key)).toEqual(RANKING_TABS);
    expect(isRankingTab('entities')).toBe(true);
    expect(isProjectTab('entities')).toBe(false);
    expect(isProjectTab('stalled')).toBe(true);
  });

  it('recognizes tab names from the route', () => {
    expect(isRankingTab('stalled')).toBe(true);
    expect(isRankingTab('cost')).toBe(true);
    // The region comparison moved to the region picker; old links fall back to the default tab.
    expect(isRankingTab('regions')).toBe(false);
    expect(isRankingTab('other')).toBe(false);
    expect(isRankingTab(undefined)).toBe(false);
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
    expect(rankingDetail('cost', majes)).toBe('Gastado 18 % del costo');
    expect(rankingDetail('duration', majes)).toBe('Viable desde 10/01/2008');
  });

  it('starts the detail line with the region when ranking all of Peru', () => {
    expect(rankingDetail('increase-amount', majes, { national: true })).toBe('Arequipa · S/ 1,338 M → S/ 5,148 M');
    expect(rankingDetail('duration', { ...majes, departmentCode: 8 }, { national: true })).toBe(
      'Cusco · Viable desde 10/01/2008',
    );
  });

  it('explains the filters behind some rankings', () => {
    expect(rankingNote('increase-pct')).toBe('Solo proyectos aprobados por más de S/ 1 M.');
    expect(rankingNote('duration')).toBe('Proyectos activos, contados desde su fecha de viabilidad.');
    expect(rankingNote('increase-amount')).toBeNull();
  });
});

describe('isActiveOnlyTab', () => {
  it('is the stalled and duration rankings, and entities sorted by stalled projects, only for closed projects', () => {
    expect(isActiveOnlyTab('stalled', 'CLOSED')).toBe(true);
    expect(isActiveOnlyTab('duration', 'CLOSED')).toBe(true);
    expect(isActiveOnlyTab('entities', 'CLOSED', 'stalled')).toBe(true);
    expect(isActiveOnlyTab('entities', 'CLOSED', 'increase-amount')).toBe(false);
    expect(isActiveOnlyTab('cost', 'CLOSED')).toBe(false);
    expect(isActiveOnlyTab('stalled', 'ALL')).toBe(false);
    expect(isActiveOnlyTab('duration', 'ACTIVE')).toBe(false);
  });
});
