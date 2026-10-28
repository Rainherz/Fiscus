import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { NOW, majes } from '@/test/fixtures';

import { InvestmentDetailView } from './InvestmentDetailView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const renderDetail = () =>
  render(
    <InvestmentDetailView
      investment={{ ...majes, entity: 'GOBIERNO REGIONAL AREQUIPA' }}
      now={NOW}
      costHistory={<Text>Historial</Text>}
      onShare={jest.fn()}
    />,
  );

const factStyle = () => StyleSheet.flatten(screen.getByLabelText('Entidad: GOBIERNO REGIONAL AREQUIPA').props.style);

describe('InvestmentDetailView layout', () => {
  it('keeps one column with stacked facts on phones', async () => {
    windowWidth(390);
    await renderDetail();
    expect(screen.queryByTestId('detail-columns')).toBeNull();
    expect(factStyle().flexBasis).toBeUndefined();
  });

  it('puts the figures on the left and the facts on the right on desktop', async () => {
    windowWidth(1440);
    await renderDetail();
    expect(StyleSheet.flatten(screen.getByTestId('detail-columns').props.style)).toMatchObject({ flexDirection: 'row' });
    const main = screen.getByTestId('detail-main');
    expect(within(main).getByRole('header', { name: 'Majes Siguas II etapa' })).toBeOnTheScreen();
    expect(within(main).getByRole('button', { name: 'Compartir este proyecto como imagen' })).toBeOnTheScreen();
    expect(within(main).getByText('Historial')).toBeOnTheScreen();
    const facts = screen.getByTestId('detail-facts');
    expect(within(facts).getByLabelText('Entidad: GOBIERNO REGIONAL AREQUIPA')).toBeOnTheScreen();
    expect(factStyle()).toMatchObject({ flexBasis: '50%' });
  });

  it('keeps one wider column on tablets, the facts in two columns', async () => {
    windowWidth(1024);
    await renderDetail();
    expect(screen.queryByTestId('detail-columns')).toBeNull();
    expect(factStyle()).toMatchObject({ flexBasis: '50%' });
  });
});
