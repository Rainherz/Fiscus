import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { department } from '@/features/department/scope';
import { regionRow } from '@/test/regionComparison';

import { RegionPickerView } from './RegionPickerView';

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
  onSelectLevel: jest.fn(),
  sort: 'increase-amount' as const,
  regions: [regionRow(4, { totalCostIncrease: 3_809_492_486 }), regionRow(8, { totalCostIncrease: 1_200_000_000 })],
  status: 'success' as const,
  current: department(4),
  onSelectSort: jest.fn(),
  onRetry: jest.fn(),
  onPick: jest.fn(),
  onClose: jest.fn(),
  onCompare: jest.fn(),
};

describe('RegionPickerView layout', () => {
  it('keeps the controls above the regions on phones', async () => {
    windowWidth(390);
    await render(<RegionPickerView {...props} />);
    expect(screen.queryByTestId('region-picker-panel')).toBeNull();
    expect(screen.getByLabelText('Nivel de gobierno')).toBeOnTheScreen();
  });

  it('puts the level, all of Peru and the sorts in a side panel on wide screens', async () => {
    windowWidth(1440);
    await render(<RegionPickerView {...props} />);
    const panel = screen.getByTestId('region-picker-panel');
    expect(within(panel).getByLabelText('Nivel de gobierno')).toBeOnTheScreen();
    expect(within(panel).getByLabelText('Ordenar regiones por')).toBeOnTheScreen();
    expect(within(panel).getByRole('button', { name: /^Todo el Perú/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^1\. Arequipa/ }));
    expect(props.onPick).toHaveBeenCalledWith(department(4));
  });
});
