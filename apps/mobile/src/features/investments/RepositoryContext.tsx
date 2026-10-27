import { createContext, useContext, type ReactNode } from 'react';

import type { InvestmentsRepository } from './ports/InvestmentsRepository';

interface RepositoryState {
  repository: InvestmentsRepository;
  /** True when showing the bundled sample instead of live data. */
  isDemo: boolean;
}

const RepositoryContext = createContext<RepositoryState | null>(null);

export function RepositoryProvider({ children, ...value }: RepositoryState & { children: ReactNode }) {
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): RepositoryState {
  const state = useContext(RepositoryContext);
  if (!state) throw new Error('useRepository must be used inside RepositoryProvider');
  return state;
}
