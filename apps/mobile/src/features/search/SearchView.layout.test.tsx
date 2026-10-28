import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { arequipa } from '@/test/fixtures';

import { SearchView } from './SearchView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const hidden = { includeHiddenElements: true };
const onPressInvestment = jest.fn();
const renderSearch = () =>
  render(
    <SearchView
      text="vial"
      departmentName={null}
      results={arequipa}
      status="success"
      onChangeText={jest.fn()}
      onRetry={jest.fn()}
      onPressInvestment={onPressInvestment}
    />,
  );

describe('SearchView layout', () => {
  it('lists results as rows on phones', async () => {
    windowWidth(390);
    await renderSearch();
    expect(screen.queryByTestId('table-header', hidden)).toBeNull();
  });

  it('shows the results as a table on desktop, the search field kept at a readable width', async () => {
    windowWidth(1440);
    await renderSearch();
    expect(screen.getByTestId('table-header', hidden)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('search-header').props.style)).toMatchObject({ maxWidth: 720 });
    await fireEvent.press(
      screen.getByRole('button', {
        name: '1. Majes Siguas II etapa, Gobierno regional, Arequipa, CUI 2088142, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M, % +285%',
      }),
    );
    expect(onPressInvestment).toHaveBeenCalledWith('2088142');
  });
});
