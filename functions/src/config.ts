import { defineSecret, defineString } from 'firebase-functions/params';

/** Region for every function. Must match VITE_FUNCTIONS_REGION in the frontend (default below). */
export const REGION = 'asia-southeast1';

/** Only Google accounts on this domain may administer contracts. Keep in sync with firestore.rules. */
export const ADMIN_EMAIL_DOMAIN = 'ignite-vision.com';

/** Public URL of the dashboard, e.g. https://contracts.ignite-vision.com */
export const APP_URL = defineString('APP_URL');

/** Mailbox used to send. Defaults to the sender requested for this project. */
export const SMTP_USER = defineString('SMTP_USER', { default: 'monika.rm@ignite-vision.com' });

/** Google Workspace "app password" for SMTP_USER. Stored in Secret Manager, never in code. */
export const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');

export const SENDER_NAME = 'Ignite Vision Documentation';
