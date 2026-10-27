import { StyleSheet } from 'react-native';

import { colors } from '../theme/tokens';
import { MonoText } from './typography';

export interface Tag {
  /** Short code shown in the box, e.g. "GL". */
  text: string;
  /** What screen readers announce instead, e.g. "Gobierno local". */
  label: string;
}

/** A small outlined code (government level) next to a project. */
export function LevelTag({ tag, inverted = false }: { tag: Tag; inverted?: boolean }) {
  return (
    <MonoText
      bold
      size={10}
      accessibilityLabel={tag.label}
      style={[styles.tag, inverted && styles.inverted]}>
      {tag.text}
    </MonoText>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 3,
    lineHeight: 14,
    alignSelf: 'flex-start',
  },
  inverted: { borderColor: colors.concrete, color: colors.concrete },
});
