import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import MapRoute from '@/app/map';
import { department, NATIONAL, type Scope } from '@/features/department/scope';
import { ScopeProvider, useScope } from '@/features/department/ScopeContext';
import { ScopeGate } from '@/features/department/ScopeGate';
import type { LevelStorage, ScopeStorage } from '@/features/department/scopeStorage';
import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import { MOCK_COST_CHANGES, MOCK_ROWS, sampleRow } from '@/features/investments/adapters/sampleData';
import type { InvestmentsRepository } from '@/features/investments/ports/InvestmentsRepository';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';

import type { MapEvent } from './mapBridge';
import type { MapCanvasProps } from './MapCanvas';
import { DEPARTMENT_BOUNDS, PERU_VIEW } from './mapRequest';

// The WebView cannot run in Jest: a stand-in records the props and lets tests play page events.
let mockMap: MapCanvasProps | null = null;
jest.mock('./MapCanvas', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MapCanvas: (props: MapCanvasProps) => {
      mockMap = props;
      return <MockView testID="map-canvas" accessibilityLabel={props.accessibilityLabel} />;
    },
  };
});

const emit = async (event: MapEvent) => {
  await act(async () => mockMap!.onEvent(event));
};

const AREQUIPA_VIEW = { minLat: -17.3, minLon: -75.1, maxLat: -14.6, maxLon: -70.8 };

let stored: Scope = NATIONAL;
const storage: ScopeStorage = { load: async () => stored, save: async () => {} };
const levelStorage: LevelStorage = { load: async () => null, save: async () => {} };
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

function Home() {
  const { label, levelLabel } = useScope();
  return <Text>{`Inicio · ${label} · ${levelLabel}`}</Text>;
}

const routes = {
  _layout: RootLayout,
  index: Home,
  rankings: placeholder('Rankings'),
  region: placeholder('Región'),
  map: MapRoute,
  'investment/[cui]': placeholder('Detalle'),
};

const openMap = async (url = '/map') => {
  const router = await renderRouter(routes, { initialUrl: url });
  await screen.findByTestId('map-canvas');
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
    // MapLibre zoom 7 (512-px tiles) is the 256-px tile zoom 8 that map_points expects.
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ departmentCode: 4, zoom: 8 })));
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

describe('map insights', () => {
  const openList = async () => {
    await fireEvent.press(await screen.findByRole('button', { name: /^Ver lista: \d+ proyectos? en esta zona$/ }));
  };

  it('reads the filters from the URL and sends them with the map and the list', async () => {
    const points = jest.spyOn(repository, 'getMapPoints');
    const list = jest.spyOn(repository, 'getMapList');
    await openMap('/map?f=stalled,increase');
    expect(screen.getByRole('checkbox', { name: 'Con aumento' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sin gasto reciente' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Gastó más que su costo' })).not.toBeChecked();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await waitFor(() => expect(points).toHaveBeenCalledWith(expect.objectContaining({ filters: ['increase', 'stalled'] })));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ filters: ['increase', 'stalled'], page: 0 }));
  });

  it('keeps the chips in the URL, so the filtered map can be shared', async () => {
    await openMap();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Gastó más que su costo' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Con aumento' }));
    expect(screen).toHaveSearchParams({ f: 'increase,overspent' });
    expect(screen.getByRole('checkbox', { name: 'Con aumento' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Con aumento' }));
    expect(screen).toHaveSearchParams({ f: 'overspent' });
  });

  it('shows only the stalled projects with the stalled filter, in the map and the list', async () => {
    await openMap('/map?f=stalled');
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await waitFor(() => expect(mockMap!.features.map((f) => f.id).sort()).toEqual(['9900001', '9900002', '9900003']));
    await openList();
    expect(screen.getByText('3 PROYECTOS EN ESTA ZONA')).toBeOnTheScreen();
    expect(screen.getByText('Planta de tratamiento de aguas residuales (demo)')).toBeOnTheScreen();
  });

  it('changes the app level from the map', async () => {
    const points = jest.spyOn(repository, 'getMapPoints');
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
    expect(screen.getByRole('tab', { name: 'Local' })).toBeSelected();
    await waitFor(() => expect(points).toHaveBeenLastCalledWith(expect.objectContaining({ level: 'GL' })));
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByText('Inicio · Todo el Perú · Gobiernos locales')).toBeOnTheScreen();
  });

  it('opens the region picker from the scope', async () => {
    await openMap();
    await fireEvent.press(screen.getByRole('link', { name: 'Región: Todo el Perú. Cambiar región' }));
    expect(await screen.findByText('Región')).toBeOnTheScreen();
  });

  it('lists the projects of the view by cost increase; a row selects it on the map with its card', async () => {
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await openList();
    const rows = await screen.findAllByRole('button', { name: /^\d+\. / });
    expect(rows[0]).toHaveAccessibleName(/^1\. Majes Siguas II etapa, Gobierno regional, aumento \+S\/ 3,809 M/);
    await fireEvent.press(rows[0]);
    expect(mockMap!.highlightCui).toBe('2088142');
    expect(screen.getByText('COSTO ACTUAL S/ 5,148 M')).toBeOnTheScreen();
    expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalle: Majes Siguas II etapa' }));
    expect(await screen.findByText('Detalle')).toBeOnTheScreen();
  });

  it('reads the figures of a project tapped on the map by its CUI', async () => {
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await waitFor(() => expect(mockMap!.features.length).toBeGreaterThan(0));
    await emit({ type: 'pointPressed', cui: '9900201' });
    expect(await screen.findByText('MUNICIPALIDAD DISTRITAL DE CAYMA (demo)')).toBeOnTheScreen();
    expect(screen.getByText('AVANCE FÍSICO 42 %')).toBeOnTheScreen();
  });

  it('pages the list by 30 with "Cargar más"', async () => {
    repository = createInMemoryInvestmentsRepository({
      rows: Array.from({ length: 35 }, (_, i) =>
        sampleRow({ cui: String(100 + i), viable: 1_000, updated: 2_000 + i, coordinates: { latitude: -16.4, longitude: -71.5 } }),
      ),
      lastRun: null,
    });
    await openMap();
    await emit({ type: 'moved', bbox: AREQUIPA_VIEW, zoom: 8 });
    await openList();
    expect(screen.getByText('35 PROYECTOS EN ESTA ZONA')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull());
    expect(screen.getByRole('button', { name: /^35\. Proyecto 100,/ })).toBeOnTheScreen();
  });
});
