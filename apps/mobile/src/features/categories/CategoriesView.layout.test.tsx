import { fireEvent, render, screen } from '@testing-library/react-native';

import { CategoriesView } from './CategoriesView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const summaries = [
  { function: 'TRANSPORTE', investmentCount: 120, totalUpdatedCost: 3_000_000_000, totalCostIncrease: 900_000_000 },
  { function: 'EDUCACIÓN', investmentCount: 1, totalUpdatedCost: 2_000_000, totalCostIncrease: null },
  { function: 'SALUD', investmentCount: 4, totalUpdatedCost: 9_000_000, totalCostIncrease: null },
  { function: null, investmentCount: 3, totalUpdatedCost: null, totalCostIncrease: null },
];

const renderCategories = (onPressCategory = jest.fn()) =>
  render(<CategoriesView summaries={summaries} status="success" onRetry={() => {}} onPressCategory={onPressCategory} />);

describe('CategoriesView layout', () => {
  it('lists rows on phones', async () => {
    windowWidth(390);
    await renderCategories();
    expect(screen.queryAllByTestId('category-card')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^TRANSPORTE, 120 proyectos/ })).toBeOnTheScreen();
  });

  it('shows a grid of cards, three per row on desktop', async () => {
    windowWidth(1440);
    const onPressCategory = jest.fn();
    await renderCategories(onPressCategory);
    expect(screen.getAllByTestId('category-card')).toHaveLength(4);
    expect(screen.getAllByTestId('category-grid-row')[0].children).toHaveLength(3);
    await fireEvent.press(screen.getByRole('button', { name: /^TRANSPORTE, 120 proyectos/ }));
    expect(onPressCategory).toHaveBeenCalledWith('TRANSPORTE');
  });

  it('shows two cards per row on tablets', async () => {
    windowWidth(1024);
    await renderCategories();
    expect(screen.getAllByTestId('category-grid-row')[0].children).toHaveLength(2);
  });
});
