import { useColorScheme } from 'react-native';
import { colors, type ThemeColors } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const system = useColorScheme();
  const preference = useAppStore((s) => s.theme);
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
  return { colors: isDark ? colors.dark : colors.light, isDark };
}
