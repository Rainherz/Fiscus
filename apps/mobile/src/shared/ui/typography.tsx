import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '../theme/tokens';

interface DisplayProps extends TextProps {
  weight?: 800 | 900;
  size?: number;
}

/** Big Shoulders Display, uppercase. */
export function DisplayText({ weight = 800, size = 22, style, ...props }: DisplayProps) {
  return (
    <Text
      {...props}
      style={[
        styles.display,
        {
          fontFamily: weight === 900 ? fonts.display900 : fonts.display800,
          fontSize: size,
          lineHeight: Math.round(size * 1.0),
        },
        style,
      ]}
    />
  );
}

interface MonoProps extends TextProps {
  bold?: boolean;
  size?: number;
  muted?: boolean;
}

/** JetBrains Mono for figures, codes and labels. */
export function MonoText({ bold = false, size = 13, muted = false, style, ...props }: MonoProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        {
          fontFamily: bold ? fonts.mono700 : fonts.mono400,
          fontSize: size,
          color: muted ? colors.muted : colors.ink,
        },
        style,
      ]}
    />
  );
}

interface BodyProps extends TextProps {
  weight?: 400 | 600 | 700;
  size?: number;
  muted?: boolean;
}

/** Inter Tight for names and running text. */
export function BodyText({ weight = 400, size = 15, muted = false, style, ...props }: BodyProps) {
  const fontFamily = weight === 700 ? fonts.body700 : weight === 600 ? fonts.body600 : fonts.body400;
  return (
    <Text
      {...props}
      style={[
        styles.base,
        { fontFamily, fontSize: size, lineHeight: Math.round(size * 1.3), color: muted ? colors.muted : colors.ink },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.ink },
  display: { color: colors.ink, textTransform: 'uppercase' },
});
