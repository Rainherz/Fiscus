import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { colors } from '@/shared/theme/tokens';

import { SourcePanel, type SourcePanelProps } from './SourcePanel';

const base: SourcePanelProps = {
  testID: 'panel',
  tone: 'alert',
  title: 'PANEL TITLE',
  titleHint: <Text>hint</Text>,
  figures: [
    { label: 'Obras', value: '2' },
    { label: 'Saldo de obra', value: 'S/ 80 M' },
  ],
  footer: ['Corte: junio 2026', 'Fuente: Contraloría General de la República.'],
};

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('SourcePanel', () => {
  it('shows header, headline, key figures, rows with their lines and links, and the footer', async () => {
    const onPress = jest.fn();
    await render(
      <SourcePanel
        {...base}
        headline="Causal: Abandono de obra"
        items={[
          {
            key: '1',
            testID: 'row-1',
            summary: 'Obra 1 · avance 31 %',
            lines: [
              { text: 'Modalidad: contrata' },
              {
                text: 'Contratista: A · S/ 1 M',
                parts: [{ text: 'Contratista: A', hint: <Text>contratista?</Text> }, { text: 'S/ 1 M' }],
              },
            ],
            links: [{ label: 'Ver ficha', accessibilityLabel: 'Ver ficha de la obra 1', onPress }],
          },
        ]}
      />,
    );

    expect(screen.getByRole('header', { name: 'PANEL TITLE' })).toBeOnTheScreen();
    expect(screen.getByText('hint')).toBeOnTheScreen();
    expect(screen.getByText('Causal: Abandono de obra')).toBeOnTheScreen();
    expect(screen.getByLabelText('Obras: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saldo de obra: S/ 80 M')).toBeOnTheScreen();
    expect(screen.getByText('OBRAS')).toBeOnTheScreen();
    expect(screen.getByText('Obra 1 · avance 31 %')).toBeOnTheScreen();
    expect(screen.getByText('Modalidad: contrata')).toBeOnTheScreen();
    expect(screen.getByText('Contratista: A')).toBeOnTheScreen();
    expect(screen.getByText('S/ 1 M')).toBeOnTheScreen();
    expect(screen.getByText('contratista?')).toBeOnTheScreen();
    expect(screen.getByText('Ver ficha →')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Ver ficha de la obra 1' }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('Corte: junio 2026')).toBeOnTheScreen();
    expect(screen.getByText('Fuente: Contraloría General de la República.')).toBeOnTheScreen();
  });

  it('shows panel-level links without rows', async () => {
    await render(<SourcePanel {...base} links={[{ label: 'Ver ficha', accessibilityLabel: 'Ver ficha', onPress: () => {} }]} />);
    expect(screen.getByRole('link', { name: 'Ver ficha' })).toBeOnTheScreen();
  });

  it('offers the "show more" button when given', async () => {
    const onPress = jest.fn();
    await render(<SourcePanel {...base} more={{ label: 'Ver 2 obras más', onPress }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver 2 obras más' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('draws the alert tone on ink with a signal edge', async () => {
    await render(<SourcePanel {...base} />);
    expect(style('panel')).toMatchObject({ backgroundColor: colors.ink, borderLeftWidth: 6, borderLeftColor: colors.signal });
    expect(StyleSheet.flatten(screen.getByText('PANEL TITLE').props.style).color).toBe(colors.signal);
  });

  it('draws the neutral tone on concrete with an ink border and a signal edge', async () => {
    await render(<SourcePanel {...base} tone="neutral" links={[{ label: 'Ver ficha', accessibilityLabel: 'Ver ficha', onPress: () => {} }]} />);
    expect(style('panel')).toMatchObject({
      backgroundColor: colors.concrete,
      borderWidth: 2,
      borderColor: colors.ink,
      borderLeftWidth: 4,
      borderLeftColor: colors.signal,
    });
    expect(StyleSheet.flatten(screen.getByText('PANEL TITLE').props.style).color).toBe(colors.ink);
    expect(StyleSheet.flatten(screen.getByText('Ver ficha →').props.style)).toMatchObject({ color: colors.ink, textDecorationLine: 'underline' });
  });
});
