/**
 * Send OTP Edge Function
 * 
 * Generates an OTP, stores it in the database, and sends it via SMS.
 * 
 * Request body:
 * {
 *   phone: string,       // Phone number with country code (e.g., "+919876543210")
 *   purpose: string      // "signup" or "forgot_password"
 * }
 * 
 * Response (always 200 for business logic, use success field):
 * {
 *   success: boolean,
 *   message: string,
 *   expiresIn?: number   // Seconds until OTP expires
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { generateOtp, hashOtp, sendSms, OTP_CONFIG, type OtpPurpose } from '../_shared/otp.ts';

// Helper to return JSON response (always 200 for business logic)
function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, purpose } = await req.json() as { phone: string; purpose: OtpPurpose };

    // Validate inputs
    if (!phone || !purpose) {
      return jsonResponse({ success: false, message: 'Phone and purpose are required' });
    }

    if (!['signup', 'forgot_password'].includes(purpose)) {
      return jsonResponse({ success: false, message: 'Invalid purpose' });
    }

    // Validate phone format (basic check)
    if (!/^\+\d{10,15}$/.test(phone)) {
      return jsonResponse({ success: false, message: 'Invalid phone format. Use +CountryCodeNumber' });
    }

    const supabase = getSupabaseClient();

    // Check if user exists (for signup, should NOT exist as registered; for forgot_password, SHOULD exist as registered)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, is_registered')
      .eq('phone', phone)
      .single();

    // For signup: block only if user exists AND is registered
    // Shadow users (is_registered = false) should be allowed to sign up and claim their account
    if (purpose === 'signup' && existingUser?.is_registered === true) {
      return jsonResponse({ 
        success: false, 
        message: 'This phone number is already registered. Please sign in instead.' 
      });
    }

    // For forgot_password: only allow if user exists AND is registered
    // Shadow users can't reset password since they never set one
    if (purpose === 'forgot_password' && (!existingUser || existingUser.is_registered === false)) {
      return jsonResponse({ 
        success: false, 
        message: 'No account found with this phone number. Please sign up.' 
      });
    }

    // Check for recent OTP (rate limiting)
    const { data: recentOtp } = await supabase
      .from('otp_requests')
      .select('created_at')
      .eq('phone', phone)
      .eq('purpose', purpose)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Within last 60 seconds
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentOtp) {
      const waitTime = Math.ceil((60000 - (Date.now() - new Date(recentOtp.created_at).getTime())) / 1000);
      return jsonResponse({ 
        success: false, 
        message: `Please wait ${waitTime} seconds before requesting another OTP` 
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);

    // Invalidate previous OTPs for this phone/purpose
    await supabase
      .from('otp_requests')
      .update({ expires_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('purpose', purpose)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString());

    // Store new OTP
    const { error: insertError } = await supabase
      .from('otp_requests')
      .insert({
        phone,
        otp_hash: otpHash,
        purpose,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return jsonResponse({ success: false, message: 'Failed to generate OTP. Please try again.' });
    }

    // Send SMS
    const smsResult = await sendSms(phone, otp);
    if (!smsResult.success) {
      return jsonResponse({ success: false, message: smsResult.error || 'Failed to send SMS' });
    }

    return jsonResponse({ 
      success: true, 
      message: `OTP sent to ${phone}`,
      expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60,
    });

  } catch (error) {
    console.error('Error in send-otp:', error);
    return jsonResponse({ success: false, message: 'Something went wrong. Please try again.' });
  }
});
