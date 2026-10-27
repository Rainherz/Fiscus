import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { department, NATIONAL } from '@/features/department/scope';
import type { RegionComparison } from '@/features/investments/domain/regionComparison';

import { RegionPickerView } from './RegionPickerView';

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
  current: department(4),
  onSelectSort: jest.fn(),
  onRetry: jest.fn(),
  onPick: jest.fn(),
  onClose: jest.fn(),
};

describe('RegionPickerView', () => {
  it('is titled as a region picker for all of Peru, with one row of sorts and the scope of the data', async () => {
    await render(<RegionPickerView {...baseProps} />);
    expect(screen.getByRole('header', { name: 'Elegir región' })).toBeOnTheScreen();
    expect(screen.getByText('TODO EL PERÚ')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    const sorts = within(screen.getByLabelText('Ordenar regiones por'));
    expect(sorts.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.queryByText('ORDENAR POR')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Regiones' })).toBeNull();
    expect(screen.getByText('Solo inversiones de gobiernos regionales. Montos en soles corrientes.')).toBeOnTheScreen();
    expect(screen.getByText('Suma de los aumentos de costo. No descuenta las reducciones.')).toBeOnTheScreen();
  });

  it('lists the regions in the given order and marks the current one', async () => {
    await render(<RegionPickerView {...baseProps} />);
    const current = screen.getByRole('button', { name: '1. Arequipa, +S/ 3,809 M, actual' });
    expect(current).toBeSelected();
    expect(within(current).getByText('ACTUAL')).toBeOnTheScreen();
    const other = screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' });
    expect(other).not.toBeSelected();
    expect(screen.getByText('1,638 proyectos · 412 con aumento')).toBeOnTheScreen();
  });

  it('offers all of Peru as the first option, before the ranked regions', async () => {
    const onPick = jest.fn();
    await render(<RegionPickerView {...baseProps} onPick={onPick} />);
    const options = within(screen.getByLabelText('Regiones')).getAllByRole('button');
    expect(options[0]).toHaveAccessibleName('Todo el Perú, las 25 regiones');
    expect(options[0]).not.toBeSelected();
    expect(options[1]).toHaveAccessibleName('1. Arequipa, +S/ 3,809 M, actual');
    await fireEvent.press(options[0]);
    expect(onPick).toHaveBeenCalledWith(NATIONAL);
  });

  it('marks all of Peru as the current choice when it is selected', async () => {
    await render(<RegionPickerView {...baseProps} current={NATIONAL} />);
    const national = screen.getByRole('button', { name: 'Todo el Perú, las 25 regiones, actual' });
    expect(national).toBeSelected();
    expect(within(national).getByText('ACTUAL')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1. Arequipa, +S/ 3,809 M' })).not.toBeSelected();
  });

  it('offers all of Peru while the comparison loads', async () => {
    await render(<RegionPickerView {...baseProps} regions={[]} status="pending" current={NATIONAL} />);
    const options = within(screen.getByLabelText('Regiones')).getAllByRole('button');
    expect(options).toHaveLength(26);
    expect(options[0]).toHaveAccessibleName('Todo el Perú, las 25 regiones, actual');
  });

  it('keeps departments without data selectable after the ranked ones', async () => {
    await render(<RegionPickerView {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Amazonas, sin datos' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /, sin datos$/ })).toHaveLength(23);
  });

  it('switches sorts, picks a region and closes', async () => {
    const onSelectSort = jest.fn();
    const onPick = jest.fn();
    const onClose = jest.fn();
    await render(<RegionPickerView {...baseProps} onSelectSort={onSelectSort} onPick={onPick} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Más gasto sobre el costo' }));
    expect(onSelectSort).toHaveBeenCalledWith('overspent');
    await fireEvent.press(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' }));
    expect(onPick).toHaveBeenCalledWith(department(8));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('still offers every department alphabetically while the comparison loads', async () => {
    const onPick = jest.fn();
    await render(<RegionPickerView {...baseProps} regions={[]} status="pending" onPick={onPick} />);
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Ordenar regiones por')).toBeNull();
    const options = within(screen.getByLabelText('Regiones')).getAllByRole('button');
    expect(options).toHaveLength(26);
    expect(options[1]).toHaveAccessibleName('Amazonas');
    expect(screen.getByRole('button', { name: 'Arequipa, actual' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Cusco' }));
    expect(onPick).toHaveBeenCalledWith(department(8));
  });

  it('still offers every department when the comparison fails, with a retry', async () => {
    const onRetry = jest.fn();
    await render(<RegionPickerView {...baseProps} regions={[]} status="error" onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Ucayali' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
