import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { majes, uchumayo } from '@/test/fixtures';
import { regionRow } from '@/test/regionComparison';

import { CompareView } from './CompareView';

const regions = [
  regionRow(4, {
    projectCount: 1638,
    validCostCount: 1600,
    totalCostIncrease: 3_809_492_486,
    projectsWithIncrease: 412,
  }),
  regionRow(8, { projectCount: 819, validCostCount: 800, totalCostIncrease: 1_200_000_000, projectsWithIncrease: 30 }),
];

const baseProps = {
  pair: { a: 4, b: 8 },
  status: 'success' as const,
  regions,
  biggest: {
    a: { status: 'success' as const, investment: majes },
    b: { status: 'success' as const, investment: { ...uchumayo, departmentCode: 8 } },
  },
  onSelect: jest.fn(),
  onSwap: jest.fn(),
  onRetry: jest.fn(),
  onBack: jest.fn(),
  onPressInvestment: jest.fn(),
};

describe('CompareView', () => {
  it('shows both regions in selectors with a swap button between them', async () => {
    await render(<CompareView {...baseProps} />);
    expect(screen.getByRole('header', { name: 'Comparar regiones' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Primera región: Arequipa. Cambiar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Segunda región: Cusco. Cambiar' })).toBeOnTheScreen();
    expect(screen.getByText('AREQUIPA ▾')).toBeOnTheScreen();
    expect(screen.getByText('CUSCO ▾')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Intercambiar regiones' }));
    expect(baseProps.onSwap).toHaveBeenCalled();
  });

  it('prints both values of every metric, grouped in sections', async () => {
    await render(<CompareView {...baseProps} />);
    for (const title of ['TAMAÑO', 'AUMENTOS', 'EJECUCIÓN']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('Proyectos: Arequipa 1,638; Cusco 819')).toBeOnTheScreen();
    expect(screen.getByLabelText('Aumento total (S/): Arequipa +S/ 3,809 M; Cusco +S/ 1,200 M')).toBeOnTheScreen();
    expect(screen.getByLabelText('% de proyectos con aumento: Arequipa 26%; Cusco 4%')).toBeOnTheScreen();
    expect(screen.getByText('1,638')).toBeOnTheScreen();
    expect(screen.getByText('819')).toBeOnTheScreen();
  });

  it('draws mirrored bars proportional to the larger value', async () => {
    await render(<CompareView {...baseProps} />);
    const row = screen.getByLabelText('Proyectos: Arequipa 1,638; Cusco 819');
    expect(within(row).getByTestId('bar-a', { includeHiddenElements: true })).toHaveStyle({ width: '100%' });
    expect(within(row).getByTestId('bar-b', { includeHiddenElements: true })).toHaveStyle({ width: '50%' });
  });

  it('shows the largest increase of each region and opens it', async () => {
    await render(<CompareView {...baseProps} />);
    const card = screen.getByRole('button', { name: /^Mayor aumento en Arequipa: Majes Siguas II etapa/ });
    expect(within(card).getByText('+S/ 3,809 M · +285%')).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(baseProps.onPressInvestment).toHaveBeenCalledWith(majes.cui);
    expect(screen.getByRole('button', { name: /^Mayor aumento en Cusco: Variante de Uchumayo/ })).toBeOnTheScreen();
  });

  it('says when a region has no project with an increase', async () => {
    await render(
      <CompareView {...baseProps} biggest={{ ...baseProps.biggest, b: { status: 'success', investment: null } }} />,
    );
    expect(screen.getByText('Ningún proyecto con aumento de costo.')).toBeOnTheScreen();
  });

  it('asks for two different regions and keeps the selectors usable', async () => {
    const onSelect = jest.fn();
    await render(<CompareView {...baseProps} pair={{ a: 8, b: 8 }} onSelect={onSelect} />);
    expect(screen.getByText('Elige dos regiones distintas.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'TAMAÑO' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Primera región: Cusco. Cambiar' }));
    await fireEvent.press(screen.getByRole('button', { name: /^1\. Arequipa,/ }));
    expect(onSelect).toHaveBeenCalledWith('a', 4);
  });

  it('picks a region for one side from a list, without leaving the comparison', async () => {
    const onSelect = jest.fn();
    await render(<CompareView {...baseProps} onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Segunda región: Cusco. Cambiar' }));
    expect(screen.getByRole('header', { name: 'Segunda región' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M, actual' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Amazonas, sin datos' }));
    expect(onSelect).toHaveBeenCalledWith('b', 1);
    expect(screen.getByRole('header', { name: 'Comparar regiones' })).toBeOnTheScreen();
  });

  it('closes the list without choosing', async () => {
    const onSelect = jest.fn();
    await render(<CompareView {...baseProps} onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Primera región: Arequipa. Cambiar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Proyectos: Arequipa 1,638; Cusco 819')).toBeOnTheScreen();
  });

  it('shows loading and error states with a retry', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(<CompareView {...baseProps} pair={null} status="pending" regions={[]} />);
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
    await rerender(<CompareView {...baseProps} status="error" regions={[]} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Primera región: Arequipa. Cambiar' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('states the scope of the data and goes back', async () => {
    await render(<CompareView {...baseProps} />);
    expect(screen.getByText('Solo inversiones de gobiernos regionales. Montos en soles corrientes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(baseProps.onBack).toHaveBeenCalled();
  });

  it('never ranks the two regions with words', async () => {
    await render(<CompareView {...baseProps} />);
    expect(screen.queryByText(/peor|mejor/i)).toBeNull();
  });
});
