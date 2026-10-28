import { act, renderHook } from '@testing-library/react-native';

import type { MapFeature } from './mapBridge';
import { useMapSync } from './useMapSync';

const feature: MapFeature = { kind: 'point', id: '1', latitude: -16, longitude: -71, increased: true };

async function setup(initial: { features: MapFeature[]; highlightCui: string | null }) {
  const send = jest.fn();
  const onEvent = jest.fn();
  const hook = await renderHook((props: { features: MapFeature[]; highlightCui: string | null }) =>
    useMapSync({ ...props, onEvent }, send),
  { initialProps: initial });
  return { send, onEvent, ...hook };
}

describe('useMapSync', () => {
  it('sends nothing before the page is ready, then the current data and highlight', async () => {
    const { send, result, onEvent } = await setup({ features: [feature], highlightCui: '1' });
    expect(send).not.toHaveBeenCalled();
    await act(() => result.current('{"type":"ready"}'));
    expect(send.mock.calls).toEqual([
      [{ type: 'setData', features: [feature] }],
      [{ type: 'highlight', cui: '1' }],
    ]);
    expect(onEvent).toHaveBeenCalledWith({ type: 'ready' });
  });

  it('sends changes once ready', async () => {
    const { send, result, rerender } = await setup({ features: [], highlightCui: null });
    await act(() => result.current('{"type":"ready"}'));
    send.mockClear();
    const features = [feature];
    await rerender({ features, highlightCui: null });
    await rerender({ features, highlightCui: '1' });
    expect(send.mock.calls).toEqual([
      [{ type: 'setData', features }],
      [{ type: 'highlight', cui: '1' }],
    ]);
  });

  it('forwards valid events and drops malformed ones', async () => {
    const { result, onEvent } = await setup({ features: [], highlightCui: null });
    await act(() => result.current('{"type":"pointPressed","cui":"2088142"}'));
    await act(() => result.current('{"type":"pointPressed","cui":"x"}'));
    await act(() => result.current('garbage'));
    expect(onEvent.mock.calls).toEqual([[{ type: 'pointPressed', cui: '2088142' }]]);
  });
});
