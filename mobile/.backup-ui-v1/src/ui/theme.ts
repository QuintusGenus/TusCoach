/**
 * Design tokens that complement the Tailwind config.
 * Use these when you need values in JS (e.g. chart libraries, Reanimated).
 * For normal views prefer className strings via NativeWind.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const colors = {
  primary: {
    50: "#f0f7f3",
    100: "#dceee4",
    200: "#b8ddc8",
    300: "#85c5a3",
    400: "#4da678",
    500: "#2a8a55",
    600: "#004225",
    700: "#003620",
    800: "#002a18",
    900: "#001e10",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  white: "#ffffff",
  black: "#000000",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
