/**
 * Create Account Edge Function
 * 
 * Creates a new user account after OTP verification.
 * Uses a signed token to ensure phone was verified.
 * 
 * Request body:
 * {
 *   signupToken: string,  // Signed token from verify-otp
 *   password: string,     // User's password
 *   name: string          // User's display name
 * }
 * 
 * Response (always 200 for business logic):
 * {
 *   success: boolean,
 *   message: string,
 *   user?: { id, email, phone, name }
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
    const { signupToken, password, name } = await req.json() as {
      signupToken: string;
      password: string;
      name: string;
    };

    // Validate inputs
    if (!signupToken || !password || !name) {
      return jsonResponse({ success: false, message: 'Signup token, password, and name are required' });
    }

    if (password.length < 6) {
      return jsonResponse({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (name.trim().length < 2) {
      return jsonResponse({ success: false, message: 'Name must be at least 2 characters' });
    }

    // Verify the signup token
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || 'fallback-secret';
    const tokenResult = await verifyResetToken(signupToken, 'signup', jwtSecret);

    if (!tokenResult.valid || !tokenResult.phone) {
      return jsonResponse({
        success: false,
        message: tokenResult.error || 'Invalid or expired signup token. Please try again.'
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

    // Convert phone to email
    const digits = phone.replace(/\D/g, '');
    const email = `${digits}@settle.phone`;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
      return jsonResponse({
        success: false,
        message: 'This phone number is already registered. Please sign in.'
      });
    }

    // Create user with admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since we verified via OTP
      user_metadata: {
        name: name.trim(),
        phone,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return jsonResponse({ success: false, message: 'Failed to create account. Please try again.' });
    }

    // Create user profile in users table
    if (authData.user) {
      // Check for existing shadow user
      const { data: shadowUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone', phone)
        .eq('is_registered', false)
        .single();

      if (shadowUser) {
        // Claim shadow account: Update ID to match key and set registered
        // This relies on ON UPDATE CASCADE for foreign keys
        const { error: claimError } = await supabaseAdmin
          .from('users')
          .update({
            id: authData.user.id,
            name: name.trim(),
            is_registered: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', shadowUser.id);

        if (claimError) {
          console.error('Error claiming shadow profile:', claimError);
          // Try fallback insert if update failed (though likely constraints will block it)
        } else {
          console.log(`Successfully claimed shadow user ${shadowUser.id} for ${authData.user.id}`);
        }
      } else {
        // Normal insert
        const { error: profileError } = await supabaseAdmin.from('users').insert({
          id: authData.user.id,
          phone,
          name: name.trim(),
          is_registered: true, // Explicitly set true for new accounts
        });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          // Don't fail - user is created in auth
        }
      }
    }

    // Invalidate all OTPs for this phone
    await supabaseAdmin
      .from('otp_requests')
      .update({ expires_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('purpose', 'signup');

    return jsonResponse({
      success: true,
      message: 'Account created successfully',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        phone,
        name: name.trim(),
      },
    });

  } catch (error) {
    console.error('Error in create-account:', error);
    return jsonResponse({ success: false, message: 'Something went wrong. Please try again.' });
  }
});
