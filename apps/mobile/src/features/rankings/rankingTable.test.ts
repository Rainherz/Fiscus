import { mapInvestmentRow } from '@/features/investments/domain/mappers';
import { sampleRow } from '@/features/investments/adapters/sampleData';
import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import type { ParalyzedInvestment } from '@/features/investments/domain/paralyzed';
import { toStalledInvestment } from '@/features/investments/domain/stalled';
import { NOW, majes } from '@/test/fixtures';

import { rankingTable } from './rankingTable';

const labels = (table: ReturnType<typeof rankingTable>) => table.columns.map((column) => column.label);
const sortedLabel = (table: ReturnType<typeof rankingTable>) =>
  table.columns.filter((column) => column.sorted).map((column) => column.label);

const withEntity = { ...majes, entity: 'GOBIERNO REGIONAL AREQUIPA' };

describe('rankingTable: project rankings', () => {
  it('lists approved, current cost, increase and percentage, the ranked one marked', () => {
    const table = rankingTable({ kind: 'increase-amount', items: [withEntity] }, NOW);
    expect(labels(table)).toEqual(['Aprobado', 'Costo actual', 'Aumento S/', '%']);
    expect(sortedLabel(table)).toEqual(['Aumento S/']);
    expect(table.rows[0]).toMatchObject({
      key: '2088142',
      name: 'Majes Siguas II etapa',
      sub: 'GOBIERNO REGIONAL AREQUIPA',
      region: 'Arequipa',
      tag: { text: 'GR', label: 'Gobierno regional' },
      cells: ['S/ 1,338 M', 'S/ 5,148 M', '+S/ 3,809 M', '+285%'],
      target: { kind: 'investment', cui: '2088142' },
    });
  });

  it('marks the column each tab ranks by', () => {
    expect(sortedLabel(rankingTable({ kind: 'increase-pct', items: [majes] }, NOW))).toEqual(['%']);
    expect(sortedLabel(rankingTable({ kind: 'cost', items: [majes] }, NOW))).toEqual(['Costo actual']);
  });

  it('adds the spent share to the cost ranking and the time running to the duration ranking', () => {
    const cost = rankingTable({ kind: 'cost', items: [majes] }, NOW);
    expect(labels(cost)).toEqual(['Aprobado', 'Costo actual', 'Gastado', 'Aumento S/', '%']);
    expect(cost.rows[0].cells[2]).toBe('18 %');
    const duration = rankingTable({ kind: 'duration', items: [majes] }, NOW);
    expect(labels(duration)).toEqual(['Aprobado', 'Costo actual', 'Aumento S/', '%', 'En curso']);
    expect(sortedLabel(duration)).toEqual(['En curso']);
    expect(duration.rows[0].cells[4]).toBe('18 años');
  });

  it('keeps fewer columns in the compact (tablet) version, the ranked one always included', () => {
    expect(labels(rankingTable({ kind: 'increase-amount', items: [majes] }, NOW, { compact: true }))).toEqual([
      'Costo actual',
      'Aumento S/',
      '%',
    ]);
    expect(labels(rankingTable({ kind: 'duration', items: [majes] }, NOW, { compact: true }))).toEqual([
      'Costo actual',
      'Aumento S/',
      'En curso',
    ]);
  });

  it('leaves the region out of what is announced within one region', () => {
    const table = rankingTable({ kind: 'increase-pct', items: [majes] }, NOW);
    expect(table.rows[0].summary).toBe('Aprobado S/ 1,338 M, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M, % +285%');
  });

  it('announces every figure with its column name', () => {
    const table = rankingTable({ kind: 'increase-amount', items: [majes] }, NOW, { national: true });
    expect(table.rows[0].summary).toBe(
      'Arequipa, Aprobado S/ 1,338 M, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M, % +285%',
    );
  });
});

