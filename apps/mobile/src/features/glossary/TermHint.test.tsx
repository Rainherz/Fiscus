import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { popoverPosition } from './popoverPosition';
import { TermHint } from './TermHint';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const DEFINITION =
  'Costo de la inversión cuando fue declarada viable o aprobada, según su ficha técnica o estudio de preinversión.';

describe('TermHint', () => {
  beforeEach(() => jest.mocked(router.push).mockClear());

  it('is a button labeled with the term, with a hit area of at least 44 px', async () => {
    await render(<TermHint term="monto-viable" />);
    const button = screen.getByRole('button', { name: 'Qué significa Monto viable (aprobado)' });
    const { hitSlop, style } = button.props;
    const size = StyleSheet.flatten(style).width as number;
    expect(size + 2 * (hitSlop as number)).toBeGreaterThanOrEqual(44);
    expect(screen.queryByText(DEFINITION)).toBeNull();
  });

  it('opens the definition as a bottom sheet on phones and closes it', async () => {
    windowWidth(390);
    await render(<TermHint term="monto-viable" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Qué significa Monto viable (aprobado)' }));

    expect(screen.getByTestId('term-sheet')).toBeOnTheScreen();
    expect(screen.getByText(DEFINITION)).toBeOnTheScreen();
    expect(screen.getByText('Fiscus lo muestra como «aprobado».')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText(DEFINITION)).toBeNull();
  });

  it('opens a popover on desktop', async () => {
    windowWidth(1440);
    await render(<TermHint term="monto-viable" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Qué significa Monto viable (aprobado)' }));

    expect(screen.getByTestId('term-popover')).toBeOnTheScreen();
    expect(screen.queryByTestId('term-sheet')).toBeNull();
    expect(screen.getByText(DEFINITION)).toBeOnTheScreen();
  });

  it('closes when the backdrop is pressed', async () => {
    await render(<TermHint term="cui" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Qué significa CUI (Código Único de Inversiones)' }));
    // The dialog is modal for screen readers, so the backdrop is hidden from them.
    await fireEvent.press(screen.getByTestId('term-backdrop', { includeHiddenElements: true }));
    expect(screen.queryByTestId('term-sheet')).toBeNull();
  });

  it('links to the full guide', async () => {
    await render(<TermHint term="cui" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Qué significa CUI (Código Único de Inversiones)' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Ver guía completa' }));

    expect(router.push).toHaveBeenCalledWith('/guia');
    expect(screen.queryByTestId('term-sheet')).toBeNull();
  });

  it('marks the rules of Fiscus', async () => {
    await render(<TermHint term="sin-gasto-reciente" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Qué significa Sin gasto reciente' }));
    expect(screen.getByText(/^Regla de Fiscus: proyecto activo/)).toBeOnTheScreen();
  });
});

describe('popoverPosition', () => {
  const window = { width: 1440, height: 900 };

  it('opens below the button, centered on it', () => {
    expect(popoverPosition({ x: 600, y: 200, width: 20, height: 20 }, window)).toEqual({ left: 450, top: 228 });
  });

  it('opens above the button in the lower half of the window', () => {
    expect(popoverPosition({ x: 600, y: 700, width: 20, height: 20 }, window)).toEqual({ left: 450, bottom: 208 });
  });

  it('stays inside the window', () => {
    expect(popoverPosition({ x: 2, y: 100, width: 20, height: 20 }, window)).toMatchObject({ left: 16 });
    expect(popoverPosition({ x: 1430, y: 100, width: 20, height: 20 }, window)).toMatchObject({ left: 1440 - 320 - 16 });
  });

  it('is centered in the window without an anchor', () => {
    expect(popoverPosition(null, window)).toEqual({ left: 560, top: 300 });
  });
});
