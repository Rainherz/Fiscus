import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleRow } from '@/features/investments/adapters/sampleData';
import { mapInvestmentRow } from '@/features/investments/domain/mappers';
import { toStalledInvestment } from '@/features/investments/domain/stalled';
import { NOW, arequipa } from '@/test/fixtures';

import { RankingsView } from './RankingsView';

const baseProps = {
  now: NOW,
  status: 'success' as const,
  isFetchingMore: false,
  onSelectKind: jest.fn(),
  onEndReached: jest.fn(),
  onRetry: jest.fn(),
  onPressInvestment: jest.fn(),
};

describe('RankingsView', () => {
  it('renders ranked rows with the metric of the selected ranking', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(screen.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, +S/ 3,809 M' })).toBeOnTheScreen();
    expect(screen.queryByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeNull();
  });

  it('explains the minimum approved amount on the percentage ranking', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-pct', items: arequipa }} />);
    expect(screen.getByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, +285%' })).toBeOnTheScreen();
  });

  it('switches rankings', async () => {
    const onSelectKind = jest.fn();
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} onSelectKind={onSelectKind} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mayor costo' }));
    expect(onSelectKind).toHaveBeenCalledWith('cost');
  });

  it('shows loading, error and empty states', async () => {
    const { rerender } = await render(
      <RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="pending" />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(<RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="error" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(baseProps.onRetry).toHaveBeenCalled();

    await rerender(<RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="success" />);
    expect(screen.getByText('No hay proyectos para este ranking en esta región.')).toBeOnTheScreen();
  });

  it('lists projects without recent spending with the rule in one line', async () => {
    const stalled = toStalledInvestment(
      mapInvestmentRow(
        sampleRow({ cui: '7', name: 'Hospital regional', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
      ),
      '2026-10-01',
    )!;
    const onPressInvestment = jest.fn();
    await render(
      <RankingsView {...baseProps} list={{ kind: 'stalled', items: [stalled] }} onPressInvestment={onPressInvestment} />,
    );
    expect(screen.getByRole('tab', { name: 'Sin gasto reciente' })).toBeSelected();
    expect(
      screen.getByText(
        'Proyectos activos que gastaron entre 5 % y 95 % de su costo y no registran gasto en los últimos 12 meses de datos del MEF.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', {
        name: '1. Hospital regional, Sin gasto desde abr 2025, Gastó 32 % · S/ 202 M por ejecutar',
      }),
    );
    expect(onPressInvestment).toHaveBeenCalledWith('7');
  });

  it('keeps the other rankings and states when no project lacks recent spending', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'stalled', items: [] }} />);
    for (const name of ['Mayor aumento (S/)', 'Mayor aumento (%)', 'Mayor costo', 'Más tiempo en curso']) {
      expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    }
    expect(screen.getByText('No hay proyectos activos sin gasto en los últimos 12 meses.')).toBeOnTheScreen();
  });
});
