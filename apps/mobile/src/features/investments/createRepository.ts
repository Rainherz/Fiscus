import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { createInMemoryInvestmentsRepository } from './adapters/inMemoryInvestmentsRepository';
import { MOCK_ROWS } from './adapters/sampleData';
import { createSupabaseInvestmentsRepository } from './adapters/supabaseInvestmentsRepository';
import type { DataSource } from './dataSource';
import type { InvestmentsRepository } from './ports/InvestmentsRepository';

/** Composition root for the data layer. */
export function createRepository(source: Exclude<DataSource, { kind: 'missing-config' }>): InvestmentsRepository {
  if (source.kind === 'mock') {
    return createInMemoryInvestmentsRepository({
      rows: MOCK_ROWS,
      lastRun: { startedAt: '2026-10-26T05:00:00Z', finishedAt: '2026-10-26T05:30:00Z' },
    });
  }
  const client = createClient(source.url, source.anonKey, {
    // Public, anonymous, read-only: no sessions to persist or refresh.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createSupabaseInvestmentsRepository(client);
}
