import { createHash, randomBytes } from 'node:crypto';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { ADMIN_EMAIL_DOMAIN } from './config';
import { AuditEvent } from './types';

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

export const newId = (prefix: string, bytes = 8): string => `${prefix}_${randomBytes(bytes).toString('hex')}`;

/** 192-bit signing token. Format is validated by TOKEN_PATTERN. */
export const newSigningToken = (): string => `tok_${randomBytes(24).toString('hex')}`;
export const TOKEN_PATTERN = /^tok_[a-f0-9]{48}$/;

export const tokenKey = (token: string): string => sha256Hex(token);

export function escapeHtml(value: unknown): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, ch => map[ch]);
}

/** Throws unless the caller is a signed-in, verified Google account on the admin domain. */
export function requireAdmin(req: CallableRequest<unknown>): { email: string; name: string } {
  const token = req.auth?.token;
  const email = typeof token?.email === 'string' ? token.email.toLowerCase() : '';
  if (!req.auth || !email || token?.email_verified !== true) {
    throw new HttpsError('unauthenticated', 'Please sign in with your company Google account.');
  }
  if (!email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
    throw new HttpsError('permission-denied', 'This account is not authorized to manage contracts.');
  }
  return { email, name: typeof token?.name === 'string' && token.name ? token.name : email };
}

/** Best-effort client IP (first X-Forwarded-For hop set by Google's front end). */
export function clientIp(req: CallableRequest<unknown>): string {
  const fwd = req.rawRequest.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.rawRequest.ip || 'unknown';
}

export function auditEvent(event: string, description: string, actor: string, ipAddress: string, suffix = ''): AuditEvent {
  return { id: newId('aud', 6) + suffix, timestamp: new Date().toISOString(), event, description, actor, ipAddress };
}

// ---- input validation ----
export function str(value: unknown, field: string, max: number, opts: { optional?: boolean } = {}): string {
  if (typeof value !== 'string') {
    if (opts.optional && (value === undefined || value === null)) return '';
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  const v = value.trim();
  if (!v && !opts.optional) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (v.length > max) throw new HttpsError('invalid-argument', `${field} is too long (max ${max} characters).`);
  return v;
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
export function email(value: unknown, field: string): string {
  const v = str(value, field, 254);
  if (!EMAIL_RE.test(v)) throw new HttpsError('invalid-argument', `${field} is not a valid email address.`);
  return v;
}

export function pct(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, n));
}
