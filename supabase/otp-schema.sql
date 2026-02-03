-- ============================================
-- OTP REQUESTS SCHEMA
-- ============================================
-- Run this in your Supabase SQL Editor after the main schema.sql
-- This creates the OTP table and helper functions for the Edge Functions.
--
-- The Edge Functions (send-otp, verify-otp) handle the business logic.
-- This schema provides the data layer.
-- ============================================

-- ============================================
-- OTP REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.otp_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,           -- SHA-256 hash of OTP
    purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'forgot_password')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,           -- Failed verification attempts
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by phone and purpose
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON public.otp_requests(phone, purpose, expires_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;

-- Block all direct client access - Edge Functions use service role key
-- This ensures OTPs can only be managed through our secure functions
CREATE POLICY "Service role only" ON public.otp_requests
    FOR ALL USING (false);

-- ============================================
-- HELPER FUNCTION: Check if OTP is verified
-- ============================================
-- Used by the client app to verify a phone was validated before account creation

CREATE OR REPLACE FUNCTION check_otp_verified(
    p_phone TEXT,
    p_purpose TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_verified BOOLEAN;
BEGIN
    SELECT verified INTO v_verified
    FROM public.otp_requests
    WHERE phone = p_phone
      AND purpose = p_purpose
      AND verified = TRUE
      AND created_at > NOW() - INTERVAL '10 minutes' -- 10 min window after verification
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(v_verified, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CLEANUP FUNCTION
-- ============================================
-- Call this periodically to remove old OTP records
-- Can be triggered by a Supabase cron job or pg_cron

CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.otp_requests
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- OPTIONAL: Scheduled cleanup with pg_cron
-- ============================================
-- Uncomment if you have pg_cron extension enabled:
--
-- SELECT cron.schedule(
--     'cleanup-expired-otps',
--     '0 * * * *',  -- Every hour
--     $$SELECT cleanup_expired_otps()$$
-- );
