import { render, screen } from '@testing-library/react-native';

import { majes } from '@/test/fixtures';

import { ShareCard } from './ShareCard';
import { shareCardContent } from './shareCardPresentation';

const content = (overrides = {}) =>
  shareCardContent(
    { ...majes, sourceUpdatedAt: '2026-10-26T15:00:00Z', ...overrides },
    { referenceMonth: '2026-09-01' },
  );

describe('ShareCard', () => {
  it('renders every part of the card at 1080x1350', async () => {
    await render(<ShareCard content={content()} />);
    expect(screen.getByTestId('share-card')).toHaveStyle({ width: 1080, height: 1350 });
    expect(screen.getByText('FISCUS')).toBeOnTheScreen();
    expect(screen.getByText('AREQUIPA')).toBeOnTheScreen();
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(screen.getByText('AUMENTO DEL COSTO')).toBeOnTheScreen();
    expect(screen.getByText('+285%')).toBeOnTheScreen();
    expect(screen.getByText('S/ 1,338 M aprobado en 2008')).toBeOnTheScreen();
    expect(screen.getByText('S/ 5,148 M cuesta hoy')).toBeOnTheScreen();
    expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
    expect(screen.getByTestId('hazard-fill')).toHaveStyle({ width: '18%' });
    expect(
      screen.getByText('CUI 2088142 · Fuente: MEF – Sistema de Seguimiento de Inversiones · Datos al 26/10/2026'),
    ).toBeOnTheScreen();
  });

  it('caps the project name at three lines', async () => {
    await render(<ShareCard content={content()} />);
    expect(screen.getByText('Majes Siguas II etapa')).toHaveProp('numberOfLines', 3);
  });

  it('keeps the figure on one line, sized to fit the card width', async () => {
    await render(<ShareCard content={content({ costIncreasePct: 123_456 })} />);
    const figure = screen.getByText('+123,456%');
    expect(figure).toHaveProp('numberOfLines', 1);
    // 7 digits, comma, sign and percent at the 300 px cap would overflow 960 px; the fit shrinks it.
    expect(figure).not.toHaveStyle({ fontSize: 300 });
  });

  it('shows the invalid-cost notice instead of a figure', async () => {
    await render(
      <ShareCard
        content={content({
          updatedCost: 500,
          updatedCostValid: false,
          costIncrease: null,
          costIncreasePct: null,
          executionProgress: null,
        })}
      />,
    );
    expect(screen.getByText('Costo actualizado no válido en la fuente MEF')).toBeOnTheScreen();
    expect(screen.getByText('El MEF publica S/ 500 como costo actualizado.')).toBeOnTheScreen();
    expect(screen.queryByText(/GASTADO/)).toBeNull();
    expect(screen.queryByTestId('hazard-fill')).toBeNull();
  });

  it('lists the spending notes', async () => {
    await render(<ShareCard content={content({ status: 'ACTIVO', lastAccrualMonth: '2025-04-01' })} />);
    expect(screen.getByText('Sin gasto registrado desde abr 2025 (17 meses).')).toBeOnTheScreen();
  });
});
