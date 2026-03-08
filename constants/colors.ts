/**
 * App color palette
 */

export const colors = {
  // Primary brand colors
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50', // Main primary
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
  },

  // Secondary accent
  accent: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107', // Main accent
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },

  // Semantic colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Balance colors
  positive: '#22C55E', // You are owed (green)
  negative: '#EF4444', // You owe (red)
  neutral: '#6B7280',  // Settled

  // Neutrals
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

  // Background colors
  background: {
    light: '#FFFFFF',
    dark: '#0F172A',
  },

  // Surface colors (cards, modals)
  surface: {
    light: '#FFFFFF',
    dark: '#1E293B',
  },

  // Chart / data-viz palette (contribution bar, etc.)
  chart: [
    '#4CAF50', // primary green
    '#22C55E', // success green
    '#9333EA', // purple
    '#F97316', // orange
    '#06B6D4', // cyan
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F59E0B', // amber
  ] as string[],

  // Text colors
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

export type ColorScheme = 'light' | 'dark';
