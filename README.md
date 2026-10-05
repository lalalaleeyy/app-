# Ignite Vision Documentation Dashboard

Contract management and multi-party e-signature dashboard (1–3 signatories, sequential or parallel
signing), with a tamper-evident audit trail, certified PDF export and optional Google Drive archiving.

> Contracts are stored in Firestore and **emails are really sent** (Gmail SMTP from a Cloud Function).
> Admin sign-in is Google, restricted to `@ignite-vision.com`. Signers need no account: they use the private
> link they receive by email. See **[DEPLOY.md](DEPLOY.md)** for the one-time setup.

## Run locally

Prerequisite: Node.js 20+ (or Bun).

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint       # type-check
npm run build      # production build in dist/
```

## Configuration

- `firebase-applet-config.json` – Firebase web config (Auth, Firestore, Functions).
  Restrict the API key by HTTP referrer in the Google Cloud console.
- `functions/.env` and the `SMTP_PASSWORD` secret – email settings, see DEPLOY.md.
- The Drive integration requests a single scope (`https://www.googleapis.com/auth/drive`).

## Project layout

```
src/
  App.tsx                 app shell, routing between dashboard / outbox / audit / signer portal
  types.ts                shared domain types
  components/             UI (tables, modals, signer portal, signature pad, ...)
  services/
    storage.ts            live contract subscription + calls to the Cloud Functions (categories stay in localStorage)
    auth.ts / firebase.ts admin Google sign-in, Firebase client setup
    security.ts           HTML escaping, secure ids/tokens, error helper
    pdfGenerator.ts       original + certified PDF generation (jsPDF)
    googleDrive.ts        Google Drive REST helpers
```

functions/                Cloud Functions (create/invite/remind/cancel contracts, signer session + signing, SMTP mailer)
firestore.rules           contracts readable by company admins only; writes server-side only
```
