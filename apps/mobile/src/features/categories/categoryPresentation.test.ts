import { majes } from '@/test/fixtures';

import { categoryRowDetail } from './categoryPresentation';

describe('categoryRowDetail', () => {
  it('states the increase over the viable amount, or the CUI without one', () => {
    expect(categoryRowDetail(majes)).toBe('+S/ 3,809 M vs. monto viable');
    expect(categoryRowDetail({ ...majes, costIncrease: null })).toBe('CUI 2088142');
    expect(categoryRowDetail({ ...majes, costIncrease: 0 })).toBe('CUI 2088142');
  });

  it('starts with the region when listing all of Peru', () => {
    expect(categoryRowDetail(majes, { national: true })).toBe('Arequipa · +S/ 3,809 M vs. monto viable');
    expect(categoryRowDetail({ ...majes, costIncrease: null, departmentCode: 8 }, { national: true })).toBe(
      'Cusco · CUI 2088142',
    );
  });
});
