/**
 * Shared animated checkbox — square (borderRadius 6) per UX convention.
 * Circles are for radio buttons (single-select); squares for multi-select.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { colors } from '@/constants/colors';

interface CheckboxProps {
  checked: boolean;
  /** Unchecked border colour; defaults to gray[400]. */
  borderColor?: string;
  size?: number;
}

export function Checkbox({ checked, borderColor = colors.gray[400], size = 22 }: CheckboxProps) {
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
        <Ionicons name="checkmark" size={Math.round(size * 0.64)} color={colors.white} />
      </MotiView>
    </MotiView>
  );
}
