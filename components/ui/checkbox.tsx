/**
 * Shared animated checkbox — square (borderRadius 6) per UX convention.
 * Circles are for radio buttons (single-select); squares for multi-select.
 * Checkmark color is theme-aware: white in dark mode, black in light mode for visibility on the green highlight.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CheckboxProps {
  checked: boolean;
  /** Unchecked border colour; defaults to gray[400]. */
  borderColor?: string;
  size?: number;
}

export function Checkbox({ checked, borderColor = colors.gray[400], size = 22 }: CheckboxProps) {
  const colorScheme = useColorScheme();
  const checkmarkColor = colorScheme === 'dark' ? colors.white : colors.black;

  return (
    <MotiView
      animate={{
        backgroundColor: checked ? colors.primary[500] : 'transparent',
        borderColor: checked ? colors.primary[500] : borderColor,
      }}
      transition={{ type: 'timing', duration: 110 }}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MotiView
        animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 500 }}
      >
        <Ionicons name="checkmark" size={Math.round(size * 0.64)} color={checkmarkColor} />
      </MotiView>
    </MotiView>
  );
}
