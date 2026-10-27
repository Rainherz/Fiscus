import { useState } from 'react';
import { View, type LayoutChangeEvent, type TextStyle } from 'react-native';

import { fitFontSize } from './fitFontSize';
import { DisplayText } from './typography';

interface Props {
  text: string;
  maxSize: number;
  minSize?: number;
  style?: TextStyle;
  accessibilityLabel?: string;
}

/**
 * One-line Display 900 figure that shrinks to the available width. Measured on every platform
 * (react-native-web ignores adjustsFontSizeToFit); native also gets adjustsFontSizeToFit as backup.
 */
export function FitDisplayText({ text, maxSize, minSize, style, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  const size = fitFontSize({ text, width, max: maxSize, min: minSize });
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <DisplayText
        weight={900}
        size={size}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.3}
        accessibilityLabel={accessibilityLabel}
        style={[{ lineHeight: Math.round(size * 0.95), letterSpacing: -size * 0.025 }, style]}>
        {text}
      </DisplayText>
    </View>
  );
}
