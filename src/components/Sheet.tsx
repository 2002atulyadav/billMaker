import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom sheet with a title and scrollable body. Children only mount while visible, so forms inside
 * start from fresh state on every open.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const pad = useSheetPadding();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sheetStyles.backdrop}>
        <View style={[sheetStyles.sheet, pad, { backgroundColor: c.card }]}>
          {visible ? (
            <ScrollView contentContainerStyle={{ gap: Spacing.four }} keyboardShouldPersistTaps="handled">
              <T style={{ fontSize: 20, fontWeight: '700' }}>{title}</T>
              {children}
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Bottom padding that clears the home indicator (34pt on Face ID iPhones, 0 on Touch ID ones and most
 * Androids), so the last button in a sheet is never under it.
 */
export function useSheetPadding() {
  const insets = useSafeAreaInsets();
  return { paddingBottom: Math.max(Spacing.five, insets.bottom + Spacing.three) };
}

/** Shared by every bottom sheet (Sheet, the item form and the item picker). */
export const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.five,
    maxHeight: '92%',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
