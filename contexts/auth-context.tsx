import { Analytics } from '@/lib/analytics';
import { AUTH_EVENTS } from '@/lib/analytics-events';
import { supabase } from '@/lib/supabase';
import { syncManager } from '@/lib/sync-manager';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Convert phone number to a unique email for Supabase Auth
 * This allows us to use email/password auth while identifying users by phone
 * Example: +919876543210 -> 919876543210@settle.phone
 */
function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@settle.phone`;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /**
   * Sign in with phone and password
   */
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  /**
   * Sign out the current user
   */
  signOut: () => Promise<void>;
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

      // Identify returning user in analytics
      if (session?.user) {
        Analytics.identify(session.user.id, {
          phone: session.user.phone,
          name: session.user.user_metadata?.name,
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (phone: string, password: string) => {
    // Track sign in attempt (only log phone prefix for privacy)
    Analytics.track(AUTH_EVENTS.SIGN_IN_STARTED, { 
      phone_prefix: phone.slice(0, 4) + '***' 
    });

    try {
      // Convert phone to email for Supabase Auth
      const email = phoneToEmail(phone);

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        
        // Track sign in failure
        Analytics.track(AUTH_EVENTS.SIGN_IN_FAILED, { 
          error_type: error.message?.includes('Invalid login credentials') 
            ? 'invalid_credentials' 
            : 'unknown'
        });

        // Provide user-friendly error messages
        if (error.message?.includes('Invalid login credentials')) {
          return { error: new Error('Invalid phone number or password') };
        }
        // Don't leak technical errors
        return { error: new Error('Something went wrong. Please try again later.') };
      }

      // Identify user in analytics on successful sign in
      if (data.user) {
        Analytics.identify(data.user.id, {
          phone: phone,
          name: data.user.user_metadata?.name,
          created_at: data.user.created_at,
        });
        Analytics.track(AUTH_EVENTS.SIGN_IN_COMPLETED);
      }

      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign in exception:', error);
      Analytics.track(AUTH_EVENTS.SIGN_IN_FAILED, { error_type: 'exception' });
      return { error: new Error('Something went wrong. Please try again later.') };
    }
  };

  const signOut = async () => {
    // Track sign out event
    Analytics.track(AUTH_EVENTS.SIGN_OUT);
    
    // Reset analytics identity (unlink future events from this user)
    Analytics.reset();

    // Clear all cached data before signing out
    await syncManager.clearLocalData();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      isLoading, 
      signIn, 
      signOut,
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
