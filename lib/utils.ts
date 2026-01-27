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

/**
 * Formats a currency amount with the appropriate symbol.
 * Example: formatCurrency(1000, 'INR') -> "₹1,000"
 * Example: formatCurrency(1000, 'USD') -> "$1,000"
 */
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
    const symbols: Record<string, string> = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };
    const symbol = symbols[currency] || currency;
    const formattedAmount = Math.abs(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    return `${symbol}${formattedAmount}`;
};
