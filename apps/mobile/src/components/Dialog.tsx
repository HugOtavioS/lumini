import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, navy, radius, shadows } from '@/theme';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ visible, onClose, children }: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.card}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={8}
            style={styles.close}
          >
            <X size={16} color={navy[600]} strokeWidth={2.5} />
          </Pressable>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    paddingTop: 28,
    ...shadows.level3,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: navy[100],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
