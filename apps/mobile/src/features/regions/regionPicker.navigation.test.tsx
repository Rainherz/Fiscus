import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import Rankings from '@/app/(tabs)/rankings';
import Region from '@/app/region';
import { DepartmentProvider } from '@/features/department/DepartmentContext';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

/** The real tabs layout, Rankings and region picker inside a root stack with the app's providers. */
function RootLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const repository = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, costChanges: MOCK_COST_CHANGES, lastRun: null });
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo>
        <DepartmentProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DepartmentProvider>
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
  region: Region,
};

const headerSelector = (name: string) => screen.findByRole('button', { name: `Cambiar región. Región actual: ${name}` });

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

  it('opens the default ranking from an old link to the removed Regiones tab', async () => {
    await renderRouter(routes, { initialUrl: '/rankings?tab=regions' });
    expect(await screen.findByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.queryByRole('tab', { name: 'Regiones' })).toBeNull();
    expect(screen.queryByLabelText('Ordenar regiones por')).toBeNull();
  });
});
