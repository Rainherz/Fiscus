import { levelReducer, parseLevel, serializeLevel, type LevelState } from './level';

describe('level serialization', () => {
  it('round-trips every option', () => {
    for (const level of ['ALL', 'GN', 'GR', 'GL'] as const) {
      expect(parseLevel(serializeLevel(level))).toBe(level);
    }
  });

  it('rejects missing or unknown values', () => {
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel('')).toBeNull();
    expect(parseLevel('GX')).toBeNull();
    expect(parseLevel('gr')).toBeNull();
  });
});

describe('levelReducer', () => {
  const hydrating: LevelState = { level: 'ALL', ready: false, chosen: false };

  it('takes the stored level, or every level when nothing usable was stored', () => {
    expect(levelReducer(hydrating, { type: 'hydrated', stored: 'GL' })).toEqual({ level: 'GL', ready: true, chosen: false });
    expect(levelReducer(hydrating, { type: 'hydrated', stored: null })).toEqual({ level: 'ALL', ready: true, chosen: false });
  });

  it('keeps a level chosen before hydration finished', () => {
    const chosen = levelReducer(hydrating, { type: 'selected', level: 'GN' });
    expect(chosen).toEqual({ level: 'GN', ready: true, chosen: true });
    expect(levelReducer(chosen, { type: 'hydrated', stored: 'GL' })).toEqual({ level: 'GN', ready: true, chosen: true });
  });
});
