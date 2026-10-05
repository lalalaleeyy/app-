/**
 * Small security helpers shared by services and components.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Escape untrusted text before interpolating it into an HTML string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/** Cryptographically secure random hex string (2 chars per byte). */
export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/** Unique, unguessable id with a readable prefix, e.g. `cnt_9f2c...`. */
export function newId(prefix: string, bytes = 8): string {
  return `${prefix}_${randomHex(bytes)}`;
}

/** Signing token. 192 bits of entropy; matches /^[a-zA-Z0-9_]+$/ used by the router. */
export function newSigningToken(): string {
  return `tok_${randomHex(24)}`;
}

/** Extract a human-readable message from an unknown thrown value. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}
