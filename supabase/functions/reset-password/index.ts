/**
 * Reset Password Edge Function
 * 
 * Resets user password using a signed reset token from verify-otp.
 * This ensures the phone was verified before allowing password reset.
 * 
 * Request body:
 * {
 *   resetToken: string,  // Signed token from verify-otp
 *   password: string     // New password
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyResetToken } from '../_shared/token.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { resetToken, password } = await req.json() as { 
      resetToken: string; 
      password: string;
    };

    // Validate inputs
    if (!resetToken || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Reset token and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the reset token
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || 'fallback-secret';
    const tokenResult = await verifyResetToken(resetToken, 'forgot_password', jwtSecret);

    if (!tokenResult.valid || !tokenResult.phone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: tokenResult.error || 'Invalid or expired reset token. Please try again.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phone = tokenResult.phone;

    // Create admin client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Convert phone to email (same logic as in auth-context)
    const digits = phone.replace(/\D/g, '');
    const email = `${digits}@settle.phone`;

    // Find user by email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to find user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate all OTPs for this phone/purpose
    await supabaseAdmin
      .from('otp_requests')
      .update({ expires_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('purpose', 'forgot_password');

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-password:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
