import { DEFAULT_STATUS, parseStatus, serializeStatus, statusReducer, type StatusState } from './status';

describe('status serialization', () => {
  it('round-trips every option', () => {
    for (const status of ['ACTIVE', 'CLOSED', 'ALL'] as const) {
      expect(parseStatus(serializeStatus(status))).toBe(status);
    }
  });

  it('rejects missing or unknown values', () => {
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus('')).toBeNull();
    expect(parseStatus('CERRADO')).toBeNull();
    expect(parseStatus('active')).toBeNull();
  });
});

describe('statusReducer', () => {
  const hydrating: StatusState = { status: DEFAULT_STATUS, ready: false, chosen: false };

  it('defaults to active projects, so the screens keep their meaning', () => {
    expect(DEFAULT_STATUS).toBe('ACTIVE');
    expect(statusReducer(hydrating, { type: 'hydrated', stored: null })).toEqual({
      status: 'ACTIVE',
      ready: true,
      chosen: false,
    });
  });

  it('takes the stored status', () => {
    expect(statusReducer(hydrating, { type: 'hydrated', stored: 'CLOSED' })).toEqual({
      status: 'CLOSED',
      ready: true,
      chosen: false,
    });
  });

  it('keeps a status chosen before hydration finished', () => {
    const chosen = statusReducer(hydrating, { type: 'selected', status: 'ALL' });
    expect(chosen).toEqual({ status: 'ALL', ready: true, chosen: true });
    expect(statusReducer(chosen, { type: 'hydrated', stored: 'CLOSED' })).toEqual(chosen);
  });
});
