import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fontFamily, typography, type FontWeight, type TypographyVariant } from '@/theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  weight?: FontWeight;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', weight, color = colors.text, align, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        weight && { fontFamily: fontFamily[weight] },
        { color, textAlign: align },
        style,
      ]}
    />
  );
}
