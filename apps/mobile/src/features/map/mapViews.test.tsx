import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MapListItem, MapPoint } from '@/features/investments/domain/mapPoints';

import { MapControls } from './MapControls';
import { MapLegend } from './MapLegend';
import { MapPointCard } from './MapPointCard';
import { MapProjectList, type MapListState } from './MapProjectList';
import { MapScreenView } from './MapScreenView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });

beforeEach(() => windowWidth(390));

const point: MapPoint = {
  cui: '2088142',
  name: 'Majes Siguas II etapa',
  latitude: -16.35,
  longitude: -72.15,
  governmentLevel: 'GR',
  costIncrease: 3_809_492_486,
  costIncreasePct: 284.6,
  updatedCostValid: true,
};

const item = (cui: string, extra: Partial<MapListItem> = {}): MapListItem => ({
  ...point,
  cui,
  name: `Proyecto ${cui}`,
  entity: 'GOBIERNO REGIONAL AREQUIPA',
  status: 'ACTIVO',
  updatedCost: 5_147_912_126,
  accruedTotal: 926_624_183,
  executionProgress: 0.18,
  spentAnomaly: false,
  physicalProgress: null,
  lastAccrualMonth: '2026-10-01',
  stalled: false,
  ...extra,
});

describe('MapLegend', () => {
  it('names what each mark means, as text', async () => {
    await render(<MapLegend collapsible={false} />);
    expect(screen.getByText('Con aumento de costo')).toBeOnTheScreen();
    expect(screen.getByText('Sin aumento')).toBeOnTheScreen();
    expect(screen.getByText('Grupo de proyectos (toca para acercar)')).toBeOnTheScreen();
    expect(screen.getByText('Proyecto cerrado (círculo hueco)')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /leyenda/ })).toBeNull();
  });

  it('collapses and expands on phones', async () => {
    await render(<MapLegend collapsible />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar leyenda' }));
    expect(screen.queryByText('Con aumento de costo')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar leyenda' }));
    expect(screen.getByText('Con aumento de costo')).toBeOnTheScreen();
  });
});

