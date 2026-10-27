import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleRow } from '@/features/investments/adapters/sampleData';
import { mapInvestmentRow } from '@/features/investments/domain/mappers';
import { toStalledInvestment, type StalledInvestment } from '@/features/investments/domain/stalled';

import { StalledPreviewSection } from './StalledPreviewSection';

const stalled = (cui: string, name: string | null, updated: number, month: string): StalledInvestment =>
  toStalledInvestment(
    mapInvestmentRow(sampleRow({ cui, name, updated, progress: 0.32, lastAccrualMonth: month })),
    '2026-10-01',
  )!;

const items = [
  stalled('1', 'Hospital regional', 297_000_000, '2025-04-01'),
  stalled('2', null, 123_000_000, '2022-10-01'),
];

const EMPTY = 'No hay proyectos activos sin gasto en los últimos 12 meses.';

describe('StalledPreviewSection', () => {
  it('shows the department count and the first rows', async () => {
    await render(
      <StalledPreviewSection
        state={{ status: 'success', total: 14, items }}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByRole('header', { name: 'SIN GASTO RECIENTE' })).toBeOnTheScreen();
    expect(screen.getByText('14 proyectos en la región')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: '1. Hospital regional, Sin gasto desde abr 2025, Gastó 32 % · S/ 202 M por ejecutar',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^2\. Sin nombre, Sin gasto desde oct 2022/ })).toBeOnTheScreen();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('opens a project and the full list', async () => {
    const onPressInvestment = jest.fn();
    const onPressSeeAll = jest.fn();
    await render(
      <StalledPreviewSection
        state={{ status: 'success', total: 14, items }}
        onPressInvestment={onPressInvestment}
        onPressSeeAll={onPressSeeAll}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /^1\. Hospital regional/ }));
    expect(onPressInvestment).toHaveBeenCalledWith('1');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todos los proyectos sin gasto reciente' }));
    expect(onPressSeeAll).toHaveBeenCalled();
  });

  it('states when no project meets the rule', async () => {
    await render(
      <StalledPreviewSection
        state={{ status: 'success', total: 0, items: [] }}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByText(EMPTY)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows loading and error states with a retry', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(
      <StalledPreviewSection state={{ status: 'pending' }} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(
      <StalledPreviewSection
        state={{ status: 'error', onRetry }}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByText('No se pudieron cargar los proyectos sin gasto reciente.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
