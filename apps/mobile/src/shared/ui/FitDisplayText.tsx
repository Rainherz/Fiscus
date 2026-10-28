import { useState } from 'react';
import { View, useWindowDimensions, type LayoutChangeEvent, type TextStyle } from 'react-native';

import { maxContentWidth } from '../theme/tokens';
import { FIT_LETTER_SPACING_EM, fitFontSize } from './fitFontSize';
import { DisplayText } from './typography';

interface Props {
  text: string;
  maxSize: number;
  minSize?: number;
  /**
   * Horizontal space taken around the text inside the content column (padding minus negative
   * margins). Only used for the first render, before the real width is measured.
   */
  horizontalInset?: number;
  /**
   * Width of the column the text sits in, when it is not the page column (multi-column layouts).
   * Replaces the window-based estimate for the first render.
   */
  estimatedWidth?: number;
  style?: TextStyle;
  accessibilityLabel?: string;
}

/**
 * One-line Display 900 figure that shrinks to the available width. The size is computed from the
 * glyph advances on every platform (react-native-web ignores adjustsFontSizeToFit): first from
 * the window width, so the first paint already fits, then from the measured width.
 */
export function FitDisplayText({
  text,
  maxSize,
  minSize,
  horizontalInset = 0,
  estimatedWidth,
  style,
  accessibilityLabel,
}: Props) {
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const estimated = estimatedWidth ?? Math.min(window.width, maxContentWidth) - horizontalInset;
  const width = measured > 0 ? measured : estimated;
  const size = fitFontSize({ text, width, max: maxSize, min: minSize });
  const onLayout = (event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width);
  return (
    <View testID="fit-display-text" onLayout={onLayout} style={{ width: '100%' }}>
      <DisplayText
        weight={900}
        size={size}
        numberOfLines={1}
        ellipsizeMode="clip"
        adjustsFontSizeToFit
        minimumFontScale={0.3}
        accessibilityLabel={accessibilityLabel}
        style={[
          { lineHeight: Math.round(size * 0.95), letterSpacing: size * FIT_LETTER_SPACING_EM },
          style,
        ]}>
        {text}
      </DisplayText>
    </View>
  );
}
