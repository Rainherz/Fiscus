import { render, screen } from '@testing-library/react-native';

import { DataFooter } from './DataFooter';

describe('DataFooter', () => {
  it('shows the last update and source', async () => {
    await render(<DataFooter finishedAt="2026-10-26T10:30:00Z" isDemo={false} />);
    expect(screen.getByText('Datos actualizados el 26/10/2026')).toBeOnTheScreen();
    expect(screen.getByText('Fuente: MEF – Sistema de Seguimiento de Inversiones')).toBeOnTheScreen();
  });

  it('omits the date when unknown', async () => {
    await render(<DataFooter finishedAt={null} isDemo={false} />);
    expect(screen.queryByText(/Datos actualizados/)).toBeNull();
  });

  it('flags demo data', async () => {
    await render(<DataFooter finishedAt={null} isDemo />);
    expect(screen.getByText('Modo demostración: datos de ejemplo.')).toBeOnTheScreen();
  });
});