describe('MapControls', () => {
  const setup = (filters: ('increase' | 'stalled' | 'overspent')[] = []) => {
    const handlers = { onPressScope: jest.fn(), onSelectLevel: jest.fn(), onToggleFilter: jest.fn() };
    return {
      handlers,
      view: render(<MapControls scopeLabel="Arequipa" level="ALL" filters={filters} {...handlers} />),
    };
  };

  it('shows the scope as a link to the region picker', async () => {
    const { handlers, view } = setup();
    await view;
    await fireEvent.press(screen.getByRole('link', { name: 'Región: Arequipa. Cambiar región' }));
    expect(handlers.onPressScope).toHaveBeenCalled();
  });

  it('selects the level of government', async () => {
    const { handlers, view } = setup();
    await view;
    expect(screen.getByRole('tab', { name: 'Todos' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Local' }));
    expect(handlers.onSelectLevel).toHaveBeenCalledWith('GL');
  });

  it('toggles the filter chips, announced as checked', async () => {
    const { handlers, view } = setup(['stalled']);
    await view;
    expect(screen.getByRole('checkbox', { name: 'Sin gasto reciente' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Con aumento' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Gastó más que su costo' }));
    expect(handlers.onToggleFilter).toHaveBeenCalledWith('overspent');
  });

  it('has no stalled chip when only closed projects are shown', async () => {
    const handlers = { onPressScope: jest.fn(), onSelectLevel: jest.fn(), onToggleFilter: jest.fn() };
    await render(<MapControls scopeLabel="Arequipa" level="ALL" filters={['stalled']} hiddenFilters={['stalled']} {...handlers} />);
    expect(screen.queryByRole('checkbox', { name: 'Sin gasto reciente' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Con aumento' })).toBeOnTheScreen();
  });
});

describe('MapProjectList', () => {
  const render_ = (list: MapListState, selectedCui: string | null = null) => {
    const handlers = { onPressItem: jest.fn(), onLoadMore: jest.fn(), onRetry: jest.fn() };
    return {
      handlers,
      view: render(<MapProjectList list={list} filtered={false} selectedCui={selectedCui} {...handlers} />),
    };
  };

  it('lists the projects of the view with their increase and the count', async () => {
    const { handlers, view } = render_({ kind: 'ready', items: [item('1'), item('2', { costIncrease: 0, costIncreasePct: 0 })], total: 2, hasMore: false, loadingMore: false });
    await view;
    expect(screen.getByText('2 PROYECTOS EN ESTA ZONA')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 3,809 M')).toBeOnTheScreen();
    expect(screen.getByText('Sin aumento')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^1\. Proyecto 1, Gobierno regional, aumento \+S\/ 3,809 M/ }));
    expect(handlers.onPressItem).toHaveBeenCalledWith(expect.objectContaining({ cui: '1' }));
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('marks the selected project', async () => {
    const { view } = render_({ kind: 'ready', items: [item('1')], total: 1, hasMore: false, loadingMore: false }, '1');
    await view;
    expect(screen.getByRole('button', { name: /^1\. Proyecto 1/ })).toBeSelected();
  });

  it('loads more pages', async () => {
    const { handlers, view } = render_({ kind: 'ready', items: [item('1')], total: 31, hasMore: true, loadingMore: false });
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Cargar más' }));
    expect(handlers.onLoadMore).toHaveBeenCalled();
  });

  it('shows the next page loading', async () => {
    const { view } = render_({ kind: 'ready', items: [item('1')], total: 31, hasMore: true, loadingMore: true });
    await view;
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('has loading, empty and error states', async () => {
    const { view, handlers } = render_({ kind: 'error' });
    await view;
    expect(screen.getByText('No se pudo cargar la lista.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(handlers.onRetry).toHaveBeenCalled();

    await render(<MapProjectList list={{ kind: 'loading' }} filtered={false} selectedCui={null} onPressItem={jest.fn()} onLoadMore={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await render(<MapProjectList list={{ kind: 'ready', items: [], total: 0, hasMore: false, loadingMore: false }} filtered selectedCui={null} onPressItem={jest.fn()} onLoadMore={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText('No hay proyectos que cumplan los filtros en esta zona.')).toBeOnTheScreen();
  });
});

describe('MapPointCard', () => {
  const card = (details: MapListItem | null, detailsStatus: 'loading' | 'ready' | 'error' = 'ready') =>
    render(<MapPointCard point={point} details={details} detailsStatus={detailsStatus} onPressDetail={jest.fn()} onClose={jest.fn()} />);

  it('shows the project, its entity, increase, cost, spent share, physical progress and stalled line', async () => {
    await card(item('2088142', { name: 'Majes Siguas II etapa', physicalProgress: 42, stalled: true, lastAccrualMonth: '2025-02-01' }));
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gobierno regional')).toBeOnTheScreen();
    expect(screen.getByText('GOBIERNO REGIONAL AREQUIPA')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 3,809 M · +285%')).toBeOnTheScreen();
    expect(screen.getByText('COSTO ACTUAL S/ 5,148 M')).toBeOnTheScreen();
    expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
    expect(screen.getByText('AVANCE FÍSICO 42 %')).toBeOnTheScreen();
    expect(screen.getByText('Sin gasto desde feb 2025')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver detalle: Majes Siguas II etapa' })).toBeOnTheScreen();
  });

  it('explains the increase and every figure line with term hints', async () => {
    await card(item('2088142', { physicalProgress: 42, stalled: true, lastAccrualMonth: '2025-02-01' }));
    for (const term of ['Aumento de costo', 'Costo actualizado', 'Gastado % del costo', 'Avance físico', 'Sin gasto reciente']) {
      expect(screen.getByRole('button', { name: `Qué significa ${term}` })).toBeOnTheScreen();
    }
  });

  it('says when the cost is not valid in the source', async () => {
    await render(
      <MapPointCard
        point={{ ...point, updatedCostValid: false, costIncrease: null, costIncreasePct: null }}
        details={item('2088142', { updatedCostValid: false, costIncrease: null, costIncreasePct: null })}
        detailsStatus="ready"
        onPressDetail={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Costo actualizado no válido en la fuente MEF')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Qué significa Costo actualizado no válido' })).toBeOnTheScreen();
    expect(screen.queryByText(/^GASTADO/)).toBeNull();
  });

  it('shows the point while the rest of the figures load, and says when they fail', async () => {
    await card(null, 'loading');
    expect(screen.getByText('+S/ 3,809 M · +285%')).toBeOnTheScreen();
    expect(screen.getByText('Cargando datos del proyecto…')).toBeOnTheScreen();
    await card(null, 'error');
    expect(screen.getByText('No se pudieron cargar los demás datos del proyecto.')).toBeOnTheScreen();
  });
});

describe('MapScreenView layout', () => {
  const props = (extra: Partial<Parameters<typeof MapScreenView>[0]> = {}): Parameters<typeof MapScreenView>[0] => ({
    controls: <Text>controles</Text>,
    status: { kind: 'idle' },
    map: <Text>mapa</Text>,
    list: { kind: 'ready', items: [item('1'), item('2')], total: 2, hasMore: false, loadingMore: false },
    filtered: false,
    selected: null,
    onPressItem: jest.fn(),
    onLoadMore: jest.fn(),
    onRetryList: jest.fn(),
    onRetry: jest.fn(),
    onPressDetail: jest.fn(),
    onCloseCard: jest.fn(),
    onPressList: jest.fn(),
    onBack: jest.fn(),
    ...extra,
  });

  it('shows the list in a side panel from 768 px, with the legend always open', async () => {
    windowWidth(1280);
    await render(<MapScreenView {...props()} />);
    expect(screen.getByTestId('map-side-panel')).toBeOnTheScreen();
    expect(screen.getByText('Proyecto 1')).toBeOnTheScreen();
    expect(screen.getByText('Con aumento de costo')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /leyenda/ })).toBeNull();
  });

  it('on phones, starts with a collapsed sheet that counts the projects and expands to the list', async () => {
    const onPressItem = jest.fn();
    await render(<MapScreenView {...props({ onPressItem })} />);
    expect(screen.queryByTestId('map-side-panel')).toBeNull();
    expect(screen.queryByText('Proyecto 1')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Ver lista: 2 proyectos en esta zona' });
    expect(toggle).not.toBeExpanded();
    await fireEvent.press(toggle);
    expect(screen.getByText('Proyecto 1')).toBeOnTheScreen();
    // Picking a project closes the sheet so its card and the map are visible.
    await fireEvent.press(screen.getByRole('button', { name: /^2\. Proyecto 2/ }));
    expect(onPressItem).toHaveBeenCalledWith(expect.objectContaining({ cui: '2' }));
    expect(screen.queryByText('Proyecto 1')).toBeNull();
  });

  it('shows the card of the selected project', async () => {
    await render(<MapScreenView {...props({ selected: { point, details: null, detailsStatus: 'loading' } })} />);
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
  });
});
