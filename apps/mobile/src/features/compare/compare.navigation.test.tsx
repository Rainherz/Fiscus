import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/index';
import Compare from '@/app/compare';
import Region from '@/app/region';
import { department, NATIONAL, type Scope } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

let stored: Scope | null = null;
let saved: Scope[] = [];
const storage: ScopeStorage = {
  load: async () => stored,
  save: async (scope) => {
    saved.push(scope);
  },
};

beforeEach(() => {
  stored = NATIONAL;
  saved = [];
});

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
  '(tabs)/rankings': placeholder('Rankings'),
  '(tabs)/categories': placeholder('Categorías'),
  '(tabs)/search': placeholder('Buscar'),
  region: Region,
  compare: Compare,
  'investment/[cui]': placeholder('Detalle'),
};

const selectorA = (name: string) => screen.findByRole('button', { name: `Primera región: ${name}. Cambiar` });
const selectorB = (name: string) => screen.findByRole('button', { name: `Segunda región: ${name}. Cambiar` });

describe('compare regions', () => {
  it('opens the two regions of a shared link', async () => {
    const router = await renderRouter(routes, { initialUrl: '/compare?a=8&b=4' });
    expect(await selectorA('Cusco')).toBeOnTheScreen();
    expect(await selectorB('Arequipa')).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'TAMAÑO' })).toBeOnTheScreen();
    expect(router.getSearchParams()).toEqual({ a: '8', b: '4' });
  });

  it('replaces invalid codes with the defaults and writes them in the URL', async () => {
    const router = await renderRouter(routes, { initialUrl: '/compare?a=99&b=x' });
    expect(await selectorA('Arequipa')).toBeOnTheScreen();
    expect(await selectorB('Cusco')).toBeOnTheScreen();
    expect(router.getSearchParams()).toEqual({ a: '4', b: '8' });
  });

  it('starts with the current region', async () => {
    stored = department(8);
    await renderRouter(routes, { initialUrl: '/compare' });
    expect(await selectorA('Cusco')).toBeOnTheScreen();
    expect(await selectorB('Arequipa')).toBeOnTheScreen();
  });

  it('swaps the regions in the screen and the URL', async () => {
    const router = await renderRouter(routes, { initialUrl: '/compare?a=4&b=8' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Intercambiar regiones' }));
    expect(await selectorA('Cusco')).toBeOnTheScreen();
    expect(router.getSearchParams()).toEqual({ a: '8', b: '4' });
  });

  it('chooses a region for one side without changing the app region', async () => {
    const router = await renderRouter(routes, { initialUrl: '/compare?a=4&b=8' });
    await fireEvent.press(await selectorB('Cusco'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Puno, sin datos' }));
    expect(await selectorB('Puno')).toBeOnTheScreen();
    expect(router.getSearchParams()).toEqual({ a: '4', b: '21' });
    expect(await screen.findByText('Sin datos para Puno.')).toBeOnTheScreen();
    expect(saved).toEqual([]);
  });

  it('asks for two different regions when both are the same', async () => {
    await renderRouter(routes, { initialUrl: '/compare?a=8&b=8' });
    expect(await screen.findByText('Elige dos regiones distintas.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'TAMAÑO' })).toBeNull();
  });

  it('opens the project with the largest increase of a region', async () => {
    const router = await renderRouter(routes, { initialUrl: '/compare?a=4&b=8' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Mayor aumento en Arequipa:/ }));
    expect(router.getPathname()).toMatch(/^\/investment\//);
  });

  it('opens from the national home, under the regions with more increases', async () => {
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Comparar dos regiones' }));
    expect(router.getPathname()).toBe('/compare');
    expect(await selectorA('Arequipa')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(router.getPathname()).toBe('/');
  });

  it('opens from a region home with that region first', async () => {
    stored = department(8);
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Comparar con otra región' }));
    expect(router.getPathname()).toBe('/compare');
    expect(router.getSearchParams()).toMatchObject({ a: '8' });
    expect(await selectorA('Cusco')).toBeOnTheScreen();
  });

  it('opens from the region picker', async () => {
    const router = await renderRouter(routes, { initialUrl: '/region' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Comparar dos regiones' }));
    expect(router.getPathname()).toBe('/compare');
    expect(await selectorA('Arequipa')).toBeOnTheScreen();
    expect(saved).toEqual([]);
  });
});
