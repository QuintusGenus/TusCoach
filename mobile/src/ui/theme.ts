/**
 * TusCoach Design System — "TusCoach App"
 *
 * Material Design 3 inspired tokens.
 * Supports light + dark themes.
 *
 * Dark theme: accent color (#00445C) replaces white backgrounds,
 * text becomes white/light.
 */

import { useColorScheme } from 'react-native';
import { useThemeStore } from '../state/themeStore';

// ═══════════════════════════════════════════════════════════════
// LIGHT PALETTE
// ═══════════════════════════════════════════════════════════════
const lightColors = {
  primary: {
    main: '#00445C',
    container: '#035D7B',
    onPrimary: '#FFFFFF',
    onContainer: '#92D4F7',
    fixed: '#C1E8FF',
    fixedDim: '#8DCFF2',
  },
  secondary: {
    main: '#006A62',
    container: '#81F3E5',
    onSecondary: '#FFFFFF',
    onContainer: '#006F66',
    fixed: '#84F5E8',
    fixedDim: '#66D9CC',
  },
  tertiary: {
    main: '#771F00',
    container: '#A02C00',
    onTertiary: '#FFFFFF',
    onContainer: '#FFBCA8',
    fixed: '#FFDBD0',
    fixedDim: '#FFB59F',
  },
  surface: {
    main: '#F6FAFB',
    dim: '#D6DBDC',
    bright: '#F6FAFB',
    containerLowest: '#FFFFFF',
    containerLow: '#F0F4F5',
    container: '#EAEEF0',
    containerHigh: '#E5E9EA',
    containerHighest: '#DFE3E4',
    variant: '#DFE3E4',
    tint: '#176684',
    inverse: '#2C3132',
  },
  onSurface: {
    main: '#181C1D',
    variant: '#3F4949',
    inverse: '#EDF1F2',
  },
  outline: {
    main: '#6F7979',
    variant: '#BEC8C9',
  },
  error: {
    main: '#BA1A1A',
    container: '#FFDAD6',
    onError: '#FFFFFF',
    onContainer: '#93000A',
  },
  success: '#22C55E',
  warning: '#FFB020',
  danger: '#EF4444',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
  background: '#F6FAFB',
} as const;

// ═══════════════════════════════════════════════════════════════
// DARK PALETTE — accent color as background, white text
// ═══════════════════════════════════════════════════════════════
const darkColors = {
  primary: {
    main: '#8DCFF2',
    container: '#004D66',
    onPrimary: '#00344A',
    onContainer: '#C1E8FF',
    fixed: '#C1E8FF',
    fixedDim: '#8DCFF2',
  },
  secondary: {
    main: '#66D9CC',
    container: '#005049',
    onSecondary: '#003731',
    onContainer: '#81F3E5',
    fixed: '#84F5E8',
    fixedDim: '#66D9CC',
  },
  tertiary: {
    main: '#FFB59F',
    container: '#6B1800',
    onTertiary: '#5A1200',
    onContainer: '#FFDBD0',
    fixed: '#FFDBD0',
    fixedDim: '#FFB59F',
  },
  surface: {
    main: '#0E1415',
    dim: '#0E1415',
    bright: '#343A3B',
    containerLowest: '#090F10',
    containerLow: '#181C1D',
    container: '#1C2122',
    containerHigh: '#262B2C',
    containerHighest: '#313637',
    variant: '#3F4949',
    tint: '#8DCFF2',
    inverse: '#DFE3E4',
  },
  onSurface: {
    main: '#DFE3E4',
    variant: '#BEC8C9',
    inverse: '#2C3132',
  },
  outline: {
    main: '#899393',
    variant: '#3F4949',
  },
  error: {
    main: '#FFB4AB',
    container: '#93000A',
    onError: '#690005',
    onContainer: '#FFDAD6',
  },
  success: '#4ADE80',
  warning: '#FFD060',
  danger: '#FF8A80',
  info: '#60A5FA',
  white: '#FFFFFF',
  black: '#000000',
  background: '#0E1415',
} as const;

// ═══════════════════════════════════════════════════════════════
// HOOK — returns the correct palette based on user preference
// ═══════════════════════════════════════════════════════════════
// Widen literal types for cross-palette compatibility
type DeepString<T> = T extends string ? string : { [K in keyof T]: DeepString<T[K]> };
export type AppColors = DeepString<typeof lightColors>;

export function useThemeColors(): AppColors {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  if (mode === 'system') {
    return systemScheme === 'dark' ? darkColors : lightColors;
  }
  return mode === 'dark' ? darkColors : lightColors;
}

export function useIsDark(): boolean {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  if (mode === 'system') return systemScheme === 'dark';
  return mode === 'dark';
}

// ═══════════════════════════════════════════════════════════════
// STATIC EXPORTS — for files that can't use hooks (StyleSheet)
// These are LIGHT theme defaults. Screens should prefer useThemeColors().
// ═══════════════════════════════════════════════════════════════
export const colors = {
  ...lightColors,
  // Backward-compat shade scales
  primary: {
    ...lightColors.primary,
    50: '#E6F2F7', 100: '#C1E8FF', 200: '#8DCFF2', 300: '#5AB6E5',
    400: '#176684', 500: '#00445C', 600: '#003A4F', 700: '#002F42',
    800: '#002535', 900: '#001E2B',
  },
  secondary: {
    ...lightColors.secondary,
    50: '#E6F7F5', 100: '#B3EBE5', 200: '#81F3E5', 300: '#66D9CC',
    400: '#009E93', 500: '#006A62', 600: '#005049', 700: '#003D38',
    800: '#002B27', 900: '#00201D',
  },
  tertiary: {
    ...lightColors.tertiary,
    50: '#FFF3EF', 100: '#FFDBD0', 200: '#FFB59F', 300: '#FF8F6E',
    400: '#C04000', 500: '#771F00', 600: '#852300', 700: '#5C1800',
    800: '#3A0A00', 900: '#2A0700',
  },
  gray: {
    50: '#F6FAFB', 100: '#F0F4F5', 200: '#DFE3E4', 300: '#BEC8C9',
    400: '#6F7979', 500: '#3F4949', 600: '#2C3132', 700: '#232828',
    800: '#1C2021', 900: '#181C1D',
  },
  accent: {
    50: '#FFF3EF', 100: '#FFDBD0', 200: '#FFB59F', 300: '#FF8F6E',
    400: '#C04000', 500: '#FFB020', 600: '#E69D1A', 700: '#CC8A14',
    800: '#A66F0F', 900: '#80550A',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────
export const typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, lineHeight: 38, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.5 },
  labelWide: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 1.5 },
  tiny: { fontSize: 10, fontWeight: '600' as const, lineHeight: 12, letterSpacing: 0.5 },
} as const;

// ─── Spacing ─────────────────────────────────────────────────
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40,
} as const;

// ─── Radius ──────────────────────────────────────────────────
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────
export const shadows = {
  sm: { shadowColor: '#181C1D', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#181C1D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  lg: { shadowColor: '#181C1D', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  hero: { shadowColor: '#00445C', shadowOpacity: 0.20, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  topBar: { shadowColor: '#000000', shadowOpacity: 0.02, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 0 },
} as const;

// ─── Deprecated compat ──────────────────────────────────────
export const fontSize = { xs: 11, sm: 13, base: 15, lg: 17, xl: 20, '2xl': 24, '3xl': 30 } as const;
export const fontWeight = { normal: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' } as const;
