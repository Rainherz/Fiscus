import { department, NATIONAL } from './scope';
import {
  LEVEL_STORAGE_KEY,
  SCOPE_STORAGE_KEY,
  STATUS_STORAGE_KEY,
  createLevelStorage,
  createScopeStorage,
  createStatusStorage,
  type KeyValueStore,
} from './scopeStorage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

const failing: KeyValueStore = {
  getItem: async () => {
    throw new Error('storage unavailable');
  },
  setItem: async () => {
    throw new Error('storage unavailable');
  },
};

describe('scope storage', () => {
  it('saves and loads the last chosen scope', async () => {
    const store = memoryStore();
    const storage = createScopeStorage(store);
    await storage.save(department(8));
    expect(store.data[SCOPE_STORAGE_KEY]).toBe('{"kind":"department","code":8}');
    expect(await storage.load()).toEqual(department(8));
    await storage.save(NATIONAL);
    expect(await storage.load()).toEqual(NATIONAL);
  });

  it('loads nothing when nothing was stored or the value is unusable', async () => {
    expect(await createScopeStorage(memoryStore()).load()).toBeNull();
    expect(await createScopeStorage(memoryStore({ [SCOPE_STORAGE_KEY]: 'oops' })).load()).toBeNull();
  });

  it('never throws when the device storage fails', async () => {
    const storage = createScopeStorage(failing);
    await expect(storage.load()).resolves.toBeNull();
    await expect(storage.save(department(4))).resolves.toBeUndefined();
  });

  it('never throws when the storage accessor itself throws synchronously', async () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    const storage = createScopeStorage(throwing);
    await expect(storage.load()).resolves.toBeNull();
    await expect(storage.save(NATIONAL)).resolves.toBeUndefined();
  });
});

describe('level storage', () => {
  it('saves and loads the last chosen level under its own key', async () => {
    const store = memoryStore();
    const storage = createLevelStorage(store);
    await storage.save('GL');
    expect(LEVEL_STORAGE_KEY).toBe('fiscus.level');
    expect(store.data[LEVEL_STORAGE_KEY]).toBe('GL');
    expect(await storage.load()).toBe('GL');
  });

  it('loads nothing for unusable values and never throws', async () => {
    expect(await createLevelStorage(memoryStore({ [LEVEL_STORAGE_KEY]: 'XX' })).load()).toBeNull();
    await expect(createLevelStorage(failing).load()).resolves.toBeNull();
    await expect(createLevelStorage(failing).save('GN')).resolves.toBeUndefined();
  });
});

describe('status storage', () => {
  it('saves and loads the last chosen status filter under its own key', async () => {
    const store = memoryStore();
    const storage = createStatusStorage(store);
    await storage.save('CLOSED');
    expect(STATUS_STORAGE_KEY).toBe('fiscus.status');
    expect(store.data[STATUS_STORAGE_KEY]).toBe('CLOSED');
    expect(await storage.load()).toBe('CLOSED');
  });

  it('loads nothing for unusable values and never throws', async () => {
    expect(await createStatusStorage(memoryStore({ [STATUS_STORAGE_KEY]: 'CERRADO' })).load()).toBeNull();
    await expect(createStatusStorage(failing).load()).resolves.toBeNull();
    await expect(createStatusStorage(failing).save('ALL')).resolves.toBeUndefined();
  });
});
