import type { Investment } from '@/features/investments/domain/investment';
import { majes } from '@/test/fixtures';

import { shareCardContent, shareFileName } from './shareCardPresentation';

const base: Investment = {
  ...majes,
  status: 'ACTIVO',
  lastAccrualMonth: '2026-09-01',
  sourceUpdatedAt: '2026-10-26T15:00:00Z',
};

const content = (investment: Investment, referenceMonth: string | null = '2026-09-01') =>
  shareCardContent(investment, { referenceMonth });

describe('shareCardContent', () => {
  it('leads with the cost increase percentage when the cost went up', () => {
    const card = content(base);
    expect(card.brand).toBe('FISCUS');
    expect(card.region).toBe('AREQUIPA');
    expect(card.name).toBe('Majes Siguas II etapa');
    expect(card.hero).toEqual({ kind: 'figure', label: 'AUMENTO DEL COSTO', text: '+285%' });
    expect(card.costLines).toEqual(['S/ 1,338 M aprobado en 2008', 'S/ 5,148 M cuesta hoy']);
    expect(card.spent).toEqual({ label: 'GASTADO 18 % DEL COSTO', ratio: 0.18, notes: [] });
    expect(card.footer).toBe(
      'CUI 2088142 · Fuente: MEF – Sistema de Seguimiento de Inversiones · Último cambio en los datos: 26/10/2026',
    );
  });

  it('shows the updated cost as the figure when there is no increase', () => {
    const card = content({ ...base, viableAmount: 5_147_912_126, costIncrease: 0, costIncreasePct: 0 });
    expect(card.hero).toEqual({ kind: 'figure', label: 'CUESTA HOY', text: 'S/ 5,148 M' });
    expect(card.costLines).toEqual(['S/ 5,148 M aprobado en 2008']);
  });

  it('shows the invalid-cost notice instead of a figure, and no spent share', () => {
    const card = content({
      ...base,
      updatedCost: 500,
      updatedCostValid: false,
      costIncrease: null,
      costIncreasePct: null,
      executionProgress: null,
    });
    expect(card.hero).toEqual({
      kind: 'notice',
      text: 'Costo actualizado no válido en la fuente MEF',
      detail: 'El MEF publica S/ 500 como costo actualizado.',
    });
    expect(card.costLines).toEqual(['S/ 1,338 M aprobado en 2008']);
    expect(card.spent).toBeNull();
  });

  it('states a missing updated cost instead of inventing a figure', () => {
    const card = content({
      ...base,
      updatedCost: null,
      updatedCostValid: false,
      costIncrease: null,
      costIncreasePct: null,
      executionProgress: null,
    });
    expect(card.hero).toEqual({ kind: 'notice', text: 'Sin costo actualizado en la fuente MEF', detail: null });
    expect(card.spent).toBeNull();
  });

  it('states spending beyond the updated cost', () => {
    const card = content({
      ...base,
      updatedCost: 1_432_976_292.23,
      accruedTotal: 1_459_731_800.72,
      executionProgress: 1.0187,
    });
    expect(card.spent?.label).toBe('GASTADO 102 % DEL COSTO');
    expect(card.spent?.notes).toEqual(['Gastó S/ 26.8 M más que su costo actualizado']);
  });

  it('flags spending above 10 times the updated cost as unusual source data', () => {
    const card = content({
      ...base,
      viableAmount: 299_700,
      updatedCost: 299_700,
      accruedTotal: 18_768_455.33,
      costIncrease: 0,
      costIncreasePct: 0,
      executionProgress: 62.624,
      spentAnomaly: true,
    });
    expect(card.spent?.notes).toEqual([
      'Gastó S/ 18.5 M más que su costo actualizado',
      'Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado.',
    ]);
  });

  it('says since when there is no spending for a stalled project', () => {
    const card = content({ ...base, lastAccrualMonth: '2025-04-01' });
    expect(card.spent?.notes).toEqual(['Sin gasto registrado desde abr 2025 (17 meses).']);
  });

  it('falls back to PERÚ, an unnamed project and no year or data date when unknown', () => {
    const card = content({
      ...base,
      departmentName: null,
      name: null,
      viabilityAt: null,
      sourceUpdatedAt: null,
    });
    expect(card.region).toBe('PERÚ');
    expect(card.name).toBe('Sin nombre');
    expect(card.costLines[0]).toBe('S/ 1,338 M aprobado');
    expect(card.footer).toBe('CUI 2088142 · Fuente: MEF – Sistema de Seguimiento de Inversiones');
  });

  it('names a multi-department national project and cites the open data', () => {
    const card = content({ ...base, departmentCode: null, departmentName: null, dataSource: 'open_data' });
    expect(card.region).toBe('VARIAS REGIONES');
    expect(card.footer).toBe('CUI 2088142 · Fuente: MEF – Datos Abiertos, Detalle de inversiones · Último cambio en los datos: 26/10/2026');
  });

  it('shortens long names at a word, with an ellipsis, so they fit three lines', () => {
    const name =
      'Mejoramiento y ampliación del servicio de transitabilidad vehicular y peatonal de la carretera departamental';
    const card = content({ ...base, name });
    expect(card.name).toBe('Mejoramiento y ampliación del servicio de transitabilidad…');
    expect(card.name.length).toBeLessThanOrEqual(64);
    expect(content({ ...base, name: 'Hospital Antonio Lorena' }).name).toBe('Hospital Antonio Lorena');
  });

  it('omits the approved line when the viable amount is unknown', () => {
    const card = content({ ...base, viableAmount: null, costIncrease: null, costIncreasePct: null });
    expect(card.hero).toEqual({ kind: 'figure', label: 'CUESTA HOY', text: 'S/ 5,148 M' });
    expect(card.costLines).toEqual([]);
  });

  it('summarizes the card for assistive technologies', () => {
    expect(content(base).accessibilityLabel).toBe(
      'FISCUS, AREQUIPA. Majes Siguas II etapa. AUMENTO DEL COSTO: +285%. ' +
        'S/ 1,338 M aprobado en 2008. S/ 5,148 M cuesta hoy. GASTADO 18 % DEL COSTO. ' +
        'CUI 2088142 · Fuente: MEF – Sistema de Seguimiento de Inversiones · Último cambio en los datos: 26/10/2026',
    );
  });
});

describe('shareFileName', () => {
  it('names the image after the CUI', () => {
    expect(shareFileName('2088142')).toBe('fiscus-2088142.png');
  });
});
