import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { NOW, arequipa, majes } from '@/test/fixtures';

import { HomeView } from './HomeView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const renderHome = () =>
  render(
    <HomeView
      hero={majes}
      ranking={arequipa.slice(1)}
      now={NOW}
      national
      onPressInvestment={jest.fn()}
      onPressSeeAll={jest.fn()}
      onPressMap={jest.fn()}
      regions={<Text>Bloque regiones</Text>}
      stalled={<Text>Bloque sin gasto</Text>}
      recentIncreases={<Text>Bloque recientes</Text>}
      footer={<Text>Pie</Text>}
    />,
  );

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('HomeView layout', () => {
  it('keeps the single phone column below 768 px', async () => {
    windowWidth(390);
    await renderHome();
    expect(screen.queryByTestId('home-hero-row')).toBeNull();
    expect(screen.queryByTestId('home-grid')).toBeNull();
    expect(screen.getByText('Bloque regiones')).toBeOnTheScreen();
  });

  it('puts the hero and the ranking side by side on desktop', async () => {
    windowWidth(1440);
    await renderHome();
    expect(flat('home-hero-row')).toMatchObject({ flexDirection: 'row' });
    const row = screen.getByTestId('home-hero-row');
    expect(within(row).getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(within(row).getByRole('header', { name: 'RANKING DE AUMENTOS' })).toBeOnTheScreen();
    expect(within(row).getByRole('link', { name: 'Ver en el mapa' })).toBeOnTheScreen();
  });

  it('lays the blocks out in three columns on desktop, national order kept', async () => {
    windowWidth(1440);
    await renderHome();
    const cells = screen.getAllByTestId('home-grid-cell');
    expect(cells).toHaveLength(3);
    expect(within(cells[0]).getByText('Bloque regiones')).toBeOnTheScreen();
    expect(within(cells[1]).getByText('Bloque sin gasto')).toBeOnTheScreen();
    expect(within(cells[2]).getByText('Bloque recientes')).toBeOnTheScreen();
    expect(StyleSheet.flatten(cells[0].props.style)).toMatchObject({ flexBasis: `${100 / 3}%` });
  });

  it('uses two columns on tablets', async () => {
    windowWidth(1024);
    await renderHome();
    expect(flat('home-hero-row')).toMatchObject({ flexDirection: 'row' });
    const cells = screen.getAllByTestId('home-grid-cell');
    expect(StyleSheet.flatten(cells[0].props.style)).toMatchObject({ flexBasis: '50%' });
  });

  it('caps the content at the layout max width on large screens', async () => {
    windowWidth(1880);
    await renderHome();
    expect(flat('home-column')).toMatchObject({ maxWidth: 1280 });
  });
});
