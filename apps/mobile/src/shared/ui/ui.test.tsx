import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppHeader } from './AppHeader';
import { HazardProgressBar } from './HazardProgressBar';
import { RankingRow } from './RankingRow';
import { SegmentedTabs } from './SegmentedTabs';
import { StateMessage } from './StateMessage';

describe('HazardProgressBar', () => {
  it('exposes progress to assistive technologies', async () => {
    await render(<HazardProgressBar ratio={0.18} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAccessibleName('Avance de ejecución: 18 por ciento');
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 18 });
  });

  it('fills proportionally and clamps above 100%', async () => {
    const { rerender } = await render(<HazardProgressBar ratio={0.18} />);
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '18%' });
    await rerender(<HazardProgressBar ratio={1.4} />);
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '100%' });
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(
      'Avance de ejecución: 140 por ciento',
    );
  });

  it('describes unknown progress', async () => {
    await render(<HazardProgressBar ratio={null} />);
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Avance de ejecución: sin dato');
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '0%' });
  });
});

describe('RankingRow', () => {
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

  it('labels projects without a name', async () => {
    await render(<RankingRow rank={1} name={null} value="S/ 10 M" onPress={() => {}} />);
    expect(screen.getByText('Sin nombre')).toBeOnTheScreen();
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
});

describe('AppHeader', () => {
  it('shows the brand and the current department as a button', async () => {
    const onPress = jest.fn();
    await render(<AppHeader departmentName="Arequipa" onPressDepartment={onPress} />);
    expect(screen.getByText('FISCUS')).toBeOnTheScreen();
    expect(screen.getByText('AREQUIPA ▾')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cambiar región. Región actual: Arequipa' }),
    );
    expect(onPress).toHaveBeenCalled();
  });
});
