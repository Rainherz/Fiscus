import { fireEvent, render, screen } from '@testing-library/react-native';

import { arequipa } from '@/test/fixtures';

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
    await fireEvent.press(screen.getByRole('button', { name: '1. Hospital Maritza Campos Díaz, S/ 349 M' }));
    expect(onPressInvestment).toHaveBeenCalledWith('2322531');
  });

  it('says when nothing matched', async () => {
    await render(<SearchView {...base} text="xyz" status="success" results={[]} />);
    expect(screen.getByText('Sin resultados para “xyz”.')).toBeOnTheScreen();
  });
});
