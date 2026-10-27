import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RecentCostIncrease } from '@/features/investments/domain/costChange';

import { RecentIncreasesSection } from './RecentIncreasesSection';

const increase = (input: Partial<RecentCostIncrease> & Pick<RecentCostIncrease, 'id' | 'cui'>): RecentCostIncrease => ({
  kind: 'changed',
  observedAt: '2026-11-17T10:00:00Z',
  sourceUpdatedAt: null,
  previousViableAmount: null,
  viableAmount: null,
  previousUpdatedCost: null,
  updatedCost: null,
  accruedTotal: null,
  updatedCostDelta: null,
  name: null,
  ...input,
});

const items = [
  increase({ id: 3, cui: '2088142', name: 'Majes Siguas II etapa', updatedCostDelta: 2_500_000 }),
  increase({ id: 2, cui: '2088142', name: 'Majes Siguas II etapa', observedAt: '2026-11-03T10:00:00Z', updatedCostDelta: 44_000_000 }),
  increase({ id: 1, cui: '1', name: null, observedAt: '2026-11-01T10:00:00Z', updatedCostDelta: 950_000 }),
];

const EMPTY =
  'Aún no hay cambios registrados. Fiscus revisa los costos todos los días desde el 27/10/2026.';

describe('RecentIncreasesSection', () => {
  it('lists recent increases with name, date and signed delta', async () => {
    await render(<RecentIncreasesSection state={{ status: 'success', items }} onPressInvestment={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'AUMENTOS RECIENTES' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Majes Siguas II etapa, 17/11/2026, +S/ 2.5 M' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Majes Siguas II etapa, 03/11/2026, +S/ 44.0 M' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sin nombre, 01/11/2026, +S/ 950 mil' })).toBeOnTheScreen();
    expect(screen.getByText('+S/ 44.0 M')).toBeOnTheScreen();
    expect(screen.getByText('03/11/2026')).toBeOnTheScreen();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('opens the investment when a row is pressed', async () => {
    const onPressInvestment = jest.fn();
    await render(<RecentIncreasesSection state={{ status: 'success', items }} onPressInvestment={onPressInvestment} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Sin nombre/ }));
    expect(onPressInvestment).toHaveBeenCalledWith('1');
  });

  it('states that no changes have been recorded yet', async () => {
    await render(<RecentIncreasesSection state={{ status: 'success', items: [] }} onPressInvestment={jest.fn()} />);
    expect(screen.getByText(EMPTY)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows loading and error states with a retry', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(
      <RecentIncreasesSection state={{ status: 'pending' }} onPressInvestment={jest.fn()} />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(<RecentIncreasesSection state={{ status: 'error', onRetry }} onPressInvestment={jest.fn()} />);
    expect(screen.getByText('No se pudieron cargar los aumentos recientes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
