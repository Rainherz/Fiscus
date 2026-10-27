import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { department, NATIONAL, type Scope } from './scope';
import { ScopeProvider, useScope } from './ScopeContext';
import type { LevelFilter } from '../investments/domain/governmentLevel';
import type { LevelStorage, ScopeStorage } from './scopeStorage';

function Probe() {
  const { scope, label, ready, setScope } = useScope();
  return (
    <>
      <Text>{ready ? `ready: ${label}` : 'hydrating'}</Text>
      <Text>{scope.kind === 'department' ? `code ${scope.code}` : 'national'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setScope(department(8))}>
        <Text>Cusco</Text>
      </Pressable>
    </>
  );
}

function deferredStorage() {
  let resolve: (scope: Scope | null) => void = () => {};
  const saved: Scope[] = [];
  const storage: ScopeStorage = {
    load: () => new Promise((r) => (resolve = r)),
    save: async (scope) => {
      saved.push(scope);
    },
  };
  return { storage, saved, finish: (scope: Scope | null) => act(async () => resolve(scope)) };
}

describe('ScopeProvider', () => {
  it('is not ready until the stored scope was read, then uses it', async () => {
    const { storage, finish } = deferredStorage();
    await render(
      <ScopeProvider storage={storage}>
        <Probe />
      </ScopeProvider>,
    );
    expect(screen.getByText('hydrating')).toBeOnTheScreen();
    await finish(department(4));
    expect(screen.getByText('ready: Arequipa')).toBeOnTheScreen();
    expect(screen.getByText('code 4')).toBeOnTheScreen();
  });

  it('defaults to all of Peru when nothing was stored', async () => {
    const { storage, finish } = deferredStorage();
    await render(
      <ScopeProvider storage={storage}>
        <Probe />
      </ScopeProvider>,
    );
    await finish(null);
    expect(screen.getByText('ready: Todo el Perú')).toBeOnTheScreen();
  });

  it('defaults to all of Peru when the storage fails', async () => {
    const storage: ScopeStorage = {
      load: () => Promise.reject(new Error('unavailable')),
      save: () => Promise.reject(new Error('unavailable')),
    };
    await render(
      <ScopeProvider storage={storage}>
        <Probe />
      </ScopeProvider>,
    );
    expect(await screen.findByText('ready: Todo el Perú')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cusco' }));
    expect(screen.getByText('ready: Cusco')).toBeOnTheScreen();
  });

  it('saves every selection on the device', async () => {
    const { storage, saved, finish } = deferredStorage();
    await render(
      <ScopeProvider storage={storage}>
        <Probe />
      </ScopeProvider>,
    );
    await finish(NATIONAL);
    await fireEvent.press(screen.getByRole('button', { name: 'Cusco' }));
    expect(screen.getByText('code 8')).toBeOnTheScreen();
    expect(saved).toEqual([department(8)]);
  });

  it('starts ready with an initial scope and does not read the storage', async () => {
    const load = jest.fn(() => Promise.resolve(department(8)));
    await render(
      <ScopeProvider storage={{ load, save: async () => {} }} initialScope={department(21)}>
        <Probe />
      </ScopeProvider>,
    );
    expect(screen.getByText('ready: Puno')).toBeOnTheScreen();
    expect(load).not.toHaveBeenCalled();
  });
});

function LevelProbe() {
  const { level, levelLabel, ready, setLevel } = useScope();
  return (
    <>
      <Text>{ready ? `level ${level}: ${levelLabel}` : 'hydrating'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setLevel('GN')}>
        <Text>Nacional</Text>
      </Pressable>
    </>
  );
}

describe('ScopeProvider government level', () => {
  const noScope: ScopeStorage = { load: async () => null, save: async () => {} };

  function deferredLevel() {
    let resolve: (level: LevelFilter | null) => void = () => {};
    const saved: LevelFilter[] = [];
    const levelStorage: LevelStorage = {
      load: () => new Promise((r) => (resolve = r)),
      save: async (level) => {
        saved.push(level);
      },
    };
    return { levelStorage, saved, finish: (level: LevelFilter | null) => act(async () => resolve(level)) };
  }

  it('waits for the stored level too, then uses it', async () => {
    const { levelStorage, finish } = deferredLevel();
    await render(
      <ScopeProvider storage={noScope} levelStorage={levelStorage}>
        <LevelProbe />
      </ScopeProvider>,
    );
    expect(screen.getByText('hydrating')).toBeOnTheScreen();
    await finish('GL');
    expect(screen.getByText('level GL: Gobiernos locales')).toBeOnTheScreen();
  });

  it('defaults to every level and saves a selection', async () => {
    const { levelStorage, saved, finish } = deferredLevel();
    await render(
      <ScopeProvider storage={noScope} levelStorage={levelStorage}>
        <LevelProbe />
      </ScopeProvider>,
    );
    await finish(null);
    expect(screen.getByText('level ALL: Todos los niveles')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nacional' }));
    expect(screen.getByText('level GN: Gobierno nacional')).toBeOnTheScreen();
    expect(saved).toEqual(['GN']);
  });

  it('starts ready with an initial scope and level', async () => {
    const load = jest.fn(() => Promise.resolve('GN' as const));
    await render(
      <ScopeProvider storage={noScope} levelStorage={{ load, save: async () => {} }} initialScope={NATIONAL} initialLevel="GR">
        <LevelProbe />
      </ScopeProvider>,
    );
    expect(screen.getByText('level GR: Gobiernos regionales')).toBeOnTheScreen();
    expect(load).not.toHaveBeenCalled();
  });
});
