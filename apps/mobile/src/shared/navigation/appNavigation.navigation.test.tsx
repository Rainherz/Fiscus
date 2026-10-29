import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router as globalRouter, useRouter } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text, View } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import Region from '@/app/region';
import { department, type Scope } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { LevelStorage, ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';
import { BackHeader } from '@/shared/ui/BackHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const storage: ScopeStorage = { load: async (): Promise<Scope> => department(4), save: async () => {} };
const levelStorage: LevelStorage = { load: async () => null, save: async () => {} };

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

/** A pushed screen with the back header, like the project detail. */
function Detail() {
  const router = useRouter();
  return (
    <View>
      <BackHeader onBack={() => router.back()} />
      <Text>Detalle</Text>
    </View>
  );
}

/** A tab screen that opens the pushed one. */
function Rankings() {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/investment/1')}>
      <Text>Abrir detalle</Text>
    </Pressable>
  );
}

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': placeholder('Pantalla de inicio'),
  '(tabs)/rankings': Rankings,
  '(tabs)/categories': placeholder('Pantalla de categorías'),
  '(tabs)/search': placeholder('Pantalla de búsqueda'),
  'investment/[cui]': Detail,
  region: Region,
  guia: placeholder('Pantalla de la guía'),
};

const TAB_LABELS = ['Inicio', 'Rankings', 'Categorías', 'Buscar'];

describe('main navigation placement', () => {
  it('keeps the bottom tab bar on phones, without a header navigation', async () => {
    windowWidth(390);
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('tab', { name: 'Inicio' })).toBeSelected();
    for (const label of TAB_LABELS) expect(screen.getByRole('tab', { name: label })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Secciones')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Rankings' })).toBeNull();
  });

  it.each([1024, 1440])('moves the tabs into the header at %i px and hides the bottom bar', async (width) => {
    windowWidth(width);
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByLabelText('Secciones')).toHaveProp('role', 'navigation');
    for (const label of TAB_LABELS) expect(screen.getByRole('link', { name: label })).toBeOnTheScreen();
    for (const label of TAB_LABELS) expect(screen.queryByRole('tab', { name: label })).toBeNull();
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeSelected();
    expect(screen.getByRole('link', { name: 'Rankings' })).not.toBeSelected();
    // The region selector stays in the header.
    expect(screen.getByRole('button', { name: /^Cambiar región o nivel de gobierno/ })).toBeOnTheScreen();
  });

  it('switches tabs from the header navigation', async () => {
    windowWidth(1440);
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Categorías' }));
    expect(router.getPathname()).toBe('/categories');
    expect(await screen.findByText('Pantalla de categorías')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeSelected();
  });
});

describe('guide in the header', () => {
  it('is a fifth header item on desktop that opens the guide', async () => {
    windowWidth(1440);
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Guía' }));
    expect(router.getPathname()).toBe('/guia');
    expect(await screen.findByText('Pantalla de la guía')).toBeOnTheScreen();
  });

  it.each([390, 1024])('is not in the header at %i px, where it does not fit', async (width) => {
    windowWidth(width);
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByRole('link', { name: 'Fiscus, ir al inicio' });
    expect(screen.queryByRole('link', { name: 'Guía' })).toBeNull();
  });
});

describe('FISCUS home link', () => {
  const homeLink = () => screen.findByRole('link', { name: 'Fiscus, ir al inicio' });

  it.each([390, 1024, 1440])('goes to Inicio from another tab at %i px', async (width) => {
    windowWidth(width);
    const router = await renderRouter(routes, { initialUrl: '/search' });
    await fireEvent.press(await homeLink());
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
  });

  it.each([390, 1440])('goes back to Inicio from a pushed screen without stacking a new one at %i px', async (width) => {
    windowWidth(width);
    const router = await renderRouter(routes, { initialUrl: '/rankings' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Abrir detalle' }));
    expect(router.getPathname()).toBe('/investment/1');
    await fireEvent.press(await homeLink());
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(globalRouter.canGoBack()).toBe(false);
  });

  it('replaces a screen opened directly from a link with Inicio', async () => {
    windowWidth(390);
    const router = await renderRouter(routes, { initialUrl: '/investment/1' });
    await fireEvent.press(await homeLink());
    expect(router.getPathname()).toBe('/');
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(globalRouter.canGoBack()).toBe(false);
  });

  it.each([390, 1440])('goes to Inicio from the region picker at %i px', async (width) => {
    windowWidth(width);
    const router = await renderRouter(routes, { initialUrl: '/rankings' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Cambiar región o nivel de gobierno/ }));
    expect(router.getPathname()).toBe('/region');
    await fireEvent.press(await homeLink());
    expect(router.getPathname()).toBe('/');
    expect(globalRouter.canGoBack()).toBe(false);
  });

  it('is a touch target of at least 44 px', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await homeLink()).toHaveStyle({ minHeight: 44 });
  });
});
