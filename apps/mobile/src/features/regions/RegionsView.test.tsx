import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { RegionComparison } from '@/features/investments/domain/regionComparison';

import { RegionsView } from './RegionsView';

function region(code: number, values: Partial<RegionComparison>): RegionComparison {
  return {
    departmentCode: code,
    departmentName: null,
    projectCount: 100,
    activeCount: 90,
    validCostCount: 95,
    totalViableAmount: 1_000_000_000,
    totalUpdatedCost: 1_200_000_000,
    totalCostIncrease: 0,
    projectsWithIncrease: 0,
    costIncreasePct: null,
    overspentCount: 0,
    stalledCount: 0,
    stalledPendingAmount: 0,
    ...values,
  };
}

const regions = [
  region(4, { projectCount: 1638, totalCostIncrease: 3_809_492_486, projectsWithIncrease: 412, stalledCount: 12 }),
  region(8, { totalCostIncrease: 1_200_000_000, projectsWithIncrease: 30 }),
];

const baseProps = {
  sort: 'increase-amount' as const,
  regions,
  status: 'success' as const,
  onSelectTab: jest.fn(),
  onSelectSort: jest.fn(),
  onRetry: jest.fn(),
  onPressRegion: jest.fn(),
};

describe('RegionsView', () => {
  it('shows the Regiones tab of Rankings, the selected sort and the scope of the data', async () => {
    await render(<RegionsView {...baseProps} />);
    const rankings = within(screen.getByLabelText('Rankings'));
    const sorts = within(screen.getByLabelText('Ordenar regiones por'));
    expect(rankings.getByRole('tab', { name: 'Regiones' })).toBeSelected();
    expect(rankings.getByRole('tab', { name: 'Mayor aumento (S/)' })).not.toBeSelected();
    expect(sorts.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.getByText('Solo inversiones de gobiernos regionales. Montos en soles corrientes.')).toBeOnTheScreen();
    expect(screen.getByText('Suma de los aumentos de costo. No descuenta las reducciones.')).toBeOnTheScreen();
  });

  it('lists the regions in the given order with the figure and context of the sort', async () => {
    await render(<RegionsView {...baseProps} />);
    expect(screen.getByRole('button', { name: '1. Arequipa, +S/ 3,809 M' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' })).toBeOnTheScreen();
    expect(screen.getByText('1,638 proyectos · 412 con aumento')).toBeOnTheScreen();
  });

  it('describes count figures with their unit', async () => {
    await render(<RegionsView {...baseProps} sort="stalled" />);
    expect(screen.getByRole('button', { name: '1. Arequipa, 12 sin gasto reciente' })).toBeOnTheScreen();
  });

  it('switches sorts and Rankings tabs, and opens a region', async () => {
    const onSelectSort = jest.fn();
    const onSelectTab = jest.fn();
    const onPressRegion = jest.fn();
    await render(
      <RegionsView {...baseProps} onSelectSort={onSelectSort} onSelectTab={onSelectTab} onPressRegion={onPressRegion} />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Más gasto sobre el costo' }));
    expect(onSelectSort).toHaveBeenCalledWith('overspent');
    await fireEvent.press(screen.getByRole('tab', { name: 'Mayor costo' }));
    expect(onSelectTab).toHaveBeenCalledWith('cost');
    await fireEvent.press(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' }));
    expect(onPressRegion).toHaveBeenCalledWith(8);
  });

  it('shows loading, error and empty states', async () => {
    const { rerender } = await render(<RegionsView {...baseProps} regions={[]} status="pending" />);
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(<RegionsView {...baseProps} regions={[]} status="error" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(baseProps.onRetry).toHaveBeenCalled();

    await rerender(<RegionsView {...baseProps} regions={[]} status="success" />);
    expect(screen.getByText('No hay datos de regiones.')).toBeOnTheScreen();
  });
});
