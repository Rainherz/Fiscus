import { fireEvent, render, screen } from '@testing-library/react-native';

import { department } from '@/features/department/scope';
import { TestScope } from '@/test/scope';

import { CategoriesView } from './CategoriesView';

const summaries = [
  { function: 'TRANSPORTE', investmentCount: 120, totalUpdatedCost: 3_000_000_000, totalCostIncrease: 900_000_000 },
  { function: 'EDUCACIÓN', investmentCount: 1, totalUpdatedCost: 2_000_000, totalCostIncrease: null },
  { function: null, investmentCount: 3, totalUpdatedCost: null, totalCostIncrease: null },
];

describe('CategoriesView', () => {
  it('lists canonical functions, with counts and totals', async () => {
    await render(
      <CategoriesView summaries={summaries} status="success" onRetry={() => {}} onPressCategory={() => {}} />,
    );
    expect(screen.getByText('TRANSPORTE')).toBeOnTheScreen();
    expect(screen.getByText('120 proyectos')).toBeOnTheScreen();
    expect(screen.getByText('S/ 3,000 M')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 900 M de aumento')).toBeOnTheScreen();
    expect(screen.getByText('EDUCACIÓN')).toBeOnTheScreen();
    expect(screen.getByText('1 proyecto')).toBeOnTheScreen();
    expect(screen.getByText('Sin función registrada')).toBeOnTheScreen();
  });

  it('opens a category', async () => {
    const onPressCategory = jest.fn();
    await render(
      <CategoriesView summaries={summaries} status="success" onRetry={() => {}} onPressCategory={onPressCategory} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /^TRANSPORTE/ }));
    expect(onPressCategory).toHaveBeenCalledWith('TRANSPORTE');
    await fireEvent.press(screen.getByRole('button', { name: /^Sin función registrada/ }));
    expect(onPressCategory).toHaveBeenCalledWith(null);
  });

  it('names the filters when the scope has no projects', async () => {
    await render(
      <TestScope preset={{ scope: department(4), status: 'ALL' }}>
        <CategoriesView summaries={[]} status="success" onRetry={() => {}} onPressCategory={() => {}} />
      </TestScope>,
    );
    expect(screen.getByText('No hay proyectos registrados en Arequipa · Activos y cerrados.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver proyectos de todo el Perú' })).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await render(<CategoriesView summaries={[]} status="success" onRetry={() => {}} onPressCategory={() => {}} />);
    expect(screen.getByText('No hay proyectos registrados.')).toBeOnTheScreen();
  });

  it('states which government levels the totals cover', async () => {
    await render(
      <CategoriesView
        summaries={summaries}
        status="success"
        levelNote="Gobiernos locales."
        onRetry={() => {}}
        onPressCategory={() => {}}
      />,
    );
    expect(
      screen.getByText('Funciones según la clasificación vigente del MEF. Costo actual total por función. Gobiernos locales.'),
    ).toBeOnTheScreen();
  });
});
