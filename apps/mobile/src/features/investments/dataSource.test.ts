import { resolveDataSource } from './dataSource';

describe('resolveDataSource', () => {
  it('uses the in-memory sample when mock mode is on', () => {
    expect(resolveDataSource({ useMock: '1', url: undefined, anonKey: undefined })).toEqual({
      kind: 'mock',
    });
  });

  it('uses Supabase when URL and anon key are set', () => {
    expect(
      resolveDataSource({ useMock: '0', url: ' https://x.supabase.co ', anonKey: 'key' }),
    ).toEqual({ kind: 'supabase', url: 'https://x.supabase.co', anonKey: 'key' });
  });

  it('reports missing configuration otherwise', () => {
    expect(resolveDataSource({ useMock: undefined, url: 'https://x', anonKey: '' })).toEqual({
      kind: 'missing-config',
    });
    expect(
      resolveDataSource({ useMock: undefined, url: 'https://x', anonKey: 'your-anon-key' }),
    ).toEqual({ kind: 'missing-config' });
  });
});
