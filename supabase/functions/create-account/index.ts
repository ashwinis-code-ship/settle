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
 * Response:
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
      return new Response(
        JSON.stringify({ success: false, message: 'Signup token, password, and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, message: 'Name must be at least 2 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the signup token
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || 'fallback-secret';
    const tokenResult = await verifyResetToken(signupToken, 'signup', jwtSecret);

    if (!tokenResult.valid || !tokenResult.phone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: tokenResult.error || 'Invalid or expired signup token. Please try again.' 
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

    // Convert phone to email
    const digits = phone.replace(/\D/g, '');
    const email = `${digits}@settle.phone`;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'This phone number is already registered. Please sign in.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile in users table
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        phone,
        name: name.trim(),
      });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Don't fail - user is created in auth
      }
    }

    // Invalidate all OTPs for this phone
    await supabaseAdmin
      .from('otp_requests')
      .update({ expires_at: new Date().toISOString() })
      .eq('phone', phone)
      .eq('purpose', 'signup');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account created successfully',
        user: {
          id: authData.user?.id,
          email: authData.user?.email,
          phone,
          name: name.trim(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-account:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
