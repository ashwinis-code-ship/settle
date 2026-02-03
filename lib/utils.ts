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

/**
 * Formats a date as a human-readable distance from now.
 * Example: formatDistanceToNow(new Date(Date.now() - 60000)) -> "1 minute ago"
 * Example: formatDistanceToNow(new Date(Date.now() - 3600000)) -> "1 hour ago"
 */
export const formatDistanceToNow = (date: Date | string): string => {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return then.toLocaleDateString();
    }
};
