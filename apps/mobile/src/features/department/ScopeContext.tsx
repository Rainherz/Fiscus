import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { NATIONAL, scopeLabel, scopeReducer, type Scope } from './scope';
import { createScopeStorage, type ScopeStorage } from './scopeStorage';

interface ScopeContextValue {
  scope: Scope;
  /** "Todo el Perú" or the accented department name. */
  label: string;
  /** False until the last chosen scope was read from the device; nothing should fetch before. */
  ready: boolean;
  setScope: (scope: Scope) => void;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

const deviceStorage = createScopeStorage(AsyncStorage);

/**
 * Global scope shared by every tab: all of Peru (default) or one department. The last choice is
 * kept on the device. With `initialScope` (tests, previews) the device storage is not read.
 */
export function ScopeProvider({
  children,
  storage = deviceStorage,
  initialScope,
}: {
  children: ReactNode;
  storage?: ScopeStorage;
  initialScope?: Scope;
}) {
  const [state, dispatch] = useReducer(scopeReducer, {
    scope: initialScope ?? NATIONAL,
    ready: initialScope !== undefined,
    chosen: false,
  });

  const hydrate = state.ready ? null : storage;
  useEffect(() => {
    if (!hydrate) return;
    let active = true;
    hydrate
      .load()
      .catch(() => null)
      .then((stored) => {
        if (active) dispatch({ type: 'hydrated', stored });
      });
    return () => {
      active = false;
    };
  }, [hydrate]);

  const setScope = useCallback(
    (scope: Scope) => {
      dispatch({ type: 'selected', scope });
      storage.save(scope).catch(() => {});
    },
    [storage],
  );

  const value = useMemo(
    () => ({ scope: state.scope, label: scopeLabel(state.scope), ready: state.ready, setScope }),
    [state.scope, state.ready, setScope],
  );
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const value = useContext(ScopeContext);
  if (!value) throw new Error('useScope must be used inside ScopeProvider');
  return value;
}
