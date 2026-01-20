/**
 * OTP Service
 * 
 * Client-side service that calls Supabase Edge Functions for OTP operations.
 * 
 * SETUP REQUIRED:
 * 1. Run supabase/otp-schema.sql in Supabase SQL Editor
 * 2. Deploy Edge Functions: npm run supabase:functions:deploy -- send-otp
 * 3. Deploy Edge Functions: npm run supabase:functions:deploy -- verify-otp
 */

import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export type OtpPurpose = 'signup' | 'forgot_password';

export interface SendOtpResult {
  success: boolean;
  message: string;
  expiresIn?: number; // Seconds until OTP expires
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  verified?: boolean;
  attemptsRemaining?: number;
  resetToken?: string;  // Token for password reset (only for forgot_password)
  signupToken?: string; // Token for account creation (only for signup)
}

// ============================================
// CONFIGURATION
// ============================================

// OTP expiry in minutes (should match Edge Function config)
const OTP_EXPIRY_MINUTES = 5;

// Minimum seconds between OTP requests
const RESEND_COOLDOWN_SECONDS = 60;

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Send OTP to phone number via Edge Function
 */
export async function sendOtp(
  phone: string,
  purpose: OtpPurpose
): Promise<SendOtpResult> {
  try {
    // Validate phone
    if (!phone || phone.length < 10) {
      return { success: false, message: 'Invalid phone number' };
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke<SendOtpResult>('send-otp', {
      body: { phone, purpose },
    });

    if (error) {
      console.error('[OTP Service] Edge Function error:', error);
      
      // Check if it's a deployment issue
      if (error.message?.includes('non-2xx') || error.message?.includes('FunctionsHttpError')) {
        return { 
          success: false, 
          message: 'OTP service not available. Please ensure Edge Functions are deployed.' 
        };
      }
      
      return { 
        success: false, 
        message: error.message || 'Failed to send OTP. Please try again.' 
      };
    }

    // Handle null/undefined data
    if (!data) {
      return { 
        success: false, 
        message: 'Invalid response from server' 
      };
    }

    return data;
  } catch (error) {
    console.error('[OTP Service] Error:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

/**
 * Verify OTP entered by user via Edge Function
 */
export async function verifyOtp(
  phone: string,
  otp: string,
  purpose: OtpPurpose
): Promise<VerifyOtpResult> {
  try {
    // Validate inputs
    if (!phone || !otp) {
      return { success: false, message: 'Phone and OTP are required' };
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return { success: false, message: 'OTP must be 6 digits' };
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke<VerifyOtpResult>('verify-otp', {
      body: { phone, otp, purpose },
    });

    if (error) {
      console.error('[OTP Service] Edge Function error:', error);
      
      // Check if it's a deployment issue
      if (error.message?.includes('non-2xx') || error.message?.includes('FunctionsHttpError')) {
        return { 
          success: false, 
          message: 'OTP service not available. Please ensure Edge Functions are deployed.' 
        };
      }
      
      return { 
        success: false, 
        message: error.message || 'Verification failed. Please try again.' 
      };
    }

    // Handle null/undefined data
    if (!data) {
      return { 
        success: false, 
        message: 'Invalid response from server' 
      };
    }

    return data;
  } catch (error) {
    console.error('[OTP Service] Error:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

/**
 * Check if phone has a verified OTP (for account creation)
 * This still uses the database function directly for efficiency
 */
export async function checkOtpVerified(
  phone: string,
  purpose: OtpPurpose
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_otp_verified', {
      p_phone: phone,
      p_purpose: purpose,
    });

    if (error) {
      console.error('[OTP Service] Check error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('[OTP Service] Error:', error);
    return false;
  }
}

/**
 * Get resend cooldown in seconds
 */
export function getResendCooldown(): number {
  return RESEND_COOLDOWN_SECONDS;
}

/**
 * Get OTP expiry in minutes
 */
export function getOtpExpiry(): number {
  return OTP_EXPIRY_MINUTES;
}
