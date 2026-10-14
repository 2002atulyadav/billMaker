export const Colors = {
  light: {
    text: '#111418',
    textSecondary: '#60646C',
    background: '#F6F7F9',
    card: '#FFFFFF',
    border: '#E0E1E6',
    primary: '#1F6FEB',
    primaryText: '#FFFFFF',
    danger: '#D93036',
    success: '#1A7F37',
    warning: '#9A6700',
    chip: '#EEF3FE',
  },
  dark: {
    text: '#EDEEF0',
    textSecondary: '#B0B4BA',
    background: '#0B0D10',
    card: '#17191C',
    border: '#2E3135',
    primary: '#4C8DF6',
    primaryText: '#FFFFFF',
    danger: '#FF6369',
    success: '#3FB950',
    warning: '#D29922',
    chip: '#1B2433',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;
