import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/I18nProvider';
import type { BillStatus } from '@/types';

/**
 * Text follows the phone's text-size setting, but only up to this factor. Beyond it, two-column rows
 * (qty | rate, label | amount) stop fitting on a 375pt-wide phone.
 */
export const MAX_FONT_SCALE = 1.4;

/** Screens stay readable on tablets and foldables instead of stretching edge to edge. */
export const CONTENT_MAX_WIDTH = 720;

/** contentContainerStyle for a screen's ScrollView or FlatList. */
export const screenContent = {
  padding: Spacing.four,
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const satisfies ViewStyle;

export function T({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  const c = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...props}
      style={[{ color: muted ? c.textSecondary : c.text, fontSize: 15 }, style]}
    />
  );
}

/**
 * A screen's scrolling body. On iOS the content insets follow the keyboard (whatever the header and
 * home-indicator heights are on that phone), so the focused field is never hidden.
 */
export function Screen({
  contentContainerStyle,
  children,
  ref,
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      {...props}
      contentContainerStyle={[screenContent, { gap: Spacing.four }, contentContainerStyle]}>
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onLayout,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: ViewProps['onLayout'];
}) {
  const c = useTheme();
  return (
    <View onLayout={onLayout} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <T muted style={styles.sectionTitle}>
      {children}
    </T>
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const c = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? <T muted style={styles.label}>{label}</T> : null}
      <TextInput
        placeholderTextColor={c.textSecondary}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        {...props}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.background, borderColor: error ? c.danger : c.border },
          props.multiline && { minHeight: 72, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? <T style={{ color: c.danger, fontSize: 12 }}>{error}</T> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? 'transparent' : c.chip;
  const fg = variant === 'primary' ? c.primaryText : variant === 'danger' ? c.danger : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: c.danger },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          {/* flexShrink lets long labels (Hindi, side-by-side buttons on small phones) wrap instead of spilling out */}
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{ color: fg, fontWeight: '600', fontSize: 16, flexShrink: 1, textAlign: 'center' }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.chip : 'transparent' },
      ]}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Small pill showing whether a bill is paid. */
export function StatusBadge({ status }: { status: BillStatus }) {
  const c = useTheme();
  const { t } = useT();
  const color = status === 'paid' ? c.success : c.warning;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
        {t(status === 'paid' ? 'common.paid' : 'common.unpaid')}
      </Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <T style={{ fontSize: 18, fontWeight: '600' }}>{title}</T>
      <T muted style={{ textAlign: 'center' }}>{message}</T>
    </View>
  );
}

/**
 * Floating action button pinned to the bottom of a screen. Inside the tab bar the tabs already clear
 * the home indicator; on stack screens pass `overHomeIndicator` so it sits above it.
 */
export function Fab({ children, overHomeIndicator }: { children: ReactNode; overHomeIndicator?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottom = Spacing.four + (overHomeIndicator ? insets.bottom : 0);
  return (
    <View pointerEvents="box-none" style={[styles.fab, { bottom }]}>
      <View style={styles.fabInner}>{children}</View>
    </View>
  );
}

/** Bottom padding for a list under a Fab, so the last row can scroll clear of it. */
export const FAB_CLEARANCE = 120;

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.three },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 16 },
  button: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, maxWidth: '100%' },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  fab: { position: 'absolute', left: 0, right: 0, paddingHorizontal: Spacing.four, alignItems: 'center' },
  fabInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH - 2 * Spacing.four },
  empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.six },
});
