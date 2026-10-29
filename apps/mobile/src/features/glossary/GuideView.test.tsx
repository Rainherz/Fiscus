import { render, screen, within } from '@testing-library/react-native';

import { GuideView, GUIDE_SECTIONS } from './GuideView';
import { FISCUS_RULES, GLOSSARY } from './terms';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

describe('GuideView', () => {
  it('has the title and the sections in order', async () => {
    await render(<GuideView />);
    expect(screen.getByRole('header', { name: 'CÓMO LEER ESTOS DATOS' })).toBeOnTheScreen();
    expect(GUIDE_SECTIONS.map((section) => section.title)).toEqual([
      'Qué es Fiscus',
      'De dónde salen los datos',
      'Cómo leer un proyecto',
      'Glosario',
      'Reglas de Fiscus',
      'Limitaciones conocidas',
    ]);
    const headers = screen.getAllByRole('header').map((node) => node.props.children);
    expect(headers.slice(1)).toEqual(GUIDE_SECTIONS.map((section) => section.title));
  });

  it('defines every MEF term in the glossary and every Fiscus rule in its own section', async () => {
    await render(<GuideView />);
    const glossary = screen.getByTestId('guide-glossary');
    for (const term of GLOSSARY.filter((t) => t.kind === 'mef')) {
      expect(within(glossary).getByText(term.term)).toBeOnTheScreen();
      expect(within(glossary).getByText(term.definition)).toBeOnTheScreen();
    }
    const rules = screen.getByTestId('guide-rules');
    for (const term of FISCUS_RULES) expect(within(rules).getByText(term.definition)).toBeOnTheScreen();
  });

  it('states the known limitations', async () => {
    await render(<GuideView />);
    const limits = screen.getByTestId('guide-limitations');
    expect(within(limits).getByText(/solo proyectos activos/)).toBeOnTheScreen();
    expect(within(limits).getByText(/≈77 %/)).toBeOnTheScreen();
    expect(within(limits).getByText(/27\/10\/2026/)).toBeOnTheScreen();
    expect(within(limits).getByText(/menores que S\/ 1,000/)).toBeOnTheScreen();
  });
});
