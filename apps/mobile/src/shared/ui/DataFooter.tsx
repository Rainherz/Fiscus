import { StyleSheet, View } from 'react-native';

import { formatDate } from '../format';
import { space } from '../theme/tokens';
import { MonoText } from './typography';

interface Props {
  finishedAt: string | null;
  isDemo: boolean;
}

export const SOURCE_NAME = 'MEF – Sistema de Seguimiento de Inversiones';

export function DataFooter({ finishedAt, isDemo }: Props) {
  return (
    <View style={styles.footer}>
      {isDemo ? (
        <MonoText bold size={11}>
          Modo demostración: datos de ejemplo.
        </MonoText>
      ) : null}
      {finishedAt ? (
        <MonoText size={11} muted>{`Datos actualizados el ${formatDate(finishedAt)}`}</MonoText>
      ) : null}
      <MonoText size={11} muted>{`Fuente: ${SOURCE_NAME}`}</MonoText>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.xs,
  },
});
