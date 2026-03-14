/**
 * Manus magic link: sign and verify JWT for /applications?manus_token=xxx
 * Uses HMAC-SHA256 (no extra dependency). Secret: MANUS_MAGIC_LINK_SECRET
 */

import crypto from 'crypto';

const ALG = 'HS256';
const EXP_MINUTES = 15;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return Buffer.from(b64, 'base64');
}

export interface ManusTokenPayload {
  email: string;
  exp: number;
  iat?: number;
}

/**
 * Sign a magic link token for the given email. Expires in 15 minutes.
 */
export function signManusToken(email: string): string {
  const secret = process.env.MANUS_MAGIC_LINK_SECRET;
  if (!secret || !email?.trim()) {
    throw new Error('MANUS_MAGIC_LINK_SECRET or email missing');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: ManusTokenPayload = {
    email: email.trim(),
    exp: now + EXP_MINUTES * 60,
    iat: now,
  };
  const header = { alg: ALG, typ: 'JWT' };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(message).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${message}.${sigB64}`;
}

/**
 * Verify a magic link token and return the payload (email, exp). Throws if invalid or expired.
 */
export function verifyManusToken(token: string): ManusTokenPayload {
  const secret = process.env.MANUS_MAGIC_LINK_SECRET;
  if (!secret) throw new Error('MANUS_MAGIC_LINK_SECRET not set');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [headerB64, payloadB64, sigB64] = parts;
  const message = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(message).digest();
  const expectedB64 = base64UrlEncode(expectedSig);
  if (expectedB64 !== sigB64) throw new Error('Invalid token signature');
  const payloadJson = base64UrlDecode(payloadB64).toString('utf8');
  const payload = JSON.parse(payloadJson) as ManusTokenPayload;
  if (!payload.email || typeof payload.exp !== 'number') throw new Error('Invalid token payload');
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}
