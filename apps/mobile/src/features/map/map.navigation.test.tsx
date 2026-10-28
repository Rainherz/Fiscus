import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import MapRoute from '@/app/map';
import { department, NATIONAL, type Scope } from '@/features/department/scope';
import { ScopeProvider } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS } from '@/features/investments/adapters/sampleData';
import type { InvestmentsRepository } from '@/features/investments/ports/InvestmentsRepository';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

import type { MapEvent } from './mapBridge';
import type { LeafletMapProps } from './LeafletMap';
import { DEPARTMENT_BOUNDS, PERU_VIEW } from './mapRequest';

// The WebView cannot run in Jest: a stand-in records the props and lets tests play page events.
let mockMap: LeafletMapProps | null = null;
jest.mock('./LeafletMap', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LeafletMap: (props: LeafletMapProps) => {
      mockMap = props;
      return <MockView testID="leaflet-map" accessibilityLabel={props.accessibilityLabel} />;
    },
  };
});

const emit = async (event: MapEvent) => {
  await act(async () => mockMap!.onEvent(event));
};

const AREQUIPA_VIEW = { minLat: -17.3, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };

let stored: Scope = NATIONAL;
const storage: ScopeStorage = { load: async () => stored, save: async () => {} };
let repository: InvestmentsRepository;

beforeEach(() => {
  mockMap = null;
  stored = NATIONAL;
  repository = createInMemoryInvestmentsRepository({ rows: MOCK_ROWS, costChanges: MOCK_COST_CHANGES, lastRun: null });
});

function RootLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  index: placeholder('Inicio'),
  rankings: placeholder('Rankings'),
  map: MapRoute,
  'investment/[cui]': placeholder('Detalle'),
};

const openMap = async (url = '/map') => {
  const router = await renderRouter(routes, { initialUrl: url });
  await screen.findByTestId('leaflet-map');
  return router;
};

describe('map screen', () => {
  it('opens on all of Peru with an accessible label and the coverage note', async () => {
    await openMap();
    expect(mockMap!.html).toContain(JSON.stringify({ kind: 'bounds', bbox: PERU_VIEW }));
    expect(screen.getByLabelText(/^Mapa de proyectos con coordenadas/)).toBeOnTheScreen();
    expect(screen.getByText('Solo proyectos con coordenadas registradas en el MEF (≈77 %).')).toBeOnTheScreen();
  });

  it('frames the department of the scope and asks only for its projects', async () => {
    stored = department(4);
    const spy = jest.spyOn(repository, 'getMapPoints');
    await openMap();
    expect(mockMap!.html).toContain(JSON.stringify({ kind: 'bounds', bbox: DEPARTMENT_BOUNDS[4] }));
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 7 });
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ departmentCode: 4, zoom: 7 })));
  });

  it('loads the projects of the view after the map stops moving and sends them to the map', async () => {
    let resolve: () => void = () => {};
    const gate = new Promise<void>((r) => (resolve = r));
    const original = repository.getMapPoints;
    repository.getMapPoints = async (request) => {
      await gate;
      return original(request);
    };
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 6.2 });
    expect(await screen.findByText('Cargando…')).toBeOnTheScreen();
    resolve();
    await waitFor(() => expect(mockMap!.features.length).toBeGreaterThan(5));
    expect(mockMap!.features[0]).toEqual(expect.objectContaining({ kind: 'point' }));
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('shows an error in Spanish with a retry', async () => {
    repository.getMapPoints = jest.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ kind: 'points', points: [] });
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 7 });
    expect(await screen.findByText('No se pudieron cargar los proyectos del mapa.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay proyectos con coordenadas en esta zona.')).toBeOnTheScreen();
  });

  it('says when the map itself cannot load', async () => {
    await openMap();
    await emit({ type: 'loadFailed' });
    expect(screen.getByText('No se pudo cargar el mapa. Revisa la conexión a internet.')).toBeOnTheScreen();
  });

  it('opens a card for a tapped project, highlights it and links to its detail', async () => {
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await waitFor(() => expect(mockMap!.features.length).toBeGreaterThan(0));
    await emit({ type: 'pointPressed', cui: '2088142' });
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 3,809 M · +285%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gobierno regional')).toBeOnTheScreen();
    expect(mockMap!.highlightCui).toBe('2088142');
    await emit({ type: 'mapPressed' });
    expect(screen.queryByText('Majes Siguas II etapa')).toBeNull();
    expect(mockMap!.highlightCui).toBeNull();
    await emit({ type: 'pointPressed', cui: '2088142' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalle: Majes Siguas II etapa' }));
    expect(await screen.findByText('Detalle')).toBeOnTheScreen();
  });

  it('ignores a tap on a project that is not on the map', async () => {
    await openMap();
    await emit({ type: 'pointPressed', cui: '123' });
    expect(screen.queryByRole('button', { name: /^Ver detalle/ })).toBeNull();
  });

  it('centers on a project opened from its detail, with its card', async () => {
    await openMap('/map?cui=9900201');
    expect(mockMap!.html).toContain('"kind":"center","latitude":-16.3667,"longitude":-71.55');
    expect(await screen.findByText('Mejoramiento de pistas y veredas en Cayma (demo)')).toBeOnTheScreen();
    expect(mockMap!.highlightCui).toBe('9900201');
  });

  it('links to the list in Rankings', async () => {
    await openMap();
    await fireEvent.press(screen.getByRole('link', { name: 'Ver como lista' }));
    expect(await screen.findByText('Rankings')).toBeOnTheScreen();
  });
});
