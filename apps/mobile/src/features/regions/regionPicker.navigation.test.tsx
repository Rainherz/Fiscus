import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import Rankings from '@/app/(tabs)/rankings';
import Home from '@/app/(tabs)/index';
import Region from '@/app/region';
import { department, NATIONAL, type Scope } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

/** Device storage of the scope for the current test: what was stored and every save. */
let stored: Scope | null = null;
let saved: Scope[] = [];
const storage: ScopeStorage = {
  load: async () => stored,
  save: async (scope) => {
    saved.push(scope);
  },
};

beforeEach(() => {
  stored = department(4);
  saved = [];
});

/** The real tabs layout, Home, Rankings and region picker inside a root stack with the app's providers. */
function RootLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const repository = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, costChanges: MOCK_COST_CHANGES, lastRun: null });
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo>
        <ScopeProvider storage={storage}>
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
  '(tabs)/index': Home,
  '(tabs)/rankings': Rankings,
  '(tabs)/categories': placeholder('Categorías'),
  '(tabs)/search': placeholder('Buscar'),
  region: Region,
};

const headerSelector = (name: string) =>
  screen.findByRole('button', {
    name: `Cambiar región o nivel de gobierno. Región actual: ${name}. Nivel: Todos los niveles`,
  });

describe('region picker navigation', () => {
  it('opens from the header selector', async () => {
    const router = await renderRouter(routes, { initialUrl: '/rankings' });
    await fireEvent.press(await headerSelector('Arequipa'));
    expect(router.getPathname()).toBe('/region');
    expect(await screen.findByRole('header', { name: 'Elegir región' })).toBeOnTheScreen();
  });

  it('sets the global region and returns to the screen it was opened from', async () => {
    const router = await renderRouter(routes, { initialUrl: '/rankings?tab=cost' });
    await fireEvent.press(await headerSelector('Arequipa'));
    await screen.findByLabelText('Ordenar regiones por');
    await fireEvent.press(screen.getByRole('button', { name: /^(\d+\. )?Cusco,/ }));
    expect(router.getPathname()).toBe('/rankings');
    expect(router.getSearchParams()).toEqual({ tab: 'cost' });
    expect(await headerSelector('Cusco')).toBeOnTheScreen();
  });

  it('closes without changing the region', async () => {
    const router = await renderRouter(routes, { initialUrl: '/rankings' });
    await fireEvent.press(await headerSelector('Arequipa'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cerrar' }));
    expect(router.getPathname()).toBe('/rankings');
    expect(await headerSelector('Arequipa')).toBeOnTheScreen();
  });

  it('opens Inicio after picking when the picker was opened directly from a link', async () => {
    const router = await renderRouter(routes, { initialUrl: '/region' });
    await fireEvent.press(await screen.findByRole('button', { name: /^(\d+\. )?Cusco,/ }));
    expect(router.getPathname()).toBe('/');
    expect(await headerSelector('Cusco')).toBeOnTheScreen();
  });

  it('starts with all of Peru when nothing was stored on the device', async () => {
    stored = null;
    await renderRouter(routes, { initialUrl: '/rankings' });
    expect(await headerSelector('Todo el Perú')).toBeOnTheScreen();
    expect(screen.getByText('TODO EL PERÚ ▾')).toBeOnTheScreen();
  });

  it('selects all of Peru from the picker and keeps the choice on the device', async () => {
    const router = await renderRouter(routes, { initialUrl: '/rankings' });
    await fireEvent.press(await headerSelector('Arequipa'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Todo el Perú, las 25 regiones' }));
    expect(router.getPathname()).toBe('/rankings');
    expect(await headerSelector('Todo el Perú')).toBeOnTheScreen();
    expect(saved).toEqual([NATIONAL]);
  });

  it('shows the national home and selects a region from its regions block without leaving Inicio', async () => {
    stored = NATIONAL;
    const router = await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('EL MAYOR AUMENTO DEL PAÍS')).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'REGIONES CON MÁS AUMENTOS' })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: /^1\. Arequipa,/ }));
    expect(router.getPathname()).toBe('/');
    expect(await headerSelector('Arequipa')).toBeOnTheScreen();
    expect(await screen.findByText('EL MAYOR AUMENTO DE LA REGIÓN')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'REGIONES CON MÁS AUMENTOS' })).toBeNull();
    expect(saved).toEqual([department(4)]);
  });

  it('opens the picker from the regions block on the national home', async () => {
    stored = NATIONAL;
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver las 25 regiones' }));
    expect(router.getPathname()).toBe('/region');
  });

  it('opens the default ranking from an old link to the removed Regiones tab', async () => {
    await renderRouter(routes, { initialUrl: '/rankings?tab=regions' });
    expect(await screen.findByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.queryByRole('tab', { name: 'Regiones' })).toBeNull();
    expect(screen.queryByLabelText('Ordenar regiones por')).toBeNull();
  });
});
