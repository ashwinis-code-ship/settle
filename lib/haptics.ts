/**
 * Haptic Feedback Utilities
 * 
 * Provides consistent haptic feedback throughout the app.
 * Only triggers on iOS; Android handles its own haptics.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isIOS = Platform.OS === 'ios';

/**
 * Light tap feedback - for button presses, card taps, navigation
 */
export const hapticLight = () => {
  if (isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

/**
 * Medium impact - for confirming actions, selections
 */
export const hapticMedium = () => {
  if (isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

/**
 * Heavy impact - for destructive actions, important confirmations
 */
export const hapticHeavy = () => {
  if (isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

/**
 * Success notification - for completed actions, successful saves
 */
export const hapticSuccess = () => {
  if (isIOS) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Warning notification - for validation errors, warnings
 */
export const hapticWarning = () => {
  if (isIOS) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

/**
 * Error notification - for failed operations, errors
 */
export const hapticError = () => {
  if (isIOS) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

/**
 * Selection changed - for pickers, toggles, selections
 */
export const hapticSelection = () => {
  if (isIOS) {
    Haptics.selectionAsync();
  }
};
