import { department, NATIONAL } from '@/features/department/scope';

import { pickRegion } from './pickRegion';

describe('pickRegion', () => {
  it('selects the department globally, then closes the picker', () => {
    const calls: unknown[][] = [];
    pickRegion(department(8), {
      setScope: (scope) => calls.push(['setScope', scope]),
      close: () => calls.push(['close']),
    });
    expect(calls).toEqual([['setScope', department(8)], ['close']]);
  });

  it('selects all of Peru the same way', () => {
    const calls: unknown[][] = [];
    pickRegion(NATIONAL, {
      setScope: (scope) => calls.push(['setScope', scope]),
      close: () => calls.push(['close']),
    });
    expect(calls).toEqual([['setScope', NATIONAL], ['close']]);
  });
});
