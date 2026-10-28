import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { AppHeader } from './AppHeader';
import { HazardProgressBar } from './HazardProgressBar';
import { RankingRow } from './RankingRow';
import { SegmentedTabs } from './SegmentedTabs';
import { StateMessage } from './StateMessage';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });

describe('HazardProgressBar', () => {
  it('exposes the spent share to assistive technologies', async () => {
    await render(<HazardProgressBar ratio={0.18} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAccessibleName('Gastado: 18 por ciento del costo actualizado');
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 18 });
  });

  it('fills proportionally and clamps above 100%', async () => {
    const { rerender } = await render(<HazardProgressBar ratio={0.18} />);
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '18%' });
    await rerender(<HazardProgressBar ratio={1.4} />);
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '100%' });
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(
      'Gastado: 140 por ciento del costo actualizado',
    );
  });

  it('states the overspend below the bar when spending exceeds the updated cost', async () => {
    await render(<HazardProgressBar ratio={1.019} overspend={26_754_508.49} />);
    expect(screen.getByText('Gastó S/ 26.8 M más que su costo actualizado')).toBeOnTheScreen();
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '100%' });
  });

  it('shows no overspend line at or below 100%', async () => {
    await render(<HazardProgressBar ratio={0.5} overspend={0} />);
    expect(screen.queryByText(/más que su costo actualizado/)).toBeNull();
  });

  it('describes unknown progress', async () => {
    await render(<HazardProgressBar ratio={null} />);
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Gastado: sin dato');
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '0%' });
  });
});

describe('RankingRow', () => {
  it('names the selected tag after what the selection means', async () => {
    await render(<RankingRow rank={1} name="Majes" value="+S/ 1 M" selected selectedTag="EN EL MAPA" onPress={() => {}} />);
    expect(screen.getByText('EN EL MAPA')).toBeOnTheScreen();
    expect(screen.queryByText('ACTUAL')).toBeNull();
    expect(screen.getByRole('button')).toHaveAccessibleName('1. Majes, +S/ 1 M, en el mapa');
  });

  it('shows rank, name and value and is pressable', async () => {
    const onPress = jest.fn();
    await render(
      <RankingRow rank={2} name="Variante de Uchumayo" value="+S/ 440 M" onPress={onPress} />,
    );
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('Variante de Uchumayo')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 440 M')).toBeOnTheScreen();

    const button = screen.getByRole('button', { name: '2. Variante de Uchumayo, +S/ 440 M' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a level tag before the detail and announces what it stands for', async () => {
    await render(
      <RankingRow
        rank={3}
        name="Pistas en Cayma"
        value="+S/ 2 M"
        detail="Arequipa · S/ 1 M → S/ 3 M"
        tag={{ text: 'GL', label: 'Gobierno local' }}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('GL')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '3. Pistas en Cayma, Gobierno local, +S/ 2 M' })).toBeOnTheScreen();
  });

  it('labels projects without a name', async () => {
    await render(<RankingRow rank={1} name={null} value="S/ 10 M" onPress={() => {}} />);
    expect(screen.getByText('Sin nombre')).toBeOnTheScreen();
  });

  it('can show several detail lines instead of a value', async () => {
    await render(
      <RankingRow
        rank={1}
        name="Obra"
        detail={['Sin gasto desde abr 2025', 'Gastó 32 % · S/ 202 M por ejecutar']}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText('Sin gasto desde abr 2025')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: '1. Obra, Sin gasto desde abr 2025, Gastó 32 % · S/ 202 M por ejecutar',
      }),
    ).toBeOnTheScreen();
  });

  it('marks the current row for sight and screen readers', async () => {
    await render(<RankingRow rank={1} name="Arequipa" value="+S/ 3,809 M" selected onPress={() => {}} />);
    const row = screen.getByRole('button', { name: '1. Arequipa, +S/ 3,809 M, actual' });
    expect(row).toBeSelected();
    expect(screen.getByText('ACTUAL')).toBeOnTheScreen();
  });

  it('can show a secondary detail line', async () => {
    await render(
      <RankingRow rank={1} name="Obra" value="S/ 10 M" detail="CUI 2088142" onPress={() => {}} />,
    );
    expect(screen.getByText('CUI 2088142')).toBeOnTheScreen();
  });
});

