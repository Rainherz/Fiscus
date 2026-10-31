import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { NATIONAL, type Scope } from '@/features/department/scope';
import { ScopeProvider, useScope } from '@/features/department/ScopeContext';
import type { LevelStorage, ScopeStorage, StatusStorage } from '@/features/department/scopeStorage';
import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import type { StatusFilter } from '@/features/investments/domain/investmentStatus';

const noStorage = { load: async () => null, save: async () => {} };

export interface ScopePreset {
  scope?: Scope;
  level?: LevelFilter;
  status?: StatusFilter;
}

/** Global filters preset for a view test, never read from or written to the device. */
export function TestScope({ preset = {}, children }: { preset?: ScopePreset; children: ReactNode }) {
  return (
    <ScopeProvider
      storage={noStorage as ScopeStorage}
      levelStorage={noStorage as LevelStorage}
      statusStorage={noStorage as StatusStorage}
      initialScope={preset.scope ?? NATIONAL}
      initialLevel={preset.level}
      initialStatus={preset.status}>
      {children}
    </ScopeProvider>
  );
}

/** "Todo el Perú | Todos los niveles | Proyectos activos": the global filters, to assert on. */
export function ScopeProbe() {
  const { label, levelLabel, statusLabel } = useScope();
  return <Text testID="scope-probe">{`${label} | ${levelLabel} | ${statusLabel}`}</Text>;
}
