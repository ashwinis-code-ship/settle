/**
 * Utility functions
 */

/**
 * Formats a phone number by stripping all special characters except the leading +.
 * Example: "+1 (555) 123-4567" -> "+15551234567"
 * Example: "0798 123 456" -> "0798123456"
 */
export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';

    const hasPlus = phone.trim().startsWith('+');
    const stripped = phone.replace(/\D/g, '');

    return hasPlus ? `+${stripped}` : stripped;
};
