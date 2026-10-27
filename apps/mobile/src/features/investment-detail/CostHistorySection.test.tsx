import { fireEvent, render, screen } from '@testing-library/react-native';

import { MOCK_COST_CHANGES } from '@/features/investments/adapters/sampleData';
import type { CostChange } from '@/features/investments/domain/costChange';
import { mapCostChangeRow } from '@/features/investments/domain/mappers';

import { CostHistorySection } from './CostHistorySection';

const majesHistory: CostChange[] = MOCK_COST_CHANGES.map(mapCostChangeRow).filter((c) => c.cui === '2088142');
const NOTE = 'Fiscus registra cambios desde el 27/10/2026. El MEF no publica el historial anterior.';

describe('CostHistorySection', () => {
  it('shows the baseline and each change with its date, new cost and signed delta', async () => {
    await render(<CostHistorySection state={{ status: 'success', changes: majesHistory }} />);
    expect(screen.getByRole('header', { name: 'HISTORIAL DEL COSTO' })).toBeOnTheScreen();
    expect(screen.getByText('27/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Inicio del registro: S/ 5,101 M')).toBeOnTheScreen();
    expect(screen.getByText('03/11/2026')).toBeOnTheScreen();
    expect(screen.getByText('S/ 5,145 M')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 44.0 M')).toBeOnTheScreen();
    expect(screen.getByText('17/11/2026')).toBeOnTheScreen();
    expect(screen.getByText('S/ 5,148 M')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 2.5 M')).toBeOnTheScreen();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
  });

  it('describes a viable amount change only on the row that changed it', async () => {
    await render(<CostHistorySection state={{ status: 'success', changes: majesHistory }} />);
    expect(screen.getAllByText(/^Monto viable:/)).toHaveLength(1);
    expect(screen.getByText('Monto viable: S/ 1,300 M → S/ 1,338 M')).toBeOnTheScreen();
  });

  it('reads each change as one accessible row', async () => {
    await render(<CostHistorySection state={{ status: 'success', changes: majesHistory }} />);
    expect(
      screen.getByLabelText('17/11/2026: costo actualizado S/ 5,148 M, +S/ 2.5 M. Monto viable: S/ 1,300 M → S/ 1,338 M'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('27/10/2026: Inicio del registro: S/ 5,101 M')).toBeOnTheScreen();
  });

  it('marks decreases with a minus sign', async () => {
    const [baseline, first] = majesHistory;
    const decrease: CostChange = {
      ...first,
      previousUpdatedCost: 5_101_412_126,
      updatedCost: 5_099_412_126,
      updatedCostDelta: -2_000_000,
    };
    await render(<CostHistorySection state={{ status: 'success', changes: [baseline, decrease] }} />);
    expect(screen.getByText('−S/ 2.0 M')).toBeOnTheScreen();
  });

  it('labels an investment that appeared after recording started', async () => {
    const [baseline] = majesHistory;
    await render(
      <CostHistorySection state={{ status: 'success', changes: [{ ...baseline, kind: 'first_seen' }] }} />,
    );
    expect(screen.getByText('Registrado por primera vez: S/ 5,101 M')).toBeOnTheScreen();
  });

  it('says so when nothing has been recorded, and still explains the start date', async () => {
    await render(<CostHistorySection state={{ status: 'success', changes: [] }} />);
    expect(screen.getByText('Aún no hay registros del costo de este proyecto.')).toBeOnTheScreen();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
  });

  it('shows loading and error states with a retry', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(<CostHistorySection state={{ status: 'pending' }} />);
    expect(screen.getByText('Cargando historial…')).toBeOnTheScreen();

    await rerender(<CostHistorySection state={{ status: 'error', onRetry }} />);
    expect(screen.getByText('No se pudo cargar el historial del costo.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
