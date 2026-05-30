// src/utils/theme.js
// Dadboard — warm, family-focused design system

export const colors = {
  primary: '#F07C2A',
  primaryLight: '#FFF0E5',
  primaryDark: '#C45E10',

  kids: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6'],
  kidsLight: ['#FEF3C7', '#D1FAE5', '#DBEAFE', '#FCE7F3', '#EDE9FE'],

  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  white: '#FFFFFF',
  bg: '#F9F7F4',
  bgCard: '#FFFFFF',
  border: '#EAE8E4',
  borderStrong: '#D4D0CA',
  textPrimary: '#1C1917',
  textSecondary: '#78716C',
  textTertiary: '#A8A29E',
  muted: '#E7E5E0',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodySmall: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },
  caption: { fontSize: 11, fontWeight: '400' },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};
