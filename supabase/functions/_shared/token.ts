/**
 * Token utilities for secure password reset
 * 
 * Uses HMAC-SHA256 to create signed tokens that can't be forged.
 */

const ENCODER = new TextEncoder();

/**
 * Create a signed reset token
 * Token format: base64(phone:timestamp:purpose):signature
 */
export async function createResetToken(
  phone: string,
  purpose: string,
  secret: string
): Promise<string> {
  const timestamp = Date.now();
  const payload = `${phone}:${timestamp}:${purpose}`;
  
  // Create HMAC signature
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    ENCODER.encode(payload)
  );
  
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Encode payload as base64
  const payloadBase64 = btoa(payload);
  
  return `${payloadBase64}.${signatureHex}`;
}

/**
 * Verify and decode a reset token
 * Returns the phone number if valid, null if invalid
 */
export async function verifyResetToken(
  token: string,
  purpose: string,
  secret: string,
  maxAgeMs: number = 10 * 60 * 1000 // 10 minutes
): Promise<{ valid: boolean; phone?: string; error?: string }> {
  try {
    const [payloadBase64, signatureHex] = token.split('.');
    
    if (!payloadBase64 || !signatureHex) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    // Decode payload
    const payload = atob(payloadBase64);
    const [phone, timestampStr, tokenPurpose] = payload.split(':');
    
    if (!phone || !timestampStr || !tokenPurpose) {
      return { valid: false, error: 'Invalid token payload' };
    }
    
    // Check purpose
    if (tokenPurpose !== purpose) {
      return { valid: false, error: 'Invalid token purpose' };
    }
    
    // Check timestamp
    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > maxAgeMs) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      ENCODER.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      ENCODER.encode(payload)
    );
    
    if (!valid) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true, phone };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}
