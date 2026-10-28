import { StyleSheet, View } from 'react-native';

import { formatDate } from '../format';
import { space } from '../theme/tokens';
import { MonoText } from './typography';

interface Props {
  finishedAt: string | null;
  isDemo: boolean;
}

export const SOURCE_NAME = 'MEF – Sistema de Seguimiento de Inversiones';
/** Investments of every level that only the open-data file has (DETALLE_INVERSIONES.csv). */
export const OPEN_DATA_SOURCE_NAME = 'MEF – Datos Abiertos, Detalle de inversiones';

/** The source a project's figures come from (`investments.data_source`). */
export function sourceNameOf(dataSource: 'ssi' | 'open_data'): string {
  return dataSource === 'open_data' ? OPEN_DATA_SOURCE_NAME : SOURCE_NAME;
}

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
      <MonoText size={11} muted>{`Fuentes: ${SOURCE_NAME}; ${OPEN_DATA_SOURCE_NAME}`}</MonoText>
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
