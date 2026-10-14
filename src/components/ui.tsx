import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function T({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  const c = useTheme();
  return <Text {...props} style={[{ color: muted ? c.textSecondary : c.text, fontSize: 15 }, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>
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
          <Text style={{ color: fg, fontWeight: '600', fontSize: 16 }}>{title}</Text>
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
      <Text style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>{label}</Text>
    </Pressable>
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

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.three },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: Spacing.four, alignItems: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: Spacing.two, padding: Spacing.six },
});
