import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import Home from '@/app/(tabs)/index';
import InvestmentDetail from '@/app/investment/[cui]';
import MapRoute from '@/app/map';
import { NATIONAL } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

import type { LeafletMapProps } from './LeafletMap';

let mockMap: LeafletMapProps | null = null;
jest.mock('./LeafletMap', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LeafletMap: (props: LeafletMapProps) => {
      mockMap = props;
      return <MockView testID="leaflet-map" />;
    },
  };
});

function RootLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const repository = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, costChanges: MOCK_COST_CHANGES, lastRun: null });
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo>
        <ScopeProvider storage={{ load: async () => NATIONAL, save: async () => {} }}>
          <ScopeGate>
            <Stack screenOptions={{ headerShown: false }} />
          </ScopeGate>
        </ScopeProvider>
      </RepositoryProvider>
    </QueryClientProvider>
  );
}

const routes = {
  _layout: RootLayout,
  index: Home,
  map: MapRoute,
  'investment/[cui]': InvestmentDetail,
};

describe('map entry points', () => {
  beforeEach(() => {
    mockMap = null;
  });

  it('opens the map from home', async () => {
    const router = await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Ver en el mapa' }));
    expect(await screen.findByTestId('leaflet-map')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/map');
    expect(mockMap?.html).toContain('"kind":"bounds"');
  });

  it('opens the map centered on a project with coordinates from its detail', async () => {
    const router = await renderRouter(routes, { initialUrl: '/investment/2088142' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Ver en el mapa' }));
    expect(await screen.findByTestId('leaflet-map')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/map');
    expect(router.getSearchParams()).toEqual({ cui: '2088142' });
    expect(mockMap?.highlightCui).toBe('2088142');
  });

  it('offers no map link on the detail of a project without coordinates', async () => {
    await renderRouter(routes, { initialUrl: '/investment/9900101' });
    expect(await screen.findByText('CUI 9900101')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Ver en el mapa' })).toBeNull();
  });
});
