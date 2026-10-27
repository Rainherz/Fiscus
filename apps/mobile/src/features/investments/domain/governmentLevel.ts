/** Level of government that owns an investment, as MEF codes it (`investments.government_level`). */
export type GovernmentLevel = 'GN' | 'GR' | 'GL';

/** The level filter of every read: one level, or every level ('ALL', the `*_by_level` views' code). */
export type LevelFilter = GovernmentLevel | 'ALL';

export const GOVERNMENT_LEVELS: readonly GovernmentLevel[] = ['GN', 'GR', 'GL'];

export const LEVEL_FILTERS: readonly LevelFilter[] = ['ALL', ...GOVERNMENT_LEVELS];

export function isGovernmentLevel(value: unknown): value is GovernmentLevel {
  return typeof value === 'string' && (GOVERNMENT_LEVELS as readonly string[]).includes(value);
}

export function isLevelFilter(value: unknown): value is LevelFilter {
  return typeof value === 'string' && (LEVEL_FILTERS as readonly string[]).includes(value);
}
