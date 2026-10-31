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
      screen.getByRole('button', { name: '2. Variante de Uchumayo, Gobierno regional, +S/ 440 M' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: '3. Vía regional Arequipa – La Joya, Gobierno regional, +S/ 309 M' }),
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

  it('links a region home to the comparison with another region', async () => {
    const onPressCompare = jest.fn();
    await render(
      <HomeView
        hero={majes}
        ranking={arequipa.slice(1)}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
        onPressCompare={onPressCompare}
      />,
    );
    expect(screen.getByText('Comparar con otra región →')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Comparar con otra región' }));
    expect(onPressCompare).toHaveBeenCalled();
  });

  it('links to the map, with or without increases', async () => {
    const onPressMap = jest.fn();
    const { rerender } = await render(
      <HomeView
        hero={majes}
        ranking={arequipa.slice(1)}
        now={NOW}
        onPressInvestment={jest.fn()}
        onPressSeeAll={jest.fn()}
        onPressMap={onPressMap}
      />,
    );
    expect(screen.getByText('Ver en el mapa →')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Ver en el mapa' }));
    expect(onPressMap).toHaveBeenCalledTimes(1);
    await rerender(
      <HomeView hero={null} ranking={[]} now={NOW} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} onPressMap={onPressMap} />,
    );
    expect(screen.getByRole('link', { name: 'Ver en el mapa' })).toBeOnTheScreen();
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

  it('renders the stalled block after the recent increases, with or without a hero', async () => {
    const props = {
      now: NOW,
      onPressInvestment: jest.fn(),
      onPressSeeAll: jest.fn(),
      recentIncreases: <Text>recientes</Text>,
      stalled: <Text>sin gasto</Text>,
      footer: <Text>pie</Text>,
    };
    const order = () =>
      screen.getAllByText(/^(recientes|sin gasto|pie)$/).map((node) => node.props.children as string);

    const { rerender } = await render(<HomeView {...props} hero={majes} ranking={arequipa.slice(1)} />);
    expect(order()).toEqual(['recientes', 'sin gasto', 'pie']);
    await rerender(<HomeView {...props} hero={null} ranking={[]} />);
    expect(order()).toEqual(['recientes', 'sin gasto', 'pie']);
  });

  describe('all of Peru', () => {
    const uchumayoCusco = { ...arequipa[1], departmentCode: 8, departmentName: 'CUSCO' };
    const props = {
      hero: majes,
      ranking: [uchumayoCusco, ...arequipa.slice(2)],
      now: NOW,
      national: true,
      onPressInvestment: jest.fn(),
      onPressSeeAll: jest.fn(),
    };

    it('shows the largest increase of the country with its region under the name', async () => {
      await render(<HomeView {...props} />);
      expect(screen.getByText('EL MAYOR AUMENTO DEL PAÍS')).toBeOnTheScreen();
      expect(screen.queryByText('EL MAYOR AUMENTO DE LA REGIÓN')).toBeNull();
      expect(screen.getByText('AREQUIPA')).toBeOnTheScreen();
    });

    it('shows the region of every ranked project in a second line', async () => {
      await render(<HomeView {...props} />);
      expect(screen.getByText('RANKING DE AUMENTOS')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: '2. Variante de Uchumayo, Gobierno regional, +S/ 440 M' })).toBeOnTheScreen();
      expect(screen.getByText('Cusco')).toBeOnTheScreen();
      expect(screen.getAllByText('Arequipa')).toHaveLength(props.ranking.length - 1);
    });

    it('does not show regions in the ranking of one region', async () => {
      await render(<HomeView {...props} national={false} />);
      expect(screen.queryByText('Cusco')).toBeNull();
      expect(screen.queryByText('AREQUIPA')).toBeNull();
    });

    it('shows the regions block, the paralyzed works, the stalled block, then the recent increases', async () => {
      const blocks = {
        regions: <Text>regiones</Text>,
        recentIncreases: <Text>recientes</Text>,
        paralyzed: <Text>paralizadas</Text>,
        stalled: <Text>sin gasto</Text>,
        footer: <Text>pie</Text>,
      };
      const order = () =>
        screen
          .getAllByText(/^(regiones|recientes|paralizadas|sin gasto|pie)$/)
          .map((node) => node.props.children as string);

      const { rerender } = await render(<HomeView {...props} {...blocks} />);
      expect(order()).toEqual(['regiones', 'paralizadas', 'sin gasto', 'recientes', 'pie']);
      await rerender(<HomeView {...props} {...blocks} hero={null} ranking={[]} />);
      expect(order()).toEqual(['regiones', 'paralizadas', 'sin gasto', 'recientes', 'pie']);
    });

    it('shows the paralyzed works before the stalled block on a region home', async () => {
      await render(
        <HomeView
          {...props}
          national={false}
          recentIncreases={<Text>recientes</Text>}
          paralyzed={<Text>paralizadas</Text>}
          stalled={<Text>sin gasto</Text>}
        />,
      );
      expect(
        screen.getAllByText(/^(recientes|paralizadas|sin gasto)$/).map((node) => node.props.children as string),
      ).toEqual(['recientes', 'paralizadas', 'sin gasto']);
    });

    it('does not offer the region comparison link on the national home', async () => {
      await render(<HomeView {...props} onPressCompare={jest.fn()} />);
      expect(screen.queryByRole('button', { name: 'Comparar con otra región' })).toBeNull();
    });

    it('says so when the country has no cost increases', async () => {
      await render(<HomeView {...props} hero={null} ranking={[]} />);
      expect(screen.getByText('No hay proyectos con aumento de costo en el país.')).toBeOnTheScreen();
    });
  });

  describe('government levels', () => {
    const national = { ...majes, cui: '9', name: 'Red vial nacional', governmentLevel: 'GN' as const, departmentCode: null, departmentName: null };

    it('tags the hero and ranking rows with their level', async () => {
      await render(
        <HomeView hero={majes} ranking={[{ ...arequipa[1], governmentLevel: 'GL' }]} now={NOW} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} />,
      );
      expect(screen.getByLabelText('Gobierno regional')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: /^2\. Variante de Uchumayo, Gobierno local,/ })).toBeOnTheScreen();
    });

    it('says "Varias regiones" for a national project without department nationwide', async () => {
      await render(
        <HomeView hero={national} ranking={[national]} national now={NOW} onPressInvestment={jest.fn()} onPressSeeAll={jest.fn()} />,
      );
      expect(screen.getByText('VARIAS REGIONES')).toBeOnTheScreen();
      expect(screen.getByText('Varias regiones')).toBeOnTheScreen();
    });
  });
});
