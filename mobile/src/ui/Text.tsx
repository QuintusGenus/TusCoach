import { Text as RNText, StyleSheet } from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';
import { colors, typography } from './theme';

type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'subtitle' | 'body' | 'bodyBold' | 'muted' | 'caption' | 'label';

interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

export function Text({
  variant = 'body',
  className = '',
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[variantStyles[variant], style]}
      className={className}
      {...rest}
    />
  );
}

const variantStyles = StyleSheet.create({
  h1: {
    ...typography.h1,
    color: colors.primary.main,
  },
  h2: {
    ...typography.h2,
    color: colors.primary.main,
  },
  h3: {
    ...typography.h3,
    color: colors.primary.main,
  },
  title: {
    ...typography.h2,
    color: colors.onSurface.main,
  },
  subtitle: {
    ...typography.h3,
    color: colors.onSurface.main,
  },
  body: {
    ...typography.body,
    color: colors.onSurface.main,
  },
  bodyBold: {
    ...typography.bodyBold,
    color: colors.onSurface.main,
  },
  muted: {
    ...typography.body,
    color: colors.onSurface.variant,
  },
  caption: {
    ...typography.caption,
    color: colors.onSurface.variant,
  },
  label: {
    ...typography.label,
    color: colors.onSurface.variant,
    textTransform: 'uppercase',
  },
});
