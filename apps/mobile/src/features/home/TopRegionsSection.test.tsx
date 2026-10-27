import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RegionComparison } from '@/features/investments/domain/regionComparison';

import { TOP_REGIONS_COUNT, TopRegionsSection, topRegionsByIncrease } from './TopRegionsSection';

function region(code: number, totalCostIncrease: number, values: Partial<RegionComparison> = {}): RegionComparison {
  return {
    departmentCode: code,
    departmentName: null,
    projectCount: 100,
    activeCount: 90,
    validCostCount: 95,
    totalViableAmount: 1_000_000_000,
    totalUpdatedCost: 1_200_000_000,
    totalCostIncrease,
    projectsWithIncrease: 10,
    costIncreasePct: null,
    overspentCount: 0,
    stalledCount: 0,
    stalledPendingAmount: 0,
    ...values,
  };
}

describe('topRegionsByIncrease', () => {
  it('keeps the five regions with the largest total increase, largest first', () => {
    const regions = [
      region(1, 10),
      region(4, 3_809_492_486),
      region(8, 1_200_000_000),
      region(15, 900_000_000),
      region(21, 50),
      region(13, 2_000_000_000),
      region(20, 0),
    ];
    expect(TOP_REGIONS_COUNT).toBe(5);
    expect(topRegionsByIncrease(regions).map((r) => r.departmentCode)).toEqual([4, 13, 8, 15, 21]);
  });

  it('leaves out regions without any increase', () => {
    expect(topRegionsByIncrease([region(4, 3_000), region(8, 0)]).map((r) => r.departmentCode)).toEqual([4]);
  });
});

describe('TopRegionsSection', () => {
  const regions = [
    region(4, 3_809_492_486, { projectCount: 1638, projectsWithIncrease: 412 }),
    region(8, 1_200_000_000, { projectsWithIncrease: 30 }),
  ];

  it('lists the regions with their total increase and context', async () => {
    await render(
      <TopRegionsSection state={{ status: 'success', regions }} onPressRegion={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    expect(screen.getByRole('header', { name: 'REGIONES CON MÁS AUMENTOS' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '1. Arequipa, +S/ 3,809 M' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' })).toBeOnTheScreen();
    expect(screen.getByText('1,638 proyectos · 412 con aumento')).toBeOnTheScreen();
    expect(screen.getByText('Suma de los aumentos de costo. No descuenta las reducciones.')).toBeOnTheScreen();
  });

  it('selects a region and opens the picker with all 25', async () => {
    const onPressRegion = jest.fn();
    const onPressSeeAll = jest.fn();
    await render(
      <TopRegionsSection
        state={{ status: 'success', regions }}
        onPressRegion={onPressRegion}
        onPressSeeAll={onPressSeeAll}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '2. Cusco, +S/ 1,200 M' }));
    expect(onPressRegion).toHaveBeenCalledWith(8);
    expect(screen.getByText('Ver las 25 →')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver las 25 regiones' }));
    expect(onPressSeeAll).toHaveBeenCalled();
  });

  it('links to the comparison of two regions', async () => {
    const onPressCompare = jest.fn();
    await render(
      <TopRegionsSection
        state={{ status: 'success', regions }}
        onPressRegion={jest.fn()}
        onPressSeeAll={jest.fn()}
        onPressCompare={onPressCompare}
      />,
    );
    expect(screen.getByText('Comparar dos regiones →')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Comparar dos regiones' }));
    expect(onPressCompare).toHaveBeenCalled();
  });

  it('shows loading, error and empty states', async () => {
    const onRetry = jest.fn();
    const { rerender } = await render(
      <TopRegionsSection state={{ status: 'pending' }} onPressRegion={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
    await rerender(
      <TopRegionsSection state={{ status: 'error', onRetry }} onPressRegion={jest.fn()} onPressSeeAll={jest.fn()} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
    await rerender(
      <TopRegionsSection
        state={{ status: 'success', regions: [] }}
        onPressRegion={jest.fn()}
        onPressSeeAll={jest.fn()}
      />,
    );
    expect(screen.getByText('No hay datos de regiones.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver las 25 regiones' })).toBeOnTheScreen();
  });
});