describe('StateMessage', () => {
  it('shows a loading indicator', async () => {
    await render(<StateMessage kind="loading" />);
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
  });

  it('shows an error with a retry action', async () => {
    const onRetry = jest.fn();
    await render(<StateMessage kind="error" onRetry={onRetry} />);
    expect(screen.getByText('No se pudieron cargar los datos.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows a custom empty message', async () => {
    await render(<StateMessage kind="empty" message="No hay proyectos." />);
    expect(screen.getByText('No hay proyectos.')).toBeOnTheScreen();
  });
});

describe('SegmentedTabs', () => {
  beforeEach(() => windowWidth(390));

  const options = [
    { key: 'a', label: 'Mayor aumento (S/)' },
    { key: 'b', label: 'Mayor costo' },
  ] as const;

  it('marks the selected tab and reports selection', async () => {
    const onSelect = jest.fn();
    await render(<SegmentedTabs options={options} selected="a" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Mayor costo' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Mayor costo' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('scrolls the selected tab into view once it is laid out', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    await render(<SegmentedTabs options={options} selected="b" onSelect={jest.fn()} />);
    await fireEvent(screen.getByRole('tab', { name: 'Mayor costo' }), 'layout', {
      nativeEvent: { layout: { x: 600, y: 0, width: 120, height: 48 } },
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 600 - 20, animated: true });
    scrollTo.mockRestore();
  });

  it('scrolls horizontally on phones', async () => {
    windowWidth(390);
    await render(<SegmentedTabs options={options} selected="a" onSelect={jest.fn()} accessibilityLabel="Rankings" />);
    expect(screen.getByLabelText('Rankings').props.horizontal).toBe(true);
  });

  it('wraps onto several lines on wide screens, so no tab is cut off by the content column', async () => {
    windowWidth(1280);
    await render(<SegmentedTabs options={options} selected="a" onSelect={jest.fn()} accessibilityLabel="Rankings" />);
    const tablist = screen.getByLabelText('Rankings');
    expect(tablist.props.horizontal).toBeUndefined();
    expect(tablist).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
  });
});

describe('AppHeader', () => {
  it('shows the brand and the current department as a button', async () => {
    const onPress = jest.fn();
    await render(<AppHeader scopeLabel="Arequipa" levelLabel="Gobiernos locales" onPressScope={onPress} />);
    expect(screen.getByText('FISCUS')).toBeOnTheScreen();
    expect(screen.getByText('AREQUIPA ▾')).toBeOnTheScreen();
    expect(screen.getByText('GOBIERNOS LOCALES')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Cambiar región o nivel de gobierno. Región actual: Arequipa. Nivel: Gobiernos locales',
      }),
    );
    expect(onPress).toHaveBeenCalled();
  });

  it('labels all of Peru', async () => {
    await render(<AppHeader scopeLabel="Todo el Perú" levelLabel="Todos los niveles" onPressScope={jest.fn()} />);
    expect(screen.getByText('TODO EL PERÚ ▾')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Cambiar región o nivel de gobierno. Región actual: Todo el Perú. Nivel: Todos los niveles',
      }),
    ).toBeOnTheScreen();
  });

  it('shows a placeholder instead of a scope while the last choice is being read', async () => {
    const onPress = jest.fn();
    await render(<AppHeader scopeLabel={null} levelLabel={null} onPressScope={onPress} />);
    expect(screen.getByText('FISCUS')).toBeOnTheScreen();
    expect(screen.queryByText(/▾/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Cargando región')).toBeOnTheScreen();
  });
});
