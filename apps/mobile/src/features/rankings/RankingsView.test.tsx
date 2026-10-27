import { fireEvent, render, screen } from '@testing-library/react-native';

import { NOW, arequipa } from '@/test/fixtures';

import { RankingsView } from './RankingsView';

const baseProps = {
  items: arequipa,
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
    await render(<RankingsView {...baseProps} kind="increase-amount" />);
    expect(screen.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, +S/ 3,809 M' })).toBeOnTheScreen();
    expect(screen.queryByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeNull();
  });

  it('explains the minimum approved amount on the percentage ranking', async () => {
    await render(<RankingsView {...baseProps} kind="increase-pct" />);
    expect(screen.getByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, +285%' })).toBeOnTheScreen();
  });

  it('switches rankings', async () => {
    const onSelectKind = jest.fn();
    await render(<RankingsView {...baseProps} kind="increase-amount" onSelectKind={onSelectKind} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mayor costo' }));
    expect(onSelectKind).toHaveBeenCalledWith('cost');
  });

  it('shows loading, error and empty states', async () => {
    const { rerender } = await render(
      <RankingsView {...baseProps} kind="cost" items={[]} status="pending" />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(<RankingsView {...baseProps} kind="cost" items={[]} status="error" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(baseProps.onRetry).toHaveBeenCalled();

    await rerender(<RankingsView {...baseProps} kind="cost" items={[]} status="success" />);
    expect(screen.getByText('No hay proyectos para este ranking en esta región.')).toBeOnTheScreen();
  });
});
