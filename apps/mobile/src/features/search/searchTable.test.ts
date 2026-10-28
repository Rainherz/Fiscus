import { majes } from '@/test/fixtures';

import { searchTable } from './searchTable';

describe('searchTable', () => {
  it('lists the CUI, current cost, increase and percentage of every result, none marked as ranked', () => {
    const table = searchTable([{ ...majes, entity: 'GOBIERNO REGIONAL AREQUIPA' }], { national: true });
    expect(table.columns.map((column) => column.label)).toEqual(['CUI', 'Costo actual', 'Aumento S/', '%']);
    expect(table.columns.some((column) => column.sorted)).toBe(false);
    expect(table.rows[0]).toMatchObject({
      key: '2088142',
      name: 'Majes Siguas II etapa',
      sub: 'GOBIERNO REGIONAL AREQUIPA',
      region: 'Arequipa',
      cells: ['2088142', 'S/ 5,148 M', '+S/ 3,809 M', '+285%'],
      summary: 'Arequipa, CUI 2088142, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M, % +285%',
    });
  });

  it('drops the percentage in the compact version and the region within one region', () => {
    const table = searchTable([majes], { compact: true });
    expect(table.columns.map((column) => column.label)).toEqual(['CUI', 'Costo actual', 'Aumento S/']);
    expect(table.rows[0].summary).toBe('CUI 2088142, Costo actual S/ 5,148 M, Aumento S/ +S/ 3,809 M');
  });
});
