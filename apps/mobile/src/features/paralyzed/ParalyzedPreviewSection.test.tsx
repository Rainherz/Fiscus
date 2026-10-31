import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ParalyzedInvestment } from '@/features/investments/domain/paralyzed';

import { ParalyzedPreviewSection } from './ParalyzedPreviewSection';

const NOW = new Date('2026-10-30T15:00:00Z');
const EDITION = { editionCutoff: '2026-06-30', publishedAt: '2026-08-17' };

const item = (cui: string, name: string | null, balance: number): ParalyzedInvestment => ({
  cui,
  editionCutoff: '2026-06-30',
  publishedAt: '2026-08-17',
  obraCount: 1,
  mainCausalLabel: 'INCUMPLIMIENTO DE CONTRATO',
  minPhysicalProgress: 40,
  maxPhysicalProgress: 40,
  totalRemainingWorkBalance: balance,
  infobrasCodes: [1],
  name,
  entity: null,
  departmentCode: 4,
  governmentLevel: 'GR',
  status: 'ACTIVO',
});

const items = [item('1', 'Hospital regional', 12_000_000), item('2', null, 900_000)];

describe('ParalyzedPreviewSection', () => {
  it('shows the count in the scope, the first rows and the edition', async () => {
    await render(
      <ParalyzedPreviewSection
        state={{ status: 'success', total: 14, items, edition: EDITION }}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByRole('header', { name: 'PARALIZADAS SEGÚN LA CONTRALORÍA' })).toBeOnTheScreen();
    expect(screen.getByText('14 proyectos en la región')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: '1. Hospital regional, Gobierno regional, Incumplimiento de contrato, Avance físico 40 % · S/ 12.0 M saldo de obra',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^2\. Sin nombre/ })).toBeOnTheScreen();
    expect(
      screen.getByText('Corte: junio 2026 (hace 4 meses) · publicado 17/08/2026. Fuente: Contraloría General de la República.'),
    ).toBeOnTheScreen();
  });

  it('shows the region of every row for all of Peru and opens rows and the full list', async () => {
    const onPressInvestment = jest.fn();
    const onPressSeeAll = jest.fn();
    await render(
      <ParalyzedPreviewSection
        state={{ status: 'success', total: 1234, items, edition: EDITION }}
        now={NOW}
        national
        onPressInvestment={onPressInvestment}
        onPressSeeAll={onPressSeeAll}
      />,
    );
    expect(screen.getByText('1,234 proyectos en el país')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^1\. Hospital regional, Gobierno regional, Arequipa · / }));
    expect(onPressInvestment).toHaveBeenCalledWith('1');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas las obras paralizadas según la Contraloría' }));
    expect(onPressSeeAll).toHaveBeenCalled();
  });

  it('states when no project of the scope is in the report, with the edition', async () => {
    await render(
      <ParalyzedPreviewSection
        state={{ status: 'success', total: 0, items: [], edition: EDITION }}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByText('Ningún proyecto de este ámbito figura en el último informe de obras paralizadas.')).toBeOnTheScreen();
    expect(screen.getByText(/^Corte: junio 2026/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Ver todas/ })).toBeNull();
  });

  it('shows nothing before the first edition is loaded', async () => {
    await render(
      <ParalyzedPreviewSection
        state={{ status: 'success', total: 0, items: [], edition: null }}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it('shows loading and error states with a retry', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(
      <ParalyzedPreviewSection state={{ status: 'pending' }} now={NOW} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
    await rerender(
      <ParalyzedPreviewSection state={{ status: 'error', onRetry }} now={NOW} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    expect(screen.getByText('No se pudieron cargar las obras paralizadas.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
