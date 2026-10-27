import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NOW, arequipa, majes } from '@/test/fixtures';

import { HomeView } from './HomeView';

describe('HomeView', () => {
  const setup = () => {
    const onPressInvestment = jest.fn();
    const onPressSeeAll = jest.fn();
    return {
      onPressInvestment,
      onPressSeeAll,
      render: () =>
        render(
          <HomeView
            hero={majes}
            ranking={arequipa.slice(1)}
            now={NOW}
            onPressInvestment={onPressInvestment}
            onPressSeeAll={onPressSeeAll}
          />,
        ),
    };
  };

  it('shows the largest increase of the region as the hero', async () => {
    await setup().render();
    expect(screen.getByText('EL MAYOR AUMENTO DE LA REGIÓN')).toBeOnTheScreen();
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(screen.getByText('+285%')).toBeOnTheScreen();
    expect(screen.getByText('S/ 1,338 M')).toBeOnTheScreen();
    expect(screen.getByText(' aprobado en 2008')).toBeOnTheScreen();
    expect(screen.getByText('S/ 5,148 M')).toBeOnTheScreen();
    expect(screen.getByText(' cuesta hoy')).toBeOnTheScreen();
    expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
    expect(screen.getByText('18 AÑOS EN CURSO')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(
      'Gastado: 18 por ciento del costo actualizado',
    );
  });

  it('flags unusual spending of the hero under the bar', async () => {
    await render(
      <HomeView
        hero={{ ...majes, accruedTotal: 60_000_000_000, executionProgress: 11.66, spentAnomaly: true }}
        ranking={[]}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(
      screen.getByText('Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado.'),
    ).toBeOnTheScreen();
  });

  it('does not flag ordinary spending of the hero', async () => {
    await setup().render();
    expect(screen.queryByText(/Dato inusual/)).toBeNull();
  });

  it('lists the next increases starting at rank 2', async () => {
    const ctx = setup();
    await ctx.render();
    expect(screen.getByText('RANKING DE AUMENTOS')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '2. Variante de Uchumayo, +S/ 440 M' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '3. Vía regional Arequipa – La Joya, +S/ 309 M' }),
    ).toBeOnTheScreen();
    expect(ctx.onPressInvestment).not.toHaveBeenCalled();
  });

  it('opens a project when its row or the hero is pressed', async () => {
    const ctx = setup();
    await ctx.render();
    await fireEvent.press(screen.getByRole('button', { name: /^2\. Variante de Uchumayo/ }));
    expect(ctx.onPressInvestment).toHaveBeenCalledWith('2178454');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver detalle: Majes Siguas II etapa' }));
    expect(ctx.onPressInvestment).toHaveBeenCalledWith('2088142');
  });

  it('links to the full ranking', async () => {
    const ctx = setup();
    await ctx.render();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver ranking completo' }));
    expect(ctx.onPressSeeAll).toHaveBeenCalled();
  });

  it('says so when the region has no cost increases', async () => {
    await render(
      <HomeView hero={null} ranking={[]} now={NOW} onPressInvestment={() => {}} onPressSeeAll={() => {}} />,
    );
    expect(screen.getByText('No hay proyectos con aumento de costo en esta región.')).toBeOnTheScreen();
  });

  it('renders the recent increases it is given, with or without a hero', async () => {
    const { rerender } = await render(
      <HomeView
        hero={majes}
        ranking={arequipa.slice(1)}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
        recentIncreases={<Text>recientes</Text>}
      />,
    );
    expect(screen.getByText('recientes')).toBeOnTheScreen();
    await rerender(
      <HomeView
        hero={null}
        ranking={[]}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
        recentIncreases={<Text>recientes</Text>}
      />,
    );
    expect(screen.getByText('recientes')).toBeOnTheScreen();
  });
});
