import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { majes, uchumayo } from '@/test/fixtures';
import { regionRow } from '@/test/regionComparison';

import { CompareView } from './CompareView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const props = {
  level: 'ALL' as const,
  pair: { a: 4, b: 8 },
  status: 'success' as const,
  regions: [regionRow(4, { totalCostIncrease: 3_809_492_486 }), regionRow(8, { totalCostIncrease: 1_200_000_000 })],
  biggest: {
    a: { status: 'success' as const, investment: majes },
    b: { status: 'success' as const, investment: { ...uchumayo, departmentCode: 8 } },
  },
  onSelect: jest.fn(),
  onSwap: jest.fn(),
  onRetry: jest.fn(),
  onBack: jest.fn(),
  onPressInvestment: jest.fn(),
};

/** Max width of a scroll view's content column. */
const maxWidthOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.contentContainerStyle ?? screen.getByTestId(testID).props.style)
    .maxWidth;

describe('CompareView layout', () => {
  it('keeps the phone column below 768 px', async () => {
    windowWidth(390);
    await render(<CompareView {...props} />);
    expect(maxWidthOf('compare-content')).toBe(640);
  });

  it('widens the comparison on desktop so the bars get longer', async () => {
    windowWidth(1440);
    await render(<CompareView {...props} />);
    expect(maxWidthOf('compare-content')).toBe(1080);
  });

  it('widens the region choice list on desktop', async () => {
    windowWidth(1440);
    await render(<CompareView {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Primera región: Arequipa/ }));
    expect(maxWidthOf('region-choice-list')).toBe(880);
  });
});
