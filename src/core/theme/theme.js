import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '../store/store';


export const lightTheme = {
  dark: false,
  colors: {
    background: '#F8FAFC', // Slate 50
    surface: '#FFFFFF',
    surfaceSecondary: '#F1F5F9', // Slate 100
    primary: '#6366F1', // Indigo 500
    primaryLight: '#E0E7FF', // Indigo 100
    secondary: '#8B5CF6', // Violet 500
    secondaryLight: '#EDE9FE', // Violet 100
    accent: '#F43F5E', // Rose 500
    accentLight: '#FFE4E6', // Rose 100
    text: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8', // Slate 400
    border: '#E2E8F0', // Slate 200
    borderMuted: '#F1F5F9', // Slate 100
    success: '#10B981', // Emerald 500
    warning: '#F59E0B', // Amber 500
    error: '#EF4444', // Red 500
    info: '#3B82F6', // Blue 500
    cardShadow: 'rgba(99, 102, 241, 0.05)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  roundness: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System-Medium',
      bold: 'System-Bold',
    },
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    background: '#09090B', // Zinc 950
    surface: '#18181B', // Zinc 900
    surfaceSecondary: '#27272A', // Zinc 800
    primary: '#818CF8', // Indigo 400
    primaryLight: '#312E81', // Indigo 900 (deep dark indigo)
    secondary: '#A78BFA', // Violet 400
    secondaryLight: '#4C1D95', // Violet 900 (deep dark violet)
    accent: '#FB7185', // Rose 400
    accentLight: '#881337', // Rose 900
    text: '#F4F4F5', // Zinc 100
    textSecondary: '#A1A1AA', // Zinc 400
    textMuted: '#71717A', // Zinc 500
    border: '#27272A', // Zinc 800
    borderMuted: '#1E1E21',
    success: '#34D399', // Emerald 400
    warning: '#FBBF24', // Amber 400
    error: '#F87171', // Red 400
    info: '#60A5FA', // Blue 400
    cardShadow: 'rgba(0, 0, 0, 0.5)',
  },
  spacing: lightTheme.spacing,
  roundness: lightTheme.roundness,
  typography: lightTheme.typography,
};

const parseTimeToMinutes = (timeStr, defaultVal) => {
  if (!timeStr) return defaultVal;
  try {
    const [time, ampm] = timeStr.split(' ');
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  } catch (err) {
    return defaultVal;
  }
};

const ThemeContext = createContext({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  themeMode: 'system',
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const storeThemeMode = useStore((state) => state.themeMode);
  const storeSunriseTime = useStore((state) => state.sunriseTime);
  const storeSunsetTime = useStore((state) => state.sunsetTime);

  const [theme, setTheme] = useState(
    storeThemeMode === 'dark' || (storeThemeMode === 'system' && systemColorScheme === 'dark')
      ? darkTheme
      : lightTheme
  );

  useEffect(() => {
    const updateTheme = () => {
      if (storeThemeMode === 'system') {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const sunriseMins = parseTimeToMinutes(storeSunriseTime, 6 * 60 + 2); // 6:02 AM
        const sunsetMins = parseTimeToMinutes(storeSunsetTime, 19 * 60 + 24); // 7:24 PM

        const isNightTime = currentMins >= sunsetMins || currentMins < sunriseMins;
        setTheme(isNightTime ? darkTheme : lightTheme);
      } else {
        setTheme(storeThemeMode === 'dark' ? darkTheme : lightTheme);
      }
    };

    updateTheme();
    const interval = setInterval(updateTheme, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [storeThemeMode, systemColorScheme, storeSunriseTime, storeSunsetTime]);

  const toggleTheme = () => {
    const nextMode = storeThemeMode === 'light' ? 'dark' : 'light';
    useStore.getState().setThemeMode(nextMode);
  };

  const setThemeMode = (mode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      useStore.getState().setThemeMode(mode);
    }
  };

  const isDark = theme.dark;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setThemeMode, themeMode: storeThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export const CATEGORY_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EAB308', // Yellow
  '#EF4444', // Red
];

export function getCategoryColor(category) {
  if (!category) return CATEGORY_COLORS[0];
  const cat = category.trim().toLowerCase();
  
  if (cat === 'general' || cat === 'other' || cat === 'others...') return '#94A3B8'; // Slate grey
  if (cat === 'personal') return '#10B981'; // Emerald
  if (cat === 'work') return '#F59E0B'; // Amber
  if (cat === 'ideas') return '#EC4899'; // Pink
  if (cat === 'food & dining') return '#EF4444'; // Red
  if (cat === 'transport') return '#3B82F6'; // Blue
  if (cat === 'shopping') return '#EC4899'; // Pink
  if (cat === 'entertainment') return '#8B5CF6'; // Violet
  if (cat === 'health' || cat === 'fitness') return '#10B981'; // Emerald
  if (cat === 'wealth' || cat === 'finance') return '#06B6D4'; // Cyan
  if (cat === 'learning' || cat === 'education') return '#8B5CF6'; // Violet

  // Dynamic hash mapping for custom categories
  let hash = 0;
  for (let i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index];
}
