import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import Rankings from '@/app/(tabs)/rankings';
import Entity from '@/app/entity';
import { NATIONAL, department, type Scope } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { LevelStorage, ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import type { LevelFilter } from '@/features/investments/domain/governmentLevel';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

let storedScope: Scope = NATIONAL;
let storedLevel: LevelFilter = 'ALL';
const storage: ScopeStorage = { load: async () => storedScope, save: async () => {} };
const levelStorage: LevelStorage = { load: async () => storedLevel, save: async () => {} };

beforeEach(() => {
  storedScope = NATIONAL;
  storedLevel = 'ALL';
});

function RootLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const repository = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, costChanges: MOCK_COST_CHANGES, lastRun: null });
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo>
        <ScopeProvider storage={storage} levelStorage={levelStorage}>
          <ScopeGate>
            <Stack screenOptions={{ headerShown: false }} />
          </ScopeGate>
        </ScopeProvider>
      </RepositoryProvider>
    </QueryClientProvider>
  );
}

const placeholder = (name: string) => () => <Text>{name}</Text>;

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': placeholder('Inicio'),
  '(tabs)/rankings': Rankings,
  '(tabs)/categories': placeholder('Categorías'),
  '(tabs)/search': placeholder('Buscar'),
  entity: Entity,
  'investment/[cui]': placeholder('Detalle'),
};

const MINISTRY = 'MINISTERIO DE TRANSPORTES Y COMUNICACIONES (demo)';

describe('Entidades drill-down', () => {
  it('opens the projects of an entity, including its multi-department project nationwide', async () => {
    const router = await renderRouter(routes, { initialUrl: '/rankings?tab=entities' });
    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^\\d+\\. ${MINISTRY.replace(/[()]/g, '\\$&')}, Gobierno nacional,`) }));
    expect(router.getPathname()).toBe('/entity');
    expect(router.getSearchParams()).toEqual({ name: MINISTRY, level: 'GN' });
    expect(await screen.findByRole('header', { name: MINISTRY })).toBeOnTheScreen();
    expect(screen.getByText('Gobierno nacional · Todo el Perú')).toBeOnTheScreen();
    expect(await screen.findByText('Varias regiones · S/ 2,400 M → S/ 3,150 M')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Puente vehicular sobre el río Chili \(demo\)/ })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Entidades' })).toBeNull();
  });

  it('lists only the projects of the entity in the selected region', async () => {
    storedScope = department(4);
    await renderRouter(routes, { initialUrl: `/entity?name=${encodeURIComponent(MINISTRY)}&level=GN` });
    expect(await screen.findByRole('button', { name: /Puente vehicular sobre el río Chili \(demo\)/ })).toBeOnTheScreen();
    expect(screen.queryByText(/Red vial nacional tramo multirregional/)).toBeNull();
  });

  it('respects the global level in the Entidades tab', async () => {
    storedLevel = 'GL';
    await renderRouter(routes, { initialUrl: '/rankings?tab=entities' });
    expect(await screen.findByRole('button', { name: /MUNICIPALIDAD DISTRITAL DE CAYMA \(demo\), Gobierno local/ })).toBeOnTheScreen();
    expect(screen.queryByText(MINISTRY)).toBeNull();
  });
});
