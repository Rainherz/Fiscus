import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { EmptyState } from '@/shared/ui/EmptyState';
import { ScopeProbe, TestScope, type ScopePreset } from '@/test/scope';

import { FilteredEmptyState } from './FilteredEmptyState';
import { department } from './scope';

function renderInScope(ui: ReactElement, preset: ScopePreset) {
  return render(
    <TestScope preset={preset}>
      {ui}
      <ScopeProbe />
    </TestScope>,
  );
}

describe('EmptyState', () => {
  it('shows the message, the hint and the shortcut buttons', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        message="No hay proyectos en Arequipa."
        hint="Una pista."
        actions={[{ key: 'scope', label: 'Ver todo el Perú', accessibilityLabel: 'Ver proyectos de todo el Perú', onPress }]}
      />,
    );
    expect(screen.getByText('No hay proyectos en Arequipa.')).toBeOnTheScreen();
    expect(screen.getByText('Una pista.')).toBeOnTheScreen();
    const button = screen.getByRole('button', { name: 'Ver proyectos de todo el Perú' });
    expect(button).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('FilteredEmptyState', () => {
  it('names the filters, hints that paralyzed works are active and offers shortcuts', async () => {
    await renderInScope(<FilteredEmptyState what="Ningún proyecto figura en el informe" list="paralyzed" />, {
      scope: department(4),
      status: 'CLOSED',
    });
    expect(screen.getByText('Ningún proyecto figura en el informe en Arequipa · Proyectos cerrados.')).toBeOnTheScreen();
    expect(screen.getByText('Las obras paralizadas suelen ser proyectos activos.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver proyectos activos y cerrados' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver proyectos de todo el Perú' })).toBeOnTheScreen();
  });

  it('relaxes the global filters when a shortcut is pressed', async () => {
    await renderInScope(<FilteredEmptyState what="No hay proyectos" />, {
      scope: department(4),
      level: 'GL',
      status: 'CLOSED',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Ver proyectos activos y cerrados' }));
    expect(screen.getByTestId('scope-probe')).toHaveTextContent('Arequipa | Gobiernos locales | Activos y cerrados');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todos los niveles de gobierno' }));
    expect(screen.getByTestId('scope-probe')).toHaveTextContent('Arequipa | Todos los niveles | Activos y cerrados');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver proyectos de todo el Perú' }));
    expect(screen.getByTestId('scope-probe')).toHaveTextContent('Todo el Perú | Todos los niveles | Activos y cerrados');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('No hay proyectos en todo el Perú · Activos y cerrados.')).toBeOnTheScreen();
  });

  it('keeps a full sentence verbatim and only adds the shortcuts', async () => {
    await renderInScope(<FilteredEmptyState what="Este criterio es solo para activos." describeFilters={false} />, {
      status: 'CLOSED',
    });
    expect(screen.getByText('Este criterio es solo para activos.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver proyectos activos y cerrados' })).toBeOnTheScreen();
  });

  it('shows the plain message outside the scope provider', async () => {
    await render(<FilteredEmptyState what="No hay proyectos" />);
    expect(screen.getByText('No hay proyectos.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
