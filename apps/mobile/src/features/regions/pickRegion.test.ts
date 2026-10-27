import { pickRegion } from './pickRegion';

describe('pickRegion', () => {
  it('selects the department globally, then closes the picker', () => {
    const calls: unknown[][] = [];
    pickRegion(8, {
      setCode: (code) => calls.push(['setCode', code]),
      close: () => calls.push(['close']),
    });
    expect(calls).toEqual([['setCode', 8], ['close']]);
  });
});
