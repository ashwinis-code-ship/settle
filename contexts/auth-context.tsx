import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { checkOtpVerified } from '@/lib/otp-service';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Convert phone number to a unique email for Supabase Auth
 * This allows us to use email/password auth while identifying users by phone
 * Example: +919876543210 -> 919876543210@settle.phone
 */
function phoneToEmail(phone: string): string {
  // Remove + and any non-digit characters
  const digits = phone.replace(/\D/g, '');
  return `${digits}@settle.phone`;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /**
   * Sign up with phone and password after OTP verification
   * @param phone - Phone number with country code
   * @param password - User password
   * @param name - User's display name
   */
  signUp: (phone: string, password: string, name: string) => Promise<{ error: Error | null }>;
  /**
   * Sign in with phone and password
   */
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  /**
   * Sign out the current user
   */
  signOut: () => Promise<void>;
  /**
   * Update password (for forgot password flow)
   */
  updatePassword: (phone: string, newPassword: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (phone: string, password: string, name: string) => {
    try {
      // Verify that OTP was verified for this phone
      const otpVerified = await checkOtpVerified(phone, 'signup');
      if (!otpVerified) {
        return { error: new Error('Please verify your phone number first') };
      }

      // Convert phone to email for Supabase Auth
      const email = phoneToEmail(phone);

      // Create user with Supabase Auth using email
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Skip email confirmation since we verified via OTP
          emailRedirectTo: undefined,
          data: {
            name,
            phone,
          },
        },
      });

      if (error) {
        // Handle duplicate user
        if (error.message?.includes('already registered')) {
          return { error: new Error('This phone number is already registered. Please sign in.') };
        }
        return { error: error as Error };
      }

      // Create user profile in the users table
      if (data.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          phone,
          name,
        });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          // Don't return error, the user is created in auth
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (phone: string, password: string) => {
    try {
      // Convert phone to email for Supabase Auth
      const email = phoneToEmail(phone);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Provide user-friendly error messages
        if (error.message?.includes('Invalid login credentials')) {
          return { error: new Error('Invalid phone number or password') };
        }
        return { error: error as Error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updatePassword = async (phone: string, newPassword: string) => {
    try {
      // Verify that OTP was verified for this phone (forgot password flow)
      const otpVerified = await checkOtpVerified(phone, 'forgot_password');
      if (!otpVerified) {
        return { error: new Error('Please verify your phone number first') };
      }

      // For forgot password, we need to use admin API or a different approach
      // Since we can't update password without being logged in, 
      // we'll use a Supabase Edge Function for this in production
      // For now, this is a placeholder
      
      // In production, call an Edge Function that:
      // 1. Verifies the OTP was recently verified
      // 2. Uses service role to update the user's password
      
      console.log('[Auth] Password update requested for:', phone);
      
      return { error: new Error('Password reset requires Edge Function (coming soon)') };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      isLoading, 
      signUp, 
      signIn, 
      signOut,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
