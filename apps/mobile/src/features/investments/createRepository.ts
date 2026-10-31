import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { createInMemoryInvestmentsRepository } from './adapters/inMemoryInvestmentsRepository';
import {
  MOCK_COST_CHANGES,
  MOCK_INFOBRAS_DATA_AS_OF,
  MOCK_INFOBRAS_WORKS,
  MOCK_PARALYZED_WORKS,
  MOCK_ROWS,
} from './adapters/sampleData';
import { createSupabaseInvestmentsRepository } from './adapters/supabaseInvestmentsRepository';
import type { DataSource } from './dataSource';
import type { InvestmentsRepository } from './ports/InvestmentsRepository';

const HOUR = 3_600_000;
/** Fixed past update shown with EXPO_PUBLIC_MOCK_STALE=1, older than the 48 h threshold. */
const STALE_SAMPLE_UPDATE = '2026-10-24T09:12:00Z';

/** Composition root for the data layer. */
export function createRepository(
  source: Exclude<DataSource, { kind: 'missing-config' }>,
  now: () => Date = () => new Date(),
): InvestmentsRepository {
  if (source.kind === 'mock') {
    // The sample is "updated" two hours ago, so the stale banner appears only when forced.
    const recent = new Date(now().getTime() - 2 * HOUR).toISOString();
    return createInMemoryInvestmentsRepository({
      rows: MOCK_ROWS,
      costChanges: MOCK_COST_CHANGES,
      paralyzedWorks: MOCK_PARALYZED_WORKS,
      infobrasWorks: MOCK_INFOBRAS_WORKS,
      infobrasDataAsOf: MOCK_INFOBRAS_DATA_AS_OF,
      lastRun: { startedAt: '2026-10-26T05:00:00Z', finishedAt: '2026-10-26T05:30:00Z' },
      freshness: {
        ssiLastSuccessAt: source.staleData ? STALE_SAMPLE_UPDATE : recent,
        openDataCheckedAt: source.staleData ? STALE_SAMPLE_UPDATE : recent,
      },
    });
  }
  const client = createClient(source.url, source.anonKey, {
    // Public, anonymous, read-only: no sessions to persist or refresh.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createSupabaseInvestmentsRepository(client);
}
