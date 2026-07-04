import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { colors, radius, shadows } from './theme';

interface CardProps {
  children: ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined' | 'glass';
  style?: ViewStyle;
  noPadding?: boolean;
  className?: string;
}

export function Card({
  children,
  variant = 'elevated',
  style,
  noPadding = false,
  className = '',
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        !noPadding && styles.padded,
        variant === 'elevated' && styles.elevated,
        variant === 'filled' && styles.filled,
        variant === 'outlined' && styles.outlined,
        variant === 'glass' && styles.glass,
        style,
      ]}
      className={className}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  padded: {
    padding: 20,
  },
  elevated: {
    backgroundColor: colors.surface.containerLowest,
    ...shadows.md,
  },
  filled: {
    backgroundColor: colors.surface.containerLow,
  },
  outlined: {
    backgroundColor: colors.surface.containerLowest,
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
  },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: colors.outline.variant + '33',
  },
});
