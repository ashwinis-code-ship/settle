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
 * Response:
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, purpose } = await req.json() as { phone: string; purpose: OtpPurpose };

    // Validate inputs
    if (!phone || !purpose) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone and purpose are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['signup', 'forgot_password'].includes(purpose)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid purpose' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone format (basic check)
    if (!/^\+\d{10,15}$/.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid phone format. Use +CountryCodeNumber' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();

    // Check if user exists (for signup, should NOT exist; for forgot_password, SHOULD exist)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (purpose === 'signup' && existingUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone number already registered. Please sign in.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (purpose === 'forgot_password' && !existingUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone number not found. Please sign up.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Please wait ${waitTime} seconds before requesting another OTP` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS
    const smsResult = await sendSms(phone, otp);
    if (!smsResult.success) {
      return new Response(
        JSON.stringify({ success: false, message: smsResult.error || 'Failed to send SMS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `OTP sent to ${phone}`,
        expiresIn: OTP_CONFIG.EXPIRY_MINUTES * 60,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-otp:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
