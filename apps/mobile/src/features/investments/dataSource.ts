export type DataSource =
  /** `staleData`: the sample's last SSI update is days old, to show the stale-data banner. */
  | { kind: 'mock'; staleData: boolean }
  | { kind: 'supabase'; url: string; anonKey: string }
  | { kind: 'missing-config' };

const PLACEHOLDER_KEY = 'your-anon-key';

/** Decides where data comes from, given the raw EXPO_PUBLIC_* values. */
export function resolveDataSource(env: {
  useMock: string | undefined;
  mockStale?: string | undefined;
  url: string | undefined;
  anonKey: string | undefined;
}): DataSource {
  if (env.useMock?.trim() === '1') return { kind: 'mock', staleData: env.mockStale?.trim() === '1' };
  const url = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!url || !anonKey || anonKey === PLACEHOLDER_KEY) return { kind: 'missing-config' };
  return { kind: 'supabase', url, anonKey };
}

/** EXPO_PUBLIC_* must be read with static property access so Expo can inline them. */
export function dataSourceFromEnv(): DataSource {
  return resolveDataSource({
    useMock: process.env.EXPO_PUBLIC_USE_MOCK,
    mockStale: process.env.EXPO_PUBLIC_MOCK_STALE,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}
