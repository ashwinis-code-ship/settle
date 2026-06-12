/**
 * App color tokens — split into brand (product identity) and platform (chrome/surfaces).
 *
 * Use `brand` for CTAs, balances, and data viz.
 * Use `platform` for backgrounds, surfaces, text, and neutrals.
 * The flat `colors` export remains for backward compatibility.
 */

/** Brand accents — CTAs, balance indicators, charts */
export const brand = {
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50',
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
  },
  accent: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107',
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#6B7280',
  chart: [
    '#4CAF50',
    '#22C55E',
    '#9333EA',
    '#F97316',
    '#06B6D4',
    '#EC4899',
    '#14B8A6',
    '#F59E0B',
  ] as string[],
} as const;

/** Platform chrome — surfaces, text, neutrals */
export const platform = {
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  background: {
    light: '#F3F4F6',
    dark: '#0F172A',
  },
  surface: {
    light: '#FFFFFF',
    dark: '#1E293B',
  },
  /** M3 surface container — elevated chips, filter scrubber highlight */
  surfaceContainer: {
    light: '#F3F4F6',
    dark: '#334155',
  },
  text: {
    light: {
      primary: '#111827',
      secondary: '#4B5563',
      tertiary: '#9CA3AF',
    },
    dark: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#6B7280',
    },
  },
} as const;

/** Flat palette — prefer brand/platform in new code */
export const colors = {
  ...brand,
  ...platform,
} as const;

export type ColorScheme = 'light' | 'dark';
