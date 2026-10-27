import { parseScope, serializeScope, type Scope } from './scope';

/** The subset of AsyncStorage the scope needs (on web it is backed by localStorage). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Last chosen scope on the device. Never throws: a failing storage means "nothing stored". */
export interface ScopeStorage {
  load(): Promise<Scope | null>;
  save(scope: Scope): Promise<void>;
}

export const SCOPE_STORAGE_KEY = 'fiscus.scope';

export function createScopeStorage(store: KeyValueStore): ScopeStorage {
  return {
    async load() {
      try {
        return parseScope(await store.getItem(SCOPE_STORAGE_KEY));
      } catch {
        return null;
      }
    },
    async save(scope) {
      try {
        await store.setItem(SCOPE_STORAGE_KEY, serializeScope(scope));
      } catch {
        // Persisting is a convenience: the app keeps working with the scope in memory.
      }
    },
  };
}
