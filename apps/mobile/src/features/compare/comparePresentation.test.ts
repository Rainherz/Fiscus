import { regionRow } from '@/test/regionComparison';

import { compareSections, mirroredBarRatios, shareOf } from './comparePresentation';

const arequipa = regionRow(4, {
  projectCount: 1638,
  activeCount: 1500,
  validCostCount: 1600,
  totalUpdatedCost: 20_000_000_000,
  totalCostIncrease: 3_809_492_486,
  costIncreasePct: 42.4,
  projectsWithIncrease: 412,
  overspentCount: 32,
  stalledCount: 12,
  stalledPendingAmount: 750_000_000,
});
const cusco = regionRow(8, {
  projectCount: 900,
  activeCount: 800,
  validCostCount: 0,
  totalUpdatedCost: null,
  totalCostIncrease: 1_200_000_000,
  costIncreasePct: null,
  projectsWithIncrease: 30,
  overspentCount: 0,
  stalledCount: 40,
  stalledPendingAmount: 0,
});

describe('shareOf', () => {
  it('is a 0-100 share, null without a base', () => {
    expect(shareOf(412, 1600)).toBeCloseTo(25.75);
    expect(shareOf(0, 1600)).toBe(0);
    expect(shareOf(30, 0)).toBeNull();
  });
});

describe('mirroredBarRatios', () => {
  it('scales both bars to the larger of the two', () => {
    expect(mirroredBarRatios(200, 50)).toEqual({ a: 1, b: 0.25 });
    expect(mirroredBarRatios(50, 200)).toEqual({ a: 0.25, b: 1 });
    expect(mirroredBarRatios(7, 7)).toEqual({ a: 1, b: 1 });
  });

  it('draws no bar for zero, missing or negative values', () => {
    expect(mirroredBarRatios(0, 0)).toEqual({ a: 0, b: 0 });
    expect(mirroredBarRatios(null, 10)).toEqual({ a: 0, b: 1 });
    expect(mirroredBarRatios(null, null)).toEqual({ a: 0, b: 0 });
    expect(mirroredBarRatios(-5, 10)).toEqual({ a: 0, b: 1 });
  });
});

describe('compareSections', () => {
  const sections = compareSections(arequipa, cusco);
  const row = (label: string) => {
    const found = sections.flatMap((s) => s.rows).find((r) => r.label === label);
    if (!found) throw new Error(`no row ${label}`);
    return found;
  };

  it('groups the metrics in three sections, in order', () => {
    expect(sections.map((s) => s.title)).toEqual(['TAMAÑO', 'AUMENTOS', 'EJECUCIÓN']);
    expect(sections.map((s) => s.rows.map((r) => r.label))).toEqual([
      ['Proyectos', 'Proyectos activos', 'Costo actualizado total'],
      [
        'Aumento total (S/)',
        'Aumento sobre lo aprobado (%)',
        'Proyectos con aumento',
        '% de proyectos con aumento',
      ],
      [
        'Gastaron más que su costo',
        '% que gastó más que su costo',
        'Sin gasto reciente',
        'S/ por ejecutar en obras sin gasto reciente',
      ],
    ]);
  });

  it('prints both values of every metric', () => {
    expect(row('Proyectos')).toMatchObject({ a: { value: 1638, text: '1,638' }, b: { value: 900, text: '900' } });
    expect(row('Costo actualizado total')).toMatchObject({
      a: { value: 20_000_000_000, text: 'S/ 20,000 M' },
      b: { value: null, text: '—' },
    });
    expect(row('Aumento total (S/)').a.text).toBe('+S/ 3,809 M');
    expect(row('Aumento sobre lo aprobado (%)')).toMatchObject({ a: { text: '+42%' }, b: { value: null, text: '—' } });
    expect(row('Sin gasto reciente')).toMatchObject({ a: { text: '12' }, b: { text: '40' } });
    expect(row('S/ por ejecutar en obras sin gasto reciente')).toMatchObject({
      a: { text: 'S/ 750 M' },
      b: { text: 'S/ 0' },
    });
  });

  it('derives shares over the projects with a valid cost, null-safe', () => {
    expect(row('% de proyectos con aumento')).toMatchObject({
      a: { value: 25.75, text: '26%' },
      b: { value: null, text: '—' },
    });
    expect(row('% que gastó más que su costo')).toMatchObject({ a: { value: 2, text: '2%' } });
    expect(compareSections(regionRow(1, { overspentCount: 1, validCostCount: 400 }), cusco)[2].rows[1].a.text).toBe(
      '<1%',
    );
  });

  it('leaves every value empty for a region without data', () => {
    const empty = compareSections(arequipa, null);
    for (const r of empty.flatMap((s) => s.rows)) expect(r.b).toEqual({ value: null, text: '—' });
  });
});
