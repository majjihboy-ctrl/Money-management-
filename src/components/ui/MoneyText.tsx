import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatMoney } from '../../lib/money';
import { useTheme } from '../../hooks/useTheme';
import { typography } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';

interface MoneyTextProps {
  amount: string;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  color?: string;
  showSign?: boolean;
  style?: TextStyle;
}

export function MoneyText({
  amount,
  currency = 'KES',
  size = 'md',
  color,
  showSign,
  style,
}: MoneyTextProps) {
  const { colors } = useTheme();
  const hide = useAppStore((s) => s.hideBalances);
  const profile = useAppStore((s) => s.profile);
  const cur = currency || profile?.default_currency || 'KES';

  const sizeStyle =
    size === 'hero'
      ? typography.money
      : size === 'lg'
        ? typography.moneySm
        : size === 'sm'
          ? typography.captionBold
          : typography.bodyBold;

  let display = formatMoney(amount, cur, 'en-KE', { hide });
  if (showSign && !hide && parseFloat(amount) > 0) display = '+' + display;

  return (
    <Text style={[sizeStyle, { color: color || colors.text }, style]} accessibilityLabel={hide ? 'Balance hidden' : display}>
      {display}
    </Text>
  );
}
