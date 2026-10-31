import { fireEvent, render, screen } from '@testing-library/react-native';

import { department } from '@/features/department/scope';
import { arequipa } from '@/test/fixtures';
import { TestScope } from '@/test/scope';

import { SearchView } from './SearchView';

const base = {
  text: '',
  departmentName: 'Arequipa',
  results: [],
  status: 'idle' as const,
  onChangeText: jest.fn(),
  onRetry: jest.fn(),
  onPressInvestment: jest.fn(),
};

describe('SearchView', () => {
  it('has an accessible search field and a hint', async () => {
    const onChangeText = jest.fn();
    await render(<SearchView {...base} onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Buscar por nombre o CUI'), 'hospital');
    expect(onChangeText).toHaveBeenCalledWith('hospital');
    expect(
      screen.getByText('Escribe al menos 3 letras del nombre (en Arequipa) o un CUI completo (todo el país).'),
    ).toBeOnTheScreen();
  });

  it('searches names in the whole country for all of Peru', async () => {
    await render(<SearchView {...base} departmentName={null} />);
    expect(
      screen.getByText('Escribe al menos 3 letras del nombre o un CUI completo. Busca en todo el país.'),
    ).toBeOnTheScreen();
  });

  it('shows the region of every result for all of Peru', async () => {
    await render(
      <SearchView
        {...base}
        departmentName={null}
        text="hospital"
        status="success"
        results={[{ ...arequipa[3], departmentCode: 8 }]}
      />,
    );
    expect(screen.getByText('Cusco · CUI 2322531')).toBeOnTheScreen();
  });

  it('lists results with their current cost', async () => {
    const onPressInvestment = jest.fn();
    await render(
      <SearchView {...base} text="hospital" status="success" results={[arequipa[3]]} onPressInvestment={onPressInvestment} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '1. Hospital Maritza Campos Díaz, Gobierno regional, S/ 349 M' }));
    expect(onPressInvestment).toHaveBeenCalledWith('2322531');
  });

  it('says when nothing matched', async () => {
    await render(<SearchView {...base} text="xyz" status="success" results={[]} />);
    expect(screen.getByText('Sin resultados para “xyz”.')).toBeOnTheScreen();
    expect(screen.getByText('Revisa la ortografía o busca por CUI.')).toBeOnTheScreen();
  });

  it('names the scope searched and only offers to search all of Peru', async () => {
    await render(
      <TestScope preset={{ scope: department(4), level: 'GL', status: 'CLOSED' }}>
        <SearchView {...base} text="xyz" status="success" results={[]} />
      </TestScope>,
    );
    expect(screen.getByText('Sin resultados para “xyz” en Arequipa · Gobiernos locales · Proyectos cerrados.')).toBeOnTheScreen();
    expect(screen.getByText('Revisa la ortografía o busca por CUI.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ver proyectos de todo el Perú' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver proyectos activos y cerrados' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver todos los niveles de gobierno' })).toBeNull();
  });

  it('tags results with their level and names the level searched', async () => {
    await render(
      <SearchView
        {...base}
        text="majes"
        status="success"
        results={[arequipa[0]]}
        levelLabel="Gobiernos regionales"
      />,
    );
    expect(screen.getByRole('button', { name: /^1\. Majes Siguas II etapa, Gobierno regional,/ })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Escribe al menos 3 letras del nombre (en Arequipa, gobiernos regionales) o un CUI completo (todo el país, todos los niveles).',
      ),
    ).toBeOnTheScreen();
  });
});
