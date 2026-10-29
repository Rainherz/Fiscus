import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DataFooter } from './DataFooter';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

describe('DataFooter', () => {
  it('shows the last update and source', async () => {
    await render(<DataFooter finishedAt="2026-10-26T10:30:00Z" isDemo={false} />);
    expect(screen.getByText('Datos actualizados el 26/10/2026')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Fuentes: MEF – Sistema de Seguimiento de Inversiones; MEF – Datos Abiertos, Detalle de inversiones',
      ),
    ).toBeOnTheScreen();
  });

  it('omits the date when unknown', async () => {
    await render(<DataFooter finishedAt={null} isDemo={false} />);
    expect(screen.queryByText(/Datos actualizados/)).toBeNull();
  });

  it('flags demo data', async () => {
    await render(<DataFooter finishedAt={null} isDemo />);
    expect(screen.getByText('Modo demostración: datos de ejemplo.')).toBeOnTheScreen();
  });

  it('stays a plain block on phones', async () => {
    windowWidth(390);
    await render(<DataFooter finishedAt="2026-10-26T10:30:00Z" isDemo={false} />);
    expect(screen.queryByTestId('page-footer')).toBeNull();
  });

  it('is a page footer on desktop: a full-width rule with sources and the update date in a row', async () => {
    windowWidth(1440);
    await render(<DataFooter finishedAt="2026-10-26T10:30:00Z" isDemo />);
    const footer = screen.getByTestId('page-footer');
    expect(footer).toHaveProp('role', 'contentinfo');
    expect(StyleSheet.flatten(footer.props.style)).toMatchObject({ borderTopWidth: 2 });
    expect(StyleSheet.flatten(screen.getByTestId('page-footer-row').props.style)).toMatchObject({
      flexDirection: 'row',
      maxWidth: 1280,
    });
    expect(screen.getByText('Datos actualizados el 26/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Modo demostración: datos de ejemplo.')).toBeOnTheScreen();
  });

  it.each([390, 1440])('links to the guide at %i px', async (width) => {
    windowWidth(width);
    const onPressGuide = jest.fn();
    await render(<DataFooter finishedAt={null} isDemo={false} onPressGuide={onPressGuide} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Cómo leer estos datos' }));
    expect(onPressGuide).toHaveBeenCalledTimes(1);
  });
});
