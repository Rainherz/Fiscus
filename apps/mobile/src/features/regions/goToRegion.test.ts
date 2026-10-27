import { goToRegion } from './goToRegion';

describe('goToRegion', () => {
  it('selects the department globally, then opens Inicio', () => {
    const calls: unknown[][] = [];
    goToRegion(8, {
      setCode: (code) => calls.push(['setCode', code]),
      navigateHome: () => calls.push(['navigateHome']),
    });
    expect(calls).toEqual([['setCode', 8], ['navigateHome']]);
  });
});
