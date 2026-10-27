import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('only publishes the value after it stops changing', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'ma' } },
    );
    expect(result.current).toBe('ma');

    await rerender({ value: 'maj' });
    await act(async () => jest.advanceTimersByTime(200));
    await rerender({ value: 'maje' });
    await act(async () => jest.advanceTimersByTime(200));
    expect(result.current).toBe('ma');

    await act(async () => jest.advanceTimersByTime(100));
    expect(result.current).toBe('maje');
  });
});
