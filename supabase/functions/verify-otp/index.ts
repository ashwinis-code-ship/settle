/**
 * Verify OTP Edge Function
 * 
 * Verifies the OTP entered by the user.
 * For forgot_password, returns a signed reset token.
 * 
 * Request body:
 * {
 *   phone: string,       // Phone number with country code
 *   otp: string,         // 6-digit OTP entered by user
 *   purpose: string      // "signup" or "forgot_password"
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   verified?: boolean,
 *   attemptsRemaining?: number,
 *   resetToken?: string  // Only for forgot_password, used to authorize password reset
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { verifyOtpHash, OTP_CONFIG, type OtpPurpose } from '../_shared/otp.ts';
import { createResetToken } from '../_shared/token.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, otp, purpose } = await req.json() as { 
      phone: string; 
      otp: string; 
      purpose: OtpPurpose;
    };

    // Validate inputs
    if (!phone || !otp || !purpose) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone, OTP, and purpose are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ success: false, message: 'OTP must be 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Find the latest valid OTP for this phone/purpose
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_requests')
      .select('*')
      .eq('phone', phone)
      .eq('purpose', purpose)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No valid OTP found. Please request a new one.',
          verified: false,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Too many failed attempts. Please request a new OTP.',
          verified: false,
          attemptsRemaining: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify OTP
    const isValid = await verifyOtpHash(otp, otpRecord.otp_hash);

    if (!isValid) {
      // Increment attempts
      await supabase
        .from('otp_requests')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const attemptsRemaining = OTP_CONFIG.MAX_ATTEMPTS - (otpRecord.attempts + 1);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: attemptsRemaining > 0 
            ? `Invalid OTP. ${attemptsRemaining} attempts remaining.`
            : 'Invalid OTP. Please request a new one.',
          verified: false,
          attemptsRemaining,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('otp_requests')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error updating OTP:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to verify OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a signed token for the next step
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || 'fallback-secret';
    const token = await createResetToken(phone, purpose, jwtSecret);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP verified successfully',
        verified: true,
        // Return appropriate token based on purpose
        ...(purpose === 'forgot_password' && { resetToken: token }),
        ...(purpose === 'signup' && { signupToken: token }),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-otp:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
