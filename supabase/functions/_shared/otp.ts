/**
 * OTP utilities for Edge Functions
 * 
 * Configuration via Supabase Secrets:
 * - MSG91_AUTH_KEY: Your MSG91 auth key (required for real SMS)
 * - MSG91_TEMPLATE_ID: Your DLT-registered template ID (required for India)
 * - MSG91_SENDER_ID: Your registered sender ID (optional, uses template default)
 * - OTP_USE_PLACEHOLDER: Set to "false" to enable real SMS (default: "true")
 */

// Configuration
export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  PLACEHOLDER_OTP: '123456',
};

/**
 * Check if placeholder mode is enabled
 * Controlled via OTP_USE_PLACEHOLDER environment variable
 * Default: true (use placeholder)
 */
function isPlaceholderMode(): boolean {
  const envValue = Deno.env.get('OTP_USE_PLACEHOLDER');
  // Only disable placeholder if explicitly set to "false"
  return envValue?.toLowerCase() !== 'false';
}

/**
 * Generate a random 6-digit OTP
 */
export function generateOtp(): string {
  if (isPlaceholderMode()) {
    console.log('[OTP] Placeholder mode enabled - using 123456');
    return OTP_CONFIG.PLACEHOLDER_OTP;
  }
  
  // Generate cryptographically secure random OTP
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const otp = (array[0] % 900000 + 100000).toString();
  return otp;
}

/**
 * Hash OTP for secure storage using SHA-256
 */
export async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify OTP hash
 */
export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  const otpHash = await hashOtp(otp);
  return otpHash === hash;
}

/**
 * Send SMS with OTP via MSG91
 * 
 * In placeholder mode: logs OTP and returns success
 * In production mode: sends real SMS via MSG91 API
 */
export async function sendSms(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  // Placeholder mode - just log and return success
  if (isPlaceholderMode()) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 [PLACEHOLDER SMS] To: ${phone}`);
    console.log(`🔑 OTP: ${otp}`);
    console.log(`📝 Message: "Your Settle verification code is: ${otp}. Valid for ${OTP_CONFIG.EXPIRY_MINUTES} minutes."`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return { success: true };
  }

  // Production mode - send via MSG91
  const authKey = Deno.env.get('MSG91_AUTH_KEY');
  const templateId = Deno.env.get('MSG91_TEMPLATE_ID');

  if (!authKey) {
    console.error('[SMS] MSG91_AUTH_KEY not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!templateId) {
    console.error('[SMS] MSG91_TEMPLATE_ID not configured');
    return { success: false, error: 'SMS template not configured' };
  }

  try {
    // Format phone: MSG91 expects country code + number without + prefix
    const formattedPhone = phone.replace('+', '');

    // MSG91 Send OTP API
    // Docs: https://docs.msg91.com/reference/send-otp
    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: formattedPhone,
        otp: otp,
        template_id: templateId,
      }),
    });

    const data = await response.json();
    console.log('[SMS] MSG91 Response:', JSON.stringify(data));

    if (data.type === 'success') {
      console.log(`[SMS] OTP sent successfully to ${phone}`);
      return { success: true };
    } else {
      console.error('[SMS] MSG91 error:', data.message);
      return { success: false, error: data.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('[SMS] Error:', error);
    return { success: false, error: 'SMS service error' };
  }
}

export type OtpPurpose = 'signup' | 'forgot_password';
