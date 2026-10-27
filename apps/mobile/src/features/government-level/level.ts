import { isLevelFilter, type LevelFilter } from '../investments/domain/governmentLevel';

/** Default level filter: every level of government. */
export const ALL_LEVELS: LevelFilter = 'ALL';

export function serializeLevel(level: LevelFilter): string {
  return level;
}

/** A stored level, or null when the value is missing or not a known level. */
export function parseLevel(raw: string | null): LevelFilter | null {
  return isLevelFilter(raw) ? raw : null;
}

/** Same rules as the scope: a selection made before hydration wins over the stored value. */
export interface LevelState {
  level: LevelFilter;
  ready: boolean;
  chosen: boolean;
}

export type LevelAction = { type: 'hydrated'; stored: LevelFilter | null } | { type: 'selected'; level: LevelFilter };

export function levelReducer(state: LevelState, action: LevelAction): LevelState {
  switch (action.type) {
    case 'hydrated':
      if (state.chosen) return { ...state, ready: true };
      return { level: action.stored ?? ALL_LEVELS, ready: true, chosen: false };
    case 'selected':
      return { level: action.level, ready: true, chosen: true };
  }
}
