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
 * Response (always 200 for business logic):
 * {
 *   success: boolean,
 *   message: string
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyResetToken } from '../_shared/token.ts';

// Helper to return JSON response
function jsonResponse(data: Record<string, unknown>) {
  return new Response(
    JSON.stringify(data),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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
      return jsonResponse({ success: false, message: 'Reset token and password are required' });
    }

    if (password.length < 6) {
      return jsonResponse({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Verify the reset token
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || 'fallback-secret';
    const tokenResult = await verifyResetToken(resetToken, 'forgot_password', jwtSecret);

    if (!tokenResult.valid || !tokenResult.phone) {
      return jsonResponse({ 
        success: false, 
        message: tokenResult.error || 'Invalid or expired reset token. Please try again.' 
      });
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
      return jsonResponse({ success: false, message: 'Failed to find user. Please try again.' });
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      return jsonResponse({ success: false, message: 'User not found. Please sign up.' });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return jsonResponse({ success: false, message: 'Failed to update password. Please try again.' });
    }

    // Invalidate all OTPs for this phone/purpose
    await supabaseAdmin
      .from('otp_requests')
      .update({ expires_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('purpose', 'forgot_password');

    return jsonResponse({ success: true, message: 'Password reset successfully' });

  } catch (error) {
    console.error('Error in reset-password:', error);
    return jsonResponse({ success: false, message: 'Something went wrong. Please try again.' });
  }
});
