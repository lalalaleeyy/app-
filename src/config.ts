/** Only Google accounts on this domain can sign in as an administrator (also enforced server-side). */
export const ADMIN_EMAIL_DOMAIN = 'ignite-vision.com';

/** Must match REGION in functions/src/config.ts. */
export const FUNCTIONS_REGION: string = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';
