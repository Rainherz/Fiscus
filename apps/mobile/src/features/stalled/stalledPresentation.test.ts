import { mapInvestmentRow } from '@/features/investments/domain/mappers';
import { sampleRow } from '@/features/investments/adapters/sampleData';
import { toStalledInvestment } from '@/features/investments/domain/stalled';

import { stalledCountText, stalledRowDetail, stalledSinceSentence } from './stalledPresentation';

const stalled = toStalledInvestment(
  mapInvestmentRow(
    sampleRow({ cui: '1', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
  ),
  '2026-10-01',
)!;

describe('stalledRowDetail', () => {
  it('states since when, how much was spent and how much is left', () => {
    expect(stalledRowDetail(stalled)).toEqual(['Sin gasto desde abr 2025', 'Gastó 32 % · S/ 202 M por ejecutar']);
  });
});

describe('stalledSinceSentence', () => {
  it('states the last accrual month and the months since', () => {
    expect(stalledSinceSentence({ since: '2025-04-01', months: 18 })).toBe(
      'Sin gasto registrado desde abr 2025 (18 meses).',
    );
  });
});

describe('stalledCountText', () => {
  it('counts projects in the region with singular and plural', () => {
    expect(stalledCountText(1)).toBe('1 proyecto en la región');
    expect(stalledCountText(1015)).toBe('1,015 proyectos en la región');
  });
});
