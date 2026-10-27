import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FIT_LETTER_SPACING_EM, textWidthEm } from './fitFontSize';
import { FitDisplayText } from './FitDisplayText';

const fontSizeOf = (text: string) =>
  StyleSheet.flatten(screen.getByText(text).props.style).fontSize as number;

const widthAt = (text: string, size: number) => size * textWidthEm(text, FIT_LETTER_SPACING_EM);

const mockWindow = { width: 390 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 800, scale: 2, fontScale: 1 }),
}));

function mockWindowWidth(width: number) {
  mockWindow.width = width;
}

describe('FitDisplayText', () => {
  it.each([320, 360, 390])(
    'fits on one line before layout is measured on a %ipx-wide window',
    async (windowWidth) => {
      mockWindowWidth(windowWidth);
      await render(<FitDisplayText text="+285%" maxSize={136} horizontalInset={24} />);
      expect(widthAt('+285%', fontSizeOf('+285%'))).toBeLessThanOrEqual(windowWidth - 24);
    },
  );

  it('uses the measured width once layout is known', async () => {
    mockWindowWidth(390);
    await render(<FitDisplayText text="+285%" maxSize={136} />);
    await fireEvent(screen.getByTestId('fit-display-text'), 'layout', {
      nativeEvent: { layout: { width: 200, height: 100, x: 0, y: 0 } },
    });
    const size = fontSizeOf('+285%');
    expect(widthAt('+285%', size)).toBeLessThanOrEqual(200);
    expect(size).toBeGreaterThan(60);
  });

  it('keeps the maximum size on wide screens', async () => {
    mockWindowWidth(1280);
    await render(<FitDisplayText text="+285%" maxSize={136} />);
    expect(fontSizeOf('+285%')).toBe(136);
  });

  it('never truncates with an ellipsis', async () => {
    mockWindowWidth(320);
    await render(<FitDisplayText text="+285%" maxSize={136} />);
    expect(screen.getByText('+285%').props.ellipsizeMode).toBe('clip');
  });
});
