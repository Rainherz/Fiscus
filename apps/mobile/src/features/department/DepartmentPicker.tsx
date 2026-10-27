import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, maxContentWidth, minTouch, space } from '@/shared/theme/tokens';
import { DisplayText, MonoText } from '@/shared/ui/typography';

import { DEPARTMENTS } from './departments';

interface Props {
  visible: boolean;
  selectedCode: number;
  onSelect: (code: number) => void;
  onClose: () => void;
  topInset?: number;
  bottomInset?: number;
}

export function DepartmentPicker({ visible, selectedCode, onSelect, onClose, topInset = 0, bottomInset = 0 }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: topInset + space.md }]}>
        <View style={styles.header}>
          <DisplayText weight={900} size={26} style={styles.title} accessibilityRole="header">
            Elige una región
          </DisplayText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <MonoText bold size={13} style={styles.closeText}>
              CERRAR ✕
            </MonoText>
          </Pressable>
        </View>
        <ScrollView
          accessibilityRole="radiogroup"
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + space.lg }]}>
          {DEPARTMENTS.map((department) => {
            const checked = department.code === selectedCode;
            return (
              <Pressable
                key={department.code}
                accessibilityRole="radio"
                accessibilityLabel={department.name}
                accessibilityState={{ checked }}
                onPress={() => onSelect(department.code)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                <DisplayText size={22} style={{ color: checked ? colors.signal : colors.concrete }}>
                  {department.name}
                </DisplayText>
                {checked ? (
                  <MonoText bold size={12} style={{ color: colors.signal }}>
                    ACTUAL
                  </MonoText>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  title: { color: colors.signal },
  close: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: space.xs },
  closeText: { color: colors.concrete },
  list: { paddingHorizontal: space.lg, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: '#2A2A2A',
  },
  pressed: { opacity: 0.6 },
});
