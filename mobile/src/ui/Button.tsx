import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius, shadows } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tonal';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.5 },
      ]}
      className={className}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary.main}
          style={{ marginRight: 8 }}
        />
      )}
      <Text style={[sizeStyle.text, variantStyle.text]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const variantStyles = {
  primary: StyleSheet.create({
    container: {
      backgroundColor: colors.primary.main,
      ...shadows.md,
    },
    text: {
      color: colors.primary.onPrimary,
      fontWeight: '700',
    },
  }),
  secondary: StyleSheet.create({
    container: {
      backgroundColor: colors.surface.containerLow,
    },
    text: {
      color: colors.onSurface.main,
      fontWeight: '600',
    },
  }),
  tonal: StyleSheet.create({
    container: {
      backgroundColor: colors.secondary.container,
    },
    text: {
      color: colors.secondary.onContainer,
      fontWeight: '600',
    },
  }),
  outline: StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.outline.variant,
    },
    text: {
      color: colors.primary.main,
      fontWeight: '600',
    },
  }),
  ghost: StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: colors.primary.main,
      fontWeight: '600',
    },
  }),
  danger: StyleSheet.create({
    container: {
      backgroundColor: colors.error.main,
    },
    text: {
      color: colors.white,
      fontWeight: '700',
    },
  }),
};

const sizeStyles = {
  sm: StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    text: {
      fontSize: 13,
    },
  }),
  md: StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: radius.md,
    },
    text: {
      fontSize: 15,
    },
  }),
  lg: StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: radius.lg,
    },
    text: {
      fontSize: 17,
    },
  }),
};