describe('rankingTable: stalled', () => {
  const stalled = toStalledInvestment(
    mapInvestmentRow(
      sampleRow({ cui: '1', name: 'Hospital regional', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
    ),
    '2026-10-01',
  )!;

  it('shows since when nothing was spent, the spent share and what is left', () => {
    const table = rankingTable({ kind: 'stalled', items: [stalled] }, NOW);
    expect(labels(table)).toEqual(['Sin gasto desde', 'Gastado', 'Por ejecutar', 'Costo actual']);
    expect(table.rows[0].cells).toEqual(['abr 2025', '32 %', 'S/ 202 M', 'S/ 297 M']);
    expect(labels(rankingTable({ kind: 'stalled', items: [stalled] }, NOW, { compact: true }))).toEqual([
      'Sin gasto desde',
      'Gastado',
      'Por ejecutar',
    ]);
  });
});

describe('rankingTable: paralyzed (Contraloría)', () => {
  const item: ParalyzedInvestment = {
    cui: '2151761',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraCount: 2,
    mainCausalLabel: 'INCUMPLIMIENTO DE CONTRATO',
    minPhysicalProgress: 31,
    maxPhysicalProgress: 60,
    totalRemainingWorkBalance: 2_000_000,
    infobrasCodes: [45282, 45283],
    name: 'Agua Muñapata',
    entity: 'MUNICIPALIDAD PROVINCIAL DE QUISPICANCHI',
    departmentCode: 8,
    governmentLevel: 'GL',
    status: 'ACTIVO',
  };

  it('shows the causal, the physical progress, the remaining balance (ranked) and the obras', () => {
    const table = rankingTable({ kind: 'paralyzed', items: [item] }, NOW);
    expect(labels(table)).toEqual(['Causal', 'Avance físico', 'Saldo de obra', 'Obras']);
    expect(sortedLabel(table)).toEqual(['Saldo de obra']);
    expect(table.columns[0]).toMatchObject({ term: 'obra-paralizada', text: true });
    expect(table.columns[1]).not.toHaveProperty('text');
    expect(table.rows[0]).toMatchObject({
      key: '2151761',
      name: 'Agua Muñapata',
      sub: 'MUNICIPALIDAD PROVINCIAL DE QUISPICANCHI',
      region: 'Cusco',
      cells: ['Incumplimiento de contrato', '31–60 %', 'S/ 2.0 M', '2'],
      target: { kind: 'investment', cui: '2151761' },
    });
    expect(labels(rankingTable({ kind: 'paralyzed', items: [item] }, NOW, { compact: true }))).toEqual([
      'Causal',
      'Avance físico',
      'Saldo de obra',
    ]);
  });
});

describe('rankingTable: entities', () => {
  const entity: EntityComparison = {
    entity: 'MUNICIPALIDAD PROVINCIAL DE AREQUIPA',
    governmentLevel: 'GL',
    departmentCode: null,
    departmentName: null,
    projectCount: 12,
    validCostCount: 12,
    totalUpdatedCost: 900_000_000,
    totalCostIncrease: 120_000_000,
    projectsWithIncrease: 5,
    increasedViableAmount: 400_000_000,
    costIncreasePct: 30,
    overspentCount: 2,
    stalledCount: 3,
    stalledPendingAmount: 50_000_000,
  };

  it('counts projects and sums the increases, the sort marked', () => {
    const table = rankingTable({ kind: 'entities', items: [entity] }, NOW, { entitySort: 'stalled' });
    expect(labels(table)).toEqual(['Proyectos', 'Con aumento', 'Aumento S/', '%', 'Sin gasto', 'Gasto sobre costo']);
    expect(sortedLabel(table)).toEqual(['Sin gasto']);
    expect(table.rows[0]).toMatchObject({
      name: 'MUNICIPALIDAD PROVINCIAL DE AREQUIPA',
      sub: null,
      region: 'Varias regiones',
      cells: ['12', '5', '+S/ 120 M', '+30%', '3', '2'],
      target: { kind: 'entity', index: 0 },
    });
  });

  it('keeps the project count, the increase and the sorted figure in the compact version', () => {
    expect(
      labels(rankingTable({ kind: 'entities', items: [entity] }, NOW, { entitySort: 'overspent', compact: true })),
    ).toEqual(['Proyectos', 'Aumento S/', 'Gasto sobre costo']);
  });
});
