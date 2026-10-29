import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { ALL_LEVELS, levelReducer } from '../government-level/level';
import { levelFilterLabel } from '../government-level/levelPresentation';
import { DEFAULT_STATUS, statusReducer } from '../investment-status/status';
import { statusFilterLabel } from '../investment-status/statusPresentation';
import type { LevelFilter } from '../investments/domain/governmentLevel';
import type { StatusFilter } from '../investments/domain/investmentStatus';
import { NATIONAL, departmentCodeOf, scopeLabel, scopeReducer, type Scope } from './scope';
import {
  createLevelStorage,
  createScopeStorage,
  createStatusStorage,
  type LevelStorage,
  type ScopeStorage,
  type StatusStorage,
} from './scopeStorage';

interface ScopeContextValue {
  scope: Scope;
  /** "Todo el Perú" or the accented department name. */
  label: string;
  /** Government level of every read: one level, or every level ('ALL', the default). */
  level: LevelFilter;
  /** "Todos los niveles", "Gobierno nacional"... */
  levelLabel: string;
  /** Status of every read: active projects (the default), closed ones, or both ('ALL'). */
  status: StatusFilter;
  /** "Proyectos activos", "Proyectos cerrados", "Activos y cerrados". */
  statusLabel: string;
  /** False until the last chosen scope, level and status were read from the device; nothing should fetch before. */
  ready: boolean;
  setScope: (scope: Scope) => void;
  setLevel: (level: LevelFilter) => void;
  setStatus: (status: StatusFilter) => void;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

const deviceStorage = createScopeStorage(AsyncStorage);
const deviceLevelStorage = createLevelStorage(AsyncStorage);
const deviceStatusStorage = createStatusStorage(AsyncStorage);

/** Reads the device storage once, unless the state is already ready. */
function useHydration<T>(load: (() => Promise<T | null>) | null, onLoaded: (value: T | null) => void) {
  useEffect(() => {
    if (!load) return;
    let active = true;
    load()
      .catch(() => null)
      .then((stored) => {
        if (active) onLoaded(stored);
      });
    return () => {
      active = false;
    };
    // onLoaded only dispatches; a new loader is what restarts hydration.
  }, [load]);
}

/**
 * Global scope shared by every tab: all of Peru (default) or one department, the level of
 * government (every level by default) and the project status (active projects by default). The
 * last choices are kept on the device. With `initialScope` (tests, previews) the device storage is
 * not read.
 */
export function ScopeProvider({
  children,
  storage = deviceStorage,
  levelStorage = deviceLevelStorage,
  statusStorage = deviceStatusStorage,
  initialScope,
  initialLevel,
  initialStatus,
}: {
  children: ReactNode;
  storage?: ScopeStorage;
  levelStorage?: LevelStorage;
  statusStorage?: StatusStorage;
  initialScope?: Scope;
  initialLevel?: LevelFilter;
  initialStatus?: StatusFilter;
}) {
  const preset = initialScope !== undefined;
  const [state, dispatch] = useReducer(scopeReducer, {
    scope: initialScope ?? NATIONAL,
    ready: preset,
    chosen: false,
  });
  const [levelState, dispatchLevel] = useReducer(levelReducer, {
    level: initialLevel ?? ALL_LEVELS,
    ready: preset,
    chosen: false,
  });
  const [statusState, dispatchStatus] = useReducer(statusReducer, {
    status: initialStatus ?? DEFAULT_STATUS,
    ready: preset,
    chosen: false,
  });

  const loadScope = useMemo(() => (state.ready ? null : () => storage.load()), [state.ready, storage]);
  const loadLevel = useMemo(() => (levelState.ready ? null : () => levelStorage.load()), [levelState.ready, levelStorage]);
  const loadStatus = useMemo(
    () => (statusState.ready ? null : () => statusStorage.load()),
    [statusState.ready, statusStorage],
  );
  useHydration(loadScope, (stored) => dispatch({ type: 'hydrated', stored }));
  useHydration(loadLevel, (stored) => dispatchLevel({ type: 'hydrated', stored }));
  useHydration(loadStatus, (stored) => dispatchStatus({ type: 'hydrated', stored }));

  const setScope = useCallback(
    (scope: Scope) => {
      dispatch({ type: 'selected', scope });
      storage.save(scope).catch(() => {});
    },
    [storage],
  );
  const setLevel = useCallback(
    (level: LevelFilter) => {
      dispatchLevel({ type: 'selected', level });
      levelStorage.save(level).catch(() => {});
    },
    [levelStorage],
  );
  const setStatus = useCallback(
    (status: StatusFilter) => {
      dispatchStatus({ type: 'selected', status });
      statusStorage.save(status).catch(() => {});
    },
    [statusStorage],
  );

  const value = useMemo(
    () => ({
      scope: state.scope,
      label: scopeLabel(state.scope),
      level: levelState.level,
      levelLabel: levelFilterLabel(levelState.level),
      status: statusState.status,
      statusLabel: statusFilterLabel(statusState.status),
      ready: state.ready && levelState.ready && statusState.ready,
      setScope,
      setLevel,
      setStatus,
    }),
    [
      state.scope,
      state.ready,
      levelState.level,
      levelState.ready,
      statusState.status,
      statusState.ready,
      setScope,
      setLevel,
      setStatus,
    ],
  );
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const value = useContext(ScopeContext);
  if (!value) throw new Error('useScope must be used inside ScopeProvider');
  return value;
}

/** The department, level and status filters of every read in the current scope. */
export function useReadScope(): { departmentCode: number | undefined; level: LevelFilter; status: StatusFilter } {
  const { scope, level, status } = useScope();
  return useMemo(() => ({ departmentCode: departmentCodeOf(scope), level, status }), [scope, level, status]);
}
