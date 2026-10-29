import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import { NOW, arequipa } from '@/test/fixtures';

import { RankingsView } from './RankingsView';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));
const windowWidth = (width: number) =>
  jest
    .requireMock<{ default: jest.Mock }>('react-native/Libraries/Utilities/useWindowDimensions')
    .default.mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });

const baseProps = {
  now: NOW,
  status: 'success' as const,
  isFetchingMore: false,
  onSelectKind: jest.fn(),
  onEndReached: jest.fn(),
  onRetry: jest.fn(),
  onPressInvestment: jest.fn(),
};

const hidden = { includeHiddenElements: true };
/** The column header is hidden from screen readers (rows announce their figures), so it is queried as hidden. */
const headerText = () =>
  within(screen.getByTestId('table-header', hidden))
    .getAllByText(/./, hidden)
    .map((node) => node.props.children as string)
    .filter((text) => text !== '?');

describe('RankingsView layout', () => {
  it('keeps the phone rows below 768 px', async () => {
    windowWidth(390);
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(screen.queryByTestId('table-header', hidden)).toBeNull();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, Gobierno regional, +S/ 3,809 M' })).toBeOnTheScreen();
  });

  it('shows a table with every figure on desktop, the ranked column marked', async () => {
    windowWidth(1440);
    await render(<RankingsView {...baseProps} national list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(headerText()).toEqual(['#', 'NOMBRE', 'NIVEL', 'REGIÓN', 'APROBADO', 'COSTO ACTUAL', 'AUMENTO S/', '%']);
    const row = screen.getByRole('button', {
      name: '1. Majes Siguas II etapa, Gobierno regional, Arequipa, Aprobado S/ 1,338 M, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M, % +285%',
    });
    await fireEvent.press(row);
    expect(baseProps.onPressInvestment).toHaveBeenCalledWith('2088142');
  });

  it('explains the figure columns with term hints on desktop', async () => {
    windowWidth(1440);
    await render(<RankingsView {...baseProps} list={{ kind: 'cost', items: arequipa }} />);
    const header = screen.getByTestId('table-header', hidden);
    for (const term of ['Monto viable (aprobado)', 'Costo actualizado', 'Gastado % del costo', 'Aumento de costo']) {
      expect(within(header).getByRole('button', { name: `Qué significa ${term}` })).toBeOnTheScreen();
    }
  });

  it('keeps the compact tablet header without hints', async () => {
    windowWidth(1024);
    await render(<RankingsView {...baseProps} list={{ kind: 'cost', items: arequipa }} />);
    expect(screen.queryByRole('button', { name: /^Qué significa/ })).toBeNull();
  });

  it('leaves the region column out within one region', async () => {
    windowWidth(1440);
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(headerText()).not.toContain('REGIÓN');
  });

  it('keeps the tabs on one row at desktop widths: the column is no longer capped at 640 px', async () => {
    windowWidth(1440);
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(StyleSheet.flatten(screen.getByTestId('rankings-controls').props.style)).toMatchObject({ maxWidth: 1280 });
  });

  it('shows a compact table on tablets', async () => {
    windowWidth(1024);
    await render(<RankingsView {...baseProps} national list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(headerText()).toEqual(['#', 'NOMBRE', 'COSTO ACTUAL', 'AUMENTO S/', '%']);
  });

  it('opens an entity from the entities table', async () => {
    windowWidth(1440);
    const entity: EntityComparison = {
      entity: 'GOBIERNO REGIONAL AREQUIPA',
      governmentLevel: 'GR',
      departmentCode: 4,
      departmentName: 'AREQUIPA',
      projectCount: 5,
      validCostCount: 5,
      totalUpdatedCost: 900_000_000,
      totalCostIncrease: 120_000_000,
      projectsWithIncrease: 3,
      increasedViableAmount: 400_000_000,
      costIncreasePct: 30,
      overspentCount: 0,
      stalledCount: 1,
      stalledPendingAmount: 50_000_000,
    };
    const onPressEntity = jest.fn();
    await render(
      <RankingsView {...baseProps} list={{ kind: 'entities', items: [entity] }} onPressEntity={onPressEntity} />,
    );
    expect(headerText()).toEqual(['#', 'NOMBRE', 'NIVEL', 'PROYECTOS', 'CON AUMENTO', 'AUMENTO S/', '%', 'SIN GASTO', 'GASTO SOBRE COSTO']);
    await fireEvent.press(screen.getByRole('button', { name: /^1\. GOBIERNO REGIONAL AREQUIPA, Gobierno regional, Proyectos 5/ }));
    expect(onPressEntity).toHaveBeenCalledWith(entity);
  });
});
