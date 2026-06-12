/**
 * SF Symbol → Material Icons mapping for cross-platform IconSymbol.
 * Keys are SF Symbol names used throughout the app.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export const ICON_SYMBOL_MAPPING = {
  'plus': 'add',
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  'exclamationmark.circle': 'error-outline',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.down': 'keyboard-arrow-down',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle-outline',
  'checkmark.circle.fill': 'check-circle',
  'xmark': 'close',
  'xmark.circle': 'cancel',
  'lock': 'lock-outline',
  'square.grid.2x2': 'grid-view',
  'person': 'person-outline',
  'person.2': 'people-outline',
  'person.2.fill': 'people',
  'person.badge.plus': 'person-add',
  'bubble.left': 'chat-bubble-outline',
  'trash': 'delete-outline',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'gearshape': 'settings',
  'archivebox': 'archive',
  'arrow.left.arrow.right': 'swap-horiz',
  'doc.text': 'description',
  'magnifyingglass': 'search',
  'camera.fill': 'camera-alt',
  'checkmark.shield': 'verified-user',
  'key': 'vpn-key',
  'creditcard': 'credit-card',
  'creditcard.fill': 'account-balance-wallet',
  'envelope': 'mail-outline',
  'questionmark.circle': 'help-outline',
  'shield': 'shield',
  'dollarsign.circle': 'attach-money',
  'bell': 'notifications-none',
  'rectangle.portrait.and.arrow.right': 'logout',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'phone': 'phone',
  'moon.fill': 'dark-mode',
  'sun.max': 'wb-sunny',
  'arrow.down': 'arrow-downward',
  'arrow.up': 'arrow-upward',
  'circle': 'radio-button-unchecked',
  'arrow.triangle.2.circlepath': 'sync',
  'icloud.slash': 'cloud-off',
  'icloud.and.arrow.up': 'cloud-upload',
  'clock': 'access-time',
  'info.circle': 'info-outline',
  'arrow.up.circle': 'arrow-circle-up',
  'arrow.down.circle': 'arrow-circle-down',
  'bolt': 'flash-on',
} as const satisfies Record<string, MaterialIconName>;

export type IconSymbolName = keyof typeof ICON_SYMBOL_MAPPING;
