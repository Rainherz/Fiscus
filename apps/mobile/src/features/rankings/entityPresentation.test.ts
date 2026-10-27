import type { EntityComparison } from '@/features/investments/domain/entityComparison';

import {
  ENTITY_SORT_OPTIONS,
  entityDetail,
  entityKey,
  entityNote,
  entitySummary,
  entityValue,
  isEntitySort,
} from './entityPresentation';

const cayma: EntityComparison = {
  entity: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
  governmentLevel: 'GL',
  departmentCode: 4,
  departmentName: 'AREQUIPA',
  projectCount: 12,
  validCostCount: 10,
  totalUpdatedCost: 50_000_000,
  totalCostIncrease: 8_000_000,
  projectsWithIncrease: 3,
  increasedViableAmount: 20_000_000,
  costIncreasePct: 40,
  overspentCount: 1,
  stalledCount: 2,
  stalledPendingAmount: 7_000_000,
};

describe('entity presentation', () => {
  it('offers the sorts of the region comparison', () => {
    expect(ENTITY_SORT_OPTIONS.map((o) => o.label)).toEqual([
      'Mayor aumento (S/)',
      'Mayor aumento (%)',
      'Más obras sin gasto reciente',
      'Más gasto sobre el costo',
    ]);
    expect(isEntitySort('stalled')).toBe(true);
    expect(isEntitySort('cost')).toBe(false);
  });

  it('shows the figure of the selected sort', () => {
    expect(entityValue('increase-amount', cayma)).toBe('+S/ 8.0 M');
    expect(entityValue('increase-pct', cayma)).toBe('+40%');
    expect(entityValue('stalled', cayma)).toBe('2');
    expect(entityValue('overspent', cayma)).toBe('1');
  });

  it('adds the context in a second line, led by the region nationwide', () => {
    expect(entityDetail('increase-amount', cayma)).toBe('12 proyectos · 3 con aumento');
    expect(entityDetail('increase-amount', cayma, { national: true })).toBe('Arequipa · 12 proyectos · 3 con aumento');
    expect(entityDetail('stalled', { ...cayma, departmentCode: null }, { national: true })).toBe(
      'Varias regiones · 12 proyectos · S/ 7.0 M por ejecutar',
    );
  });

  it('describes counts with their unit for screen readers', () => {
    expect(entitySummary('stalled', cayma)).toBe('2 sin gasto reciente');
    expect(entitySummary('increase-amount', cayma)).toBe('+S/ 8.0 M');
  });

  it('explains the sort, the percentage minimum and what a region counts', () => {
    expect(entityNote('increase-amount', { national: true })).toBe(
      'Suma de los aumentos de costo de los proyectos de cada entidad. No descuenta las reducciones.',
    );
    expect(entityNote('increase-pct', { national: true })).toMatch(/más de S\/ 1 M aprobado/);
    expect(entityNote('overspent', { national: false })).toBe(
      'Proyectos cuyo gasto acumulado supera su costo actualizado. Solo cuentan los proyectos de cada entidad en esta región.',
    );
  });

  it('keys an entity by level and name', () => {
    expect(entityKey(cayma)).toBe('GL:MUNICIPALIDAD DISTRITAL DE CAYMA');
  });
});
