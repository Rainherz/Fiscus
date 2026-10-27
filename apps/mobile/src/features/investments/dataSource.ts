export type DataSource =
  | { kind: 'mock' }
  | { kind: 'supabase'; url: string; anonKey: string }
  | { kind: 'missing-config' };

const PLACEHOLDER_KEY = 'your-anon-key';

/** Decides where data comes from, given the raw EXPO_PUBLIC_* values. */
export function resolveDataSource(env: {
  useMock: string | undefined;
  url: string | undefined;
  anonKey: string | undefined;
}): DataSource {
  if (env.useMock?.trim() === '1') return { kind: 'mock' };
  const url = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!url || !anonKey || anonKey === PLACEHOLDER_KEY) return { kind: 'missing-config' };
  return { kind: 'supabase', url, anonKey };
}

/** EXPO_PUBLIC_* must be read with static property access so Expo can inline them. */
export function dataSourceFromEnv(): DataSource {
  return resolveDataSource({
    useMock: process.env.EXPO_PUBLIC_USE_MOCK,
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}
