import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { sampleRow } from '@/features/investments/adapters/sampleData';
import { mapInvestmentRow } from '@/features/investments/domain/mappers';
import { toStalledInvestment } from '@/features/investments/domain/stalled';
import type { EntityComparison } from '@/features/investments/domain/entityComparison';
import { NOW, arequipa } from '@/test/fixtures';

import { RankingsView } from './RankingsView';

const baseProps = {
  now: NOW,
  status: 'success' as const,
  isFetchingMore: false,
  onSelectKind: jest.fn(),
  onEndReached: jest.fn(),
  onRetry: jest.fn(),
  onPressInvestment: jest.fn(),
};

describe('RankingsView', () => {
  it('renders ranked rows with the metric of the selected ranking', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(screen.getByRole('tab', { name: 'Mayor aumento (S/)' })).toBeSelected();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, Gobierno regional, +S/ 3,809 M' })).toBeOnTheScreen();
    expect(screen.queryByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeNull();
  });

  it('only ranks projects of the selected region: the region comparison lives in the region picker', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} />);
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByRole('tab', { name: 'Entidades' })).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Regiones' })).toBeNull();
  });

  it('explains the minimum approved amount on the percentage ranking', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-pct', items: arequipa }} />);
    expect(screen.getByText('Solo proyectos aprobados por más de S/ 1 M.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1. Majes Siguas II etapa, Gobierno regional, +285%' })).toBeOnTheScreen();
  });

  it('tags closed projects CERRADO next to their level', async () => {
    const closed = mapInvestmentRow(
      sampleRow({ cui: '9', name: 'Puente cerrado', level: 'GL', status: 'CERRADO', viable: 1_000_000, updated: 2_000_000 }),
    );
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: [closed] }} />);
    expect(screen.getByText('GL · CERRADO')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^1\. Puente cerrado, Gobierno local, proyecto cerrado/ })).toBeOnTheScreen();
  });

  it('replaces an active-only ranking with a note when only closed projects are shown', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'stalled', items: [] }} activeOnlyHidden />);
    expect(screen.getByRole('tab', { name: 'Sin gasto reciente' })).toBeSelected();
    expect(screen.getByText(/se aplica solo a proyectos activos/)).toBeOnTheScreen();
    expect(screen.queryByText(/gastaron entre 5 % y 95 %/)).toBeNull();
    expect(screen.queryByText('No hay proyectos activos sin gasto en los últimos 12 meses.')).toBeNull();
  });

  it('switches rankings', async () => {
    const onSelectKind = jest.fn();
    await render(<RankingsView {...baseProps} list={{ kind: 'increase-amount', items: arequipa }} onSelectKind={onSelectKind} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Mayor costo' }));
    expect(onSelectKind).toHaveBeenCalledWith('cost');
  });

  it('shows loading, error and empty states', async () => {
    const { rerender } = await render(
      <RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="pending" />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();

    await rerender(<RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="error" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(baseProps.onRetry).toHaveBeenCalled();

    await rerender(<RankingsView {...baseProps} list={{ kind: 'cost', items: [] }} status="success" />);
    expect(screen.getByText('No hay proyectos para este ranking en esta región.')).toBeOnTheScreen();
  });

  it('lists projects without recent spending with the rule in one line', async () => {
    const stalled = toStalledInvestment(
      mapInvestmentRow(
        sampleRow({ cui: '7', name: 'Hospital regional', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01' }),
      ),
      '2026-10-01',
    )!;
    const onPressInvestment = jest.fn();
    await render(
      <RankingsView {...baseProps} list={{ kind: 'stalled', items: [stalled] }} onPressInvestment={onPressInvestment} />,
    );
    expect(screen.getByRole('tab', { name: 'Sin gasto reciente' })).toBeSelected();
    expect(
      screen.getByText(
        'Proyectos activos que gastaron entre 5 % y 95 % de su costo y no registran gasto en los últimos 12 meses de datos del MEF.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', {
        name: '1. Hospital regional, Gobierno regional, Sin gasto desde abr 2025, Gastó 32 % · S/ 202 M por ejecutar',
      }),
    );
    expect(onPressInvestment).toHaveBeenCalledWith('7');
  });

  it('lists the projects in the Contraloría report of paralyzed works with its note', async () => {
    const onPressInvestment = jest.fn();
    const item = {
      cui: '2151761',
      editionCutoff: '2026-06-30',
      publishedAt: '2026-08-17',
      obraCount: 1,
      mainCausalLabel: 'ABANDONO DE OBRA',
      minPhysicalProgress: 12,
      maxPhysicalProgress: 12,
      totalRemainingWorkBalance: 4_500_000,
      infobrasCodes: [81],
      name: 'Agua Muñapata',
      entity: null,
      departmentCode: 8,
      governmentLevel: 'GL' as const,
      status: 'ACTIVO',
    };
    await render(
      <RankingsView {...baseProps} list={{ kind: 'paralyzed', items: [item] }} onPressInvestment={onPressInvestment} />,
    );
    expect(screen.getByRole('tab', { name: 'Paralizadas (Contraloría)' })).toBeSelected();
    expect(screen.getByText(/informe trimestral de obras paralizadas de la Contraloría/)).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', {
        name: '1. Agua Muñapata, Gobierno local, Abandono de obra, Avance físico 12 % · S/ 4.5 M saldo de obra',
      }),
    );
    expect(onPressInvestment).toHaveBeenCalledWith('2151761');
  });

  it('states when no project of the scope is in the Contraloría report', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'paralyzed', items: [] }} />);
    expect(screen.getByText('Ningún proyecto de este ámbito figura en el último informe de obras paralizadas.')).toBeOnTheScreen();
  });

  it('keeps the other rankings and states when no project lacks recent spending', async () => {
    await render(<RankingsView {...baseProps} list={{ kind: 'stalled', items: [] }} />);
    for (const name of ['Mayor aumento (S/)', 'Mayor aumento (%)', 'Mayor costo', 'Más tiempo en curso']) {
      expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    }
    expect(screen.getByText('No hay proyectos activos sin gasto en los últimos 12 meses.')).toBeOnTheScreen();
  });

  describe('all of Peru', () => {
    const cusco = { ...arequipa[1], departmentCode: 8, departmentName: 'CUSCO' };

    it('shows the region of every ranked project', async () => {
      await render(
        <RankingsView {...baseProps} national list={{ kind: 'increase-amount', items: [arequipa[0], cusco] }} />,
      );
      expect(screen.getByText('Arequipa · S/ 1,338 M → S/ 5,148 M')).toBeOnTheScreen();
      expect(screen.getByText(/^Cusco · /)).toBeOnTheScreen();
    });

    it('shows the region of every project without recent spending', async () => {
      const item = toStalledInvestment(
        mapInvestmentRow(sampleRow({ cui: '9', name: 'Obra', updated: 297_000_000, progress: 0.32, lastAccrualMonth: '2025-04-01', departmentCode: 21 })),
        '2026-10-01',
      )!;
      await render(<RankingsView {...baseProps} national list={{ kind: 'stalled', items: [item] }} />);
      expect(screen.getByText('Puno · Sin gasto desde abr 2025')).toBeOnTheScreen();
    });

    it('speaks of the country when a ranking is empty', async () => {
      await render(<RankingsView {...baseProps} national list={{ kind: 'cost', items: [] }} />);
      expect(screen.getByText('No hay proyectos para este ranking en el país.')).toBeOnTheScreen();
    });
  });

  describe('Entidades', () => {
    const entity = (name: string, values: Partial<EntityComparison>): EntityComparison => ({
      entity: name,
      governmentLevel: 'GL',
      departmentCode: 4,
      departmentName: 'AREQUIPA',
      projectCount: 12,
      validCostCount: 10,
      totalUpdatedCost: 50_000_000,
      totalCostIncrease: 8_000_000,
      projectsWithIncrease: 3,
      increasedViableAmount: 20_000_000,
      costIncreasePct: 40,
      overspentCount: 1,
      stalledCount: 2,
      stalledPendingAmount: 7_000_000,
      ...values,
    });
    const items = [
      entity('MINISTERIO DE TRANSPORTES', { governmentLevel: 'GN', departmentCode: null, totalCostIncrease: 900_000_000 }),
      entity('MUNICIPALIDAD DISTRITAL DE CAYMA', {}),
    ];

    it('lists entities with their level, figure and region nationwide, and sorts them', async () => {
      const onSelectEntitySort = jest.fn();
      const onPressEntity = jest.fn();
      await render(
        <RankingsView
          {...baseProps}
          national
          list={{ kind: 'entities', items }}
          entitySort="increase-amount"
          onSelectEntitySort={onSelectEntitySort}
          onPressEntity={onPressEntity}
        />,
      );
      expect(screen.getByRole('tab', { name: 'Entidades' })).toBeSelected();
      expect(screen.getByText('GN')).toBeOnTheScreen();
      expect(screen.getByText('Varias regiones · 12 proyectos · 3 con aumento')).toBeOnTheScreen();
      await fireEvent.press(
        screen.getByRole('button', { name: '2. MUNICIPALIDAD DISTRITAL DE CAYMA, Gobierno local, +S/ 8.0 M' }),
      );
      expect(onPressEntity).toHaveBeenCalledWith(items[1]);
      await fireEvent.press(screen.getByRole('tab', { name: 'Más obras sin gasto reciente' }));
      expect(onSelectEntitySort).toHaveBeenCalledWith('stalled');
      expect(
        screen.getByText('Suma de los aumentos de costo de los proyectos de cada entidad. No descuenta las reducciones.'),
      ).toBeOnTheScreen();
    });

    it('says so when no entity has the figure', async () => {
      await render(<RankingsView {...baseProps} list={{ kind: 'entities', items: [] }} entitySort="overspent" />);
      expect(screen.getByText('No hay entidades con este dato en el ámbito elegido.')).toBeOnTheScreen();
    });

    it('can show only the project tabs under a header, for one entity', async () => {
      await render(
        <RankingsView
          {...baseProps}
          list={{ kind: 'increase-amount', items: arequipa }}
          options="projects"
          header={<Text>Cabecera</Text>}
        />,
      );
      expect(screen.getByText('Cabecera')).toBeOnTheScreen();
      expect(screen.getAllByRole('tab')).toHaveLength(5);
      expect(screen.queryByRole('tab', { name: 'Entidades' })).toBeNull();
    });
  });
});
