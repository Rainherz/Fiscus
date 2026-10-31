import { Pressable, StyleSheet, View } from 'react-native';

import { formatDate } from '../format';
import { gutterFor, isWide, LAYOUT_MAX_WIDTH } from '../layout/breakpoints';
import { useBreakpoint } from '../layout/useBreakpoint';
import { colors, minTouch, rule, space } from '../theme/tokens';
import { MonoText } from './typography';

interface Props {
  /** Last successful SSI update. */
  finishedAt: string | null;
  /** Last open-data check (the file itself changes rarely). */
  openDataCheckedAt?: string | null;
  isDemo: boolean;
  /** Opens the guide ("Cómo leer estos datos"); the link is hidden when absent. */
  onPressGuide?: () => void;
  /** The Contraloría report with its edition, e.g. "(corte junio 2026)"; the plain name by default. */
  paralyzedSource?: string;
  /** INFOBRAS with the date its data describes, e.g. "(datos al 31/03/2026)"; the plain name by default. */
  infobrasSource?: string;
}

export const SOURCE_NAME = 'MEF – Sistema de Seguimiento de Inversiones';
/** Investments of every level that only the open-data file has (DETALLE_INVERSIONES.csv). */
export const OPEN_DATA_SOURCE_NAME = 'MEF – Datos Abiertos, Detalle de inversiones';
/** Closed investments of every level that only the closed-investments file has (CIERRE_INVERSIONES.csv). */
export const CLOSED_DATA_SOURCE_NAME = 'MEF – Datos Abiertos, Cierre de inversiones';
/** The official list of paralyzed works (Contraloría General de la República). */
export const PARALYZED_DATA_SOURCE_NAME = 'Contraloría – Informe de obras paralizadas';
/** The INFOBRAS open dataset of obras (Contraloría General de la República). */
export const INFOBRAS_DATA_SOURCE_NAME = 'Contraloría – INFOBRAS';

/** The source a project's figures come from (`investments.data_source`). */
export function sourceNameOf(dataSource: 'ssi' | 'open_data' | 'open_data_closed'): string {
  if (dataSource === 'open_data') return OPEN_DATA_SOURCE_NAME;
  if (dataSource === 'open_data_closed') return CLOSED_DATA_SOURCE_NAME;
  return SOURCE_NAME;
}

/**
 * Demo notice, last SSI update, last open-data check and sources. Phones show it as the last block of the screen; tablet
 * and desktop as a page footer: a full-width rule, sources on the left and the date on the right.
 */
export function DataFooter({
  finishedAt,
  openDataCheckedAt = null,
  isDemo,
  onPressGuide,
  paralyzedSource = PARALYZED_DATA_SOURCE_NAME,
  infobrasSource = INFOBRAS_DATA_SOURCE_NAME,
}: Props) {
  const breakpoint = useBreakpoint();
  const demo = isDemo ? (
    <MonoText bold size={11}>
      Modo demostración: datos de ejemplo.
    </MonoText>
  ) : null;
  const updated = finishedAt ? (
    <MonoText size={11} muted>{`Datos actualizados el ${formatDate(finishedAt)}`}</MonoText>
  ) : null;
  const openData = openDataCheckedAt ? (
    <MonoText size={11} muted>{`Datos abiertos revisados el ${formatDate(openDataCheckedAt)}`}</MonoText>
  ) : null;
  const guide = onPressGuide ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Cómo leer estos datos"
      onPress={onPressGuide}
      style={({ pressed }) => [styles.guide, pressed && styles.pressed]}>
      <MonoText bold size={12} style={styles.guideText}>
        Cómo leer estos datos →
      </MonoText>
    </Pressable>
  ) : null;
  const sources = (
    <MonoText size={11} muted>
      {`Fuentes: ${SOURCE_NAME}; ${OPEN_DATA_SOURCE_NAME}; ${CLOSED_DATA_SOURCE_NAME}; ${paralyzedSource}; ${infobrasSource}`}
    </MonoText>
  );

  if (isWide(breakpoint)) {
    return (
      <View testID="page-footer" role="contentinfo" style={styles.page}>
        <View testID="page-footer-row" style={[styles.pageRow, { paddingHorizontal: gutterFor(breakpoint) }]}>
          <View style={styles.sources}>
            {guide}
            {sources}
          </View>
          <View style={styles.status}>
            {demo}
            {updated}
            {openData}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.footer}>
      {demo}
      {updated}
      {openData}
      {sources}
      {guide}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.xs,
  },
  page: { marginTop: space.xl, borderTopWidth: rule, borderTopColor: colors.ink },
  pageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.xl,
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
    alignSelf: 'center',
    paddingVertical: space.lg,
  },
  sources: { flexShrink: 1, alignItems: 'flex-start' },
  guide: { minHeight: minTouch, justifyContent: 'center', alignSelf: 'flex-start' },
  guideText: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
  status: { alignItems: 'flex-end', gap: space.xs },
});
