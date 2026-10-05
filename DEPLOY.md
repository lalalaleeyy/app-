# Deploying real email + shared contracts

Emails are now sent for real from **monika.rm@ignite-vision.com** through Gmail SMTP, using a Firebase
Cloud Function. Contracts live in Firestore, so a signer can open the link on any device.

## What you need (one-time)

1. **Firebase project on the Blaze (pay-as-you-go) plan.** Cloud Functions with secrets requires it.
   Typical usage for this app costs cents per month.
2. **Google Workspace mailbox** `monika.rm@ignite-vision.com` with 2-Step Verification ON.
3. **App password** for that mailbox: Google Account -> Security -> 2-Step Verification -> App passwords.
   (If your admin has disabled app passwords, ask them to allow it, or use an SMTP relay instead.)
4. **Firebase CLI**: `npm i -g firebase-tools && firebase login`

## Steps

```bash
# 1. In the Firebase console: Build -> Firestore Database -> Create database (production mode)
#    Build -> Authentication -> Sign-in method -> enable Google
#    Authentication -> Settings -> Authorized domains -> add your dashboard's domain

# 2. Store the mailbox password as a secret (never in code)
firebase functions:secrets:set SMTP_PASSWORD        # paste the 16-character app password

# 3. Configure the public URL used in signing links
cp functions/.env.example functions/.env           # then edit APP_URL

# 4. Deploy rules + functions
npm --prefix functions install
firebase deploy --only firestore:rules,functions

# 5. Run / host the dashboard
npm install && npm run build                         # host dist/ anywhere (Firebase Hosting works)
```

## Test it

1. Sign in with your `@ignite-vision.com` Google account.
2. Create a contract with **your own other email** as signatory and tick "send invitations now".
3. Check the inbox (and spam folder the first time). The Email Outbox tab shows **Sent** or **Failed + the error**.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Outbox says *Failed* with "Invalid login" / 535 | Wrong app password, or 2-Step Verification is off. Re-run `functions:secrets:set SMTP_PASSWORD`. |
| "permission-denied" when creating a contract | Signed-in account is not `@ignite-vision.com` (see `ADMIN_EMAIL_DOMAIN` in `functions/src/config.ts` and `src/config.ts`, and `firestore.rules`). |
| "functions/not-found" in the browser | Region mismatch. `REGION` (functions) must equal `VITE_FUNCTIONS_REGION` (frontend), default `asia-southeast1`. |
| Emails land in spam | Ask your Workspace admin to confirm SPF/DKIM/DMARC for ignite-vision.com. |
| Gmail limit | Workspace SMTP allows roughly 2,000 messages/day, far above what this needs. |

## Changing the email provider

Only `functions/src/mailer.ts` talks to the mail server. To use Resend/SendGrid/Postmark, replace the body of
`sendMail()` and keep its signature.

## Security model

- Browsers can **read** contracts only if signed in with a verified `@ignite-vision.com` account (`firestore.rules`).
- Browsers can **never write** contracts. All changes go through Cloud Functions, so audit entries, tokens, hashes
  and signature timestamps/IPs are created server-side and cannot be forged.
- Signers need no account. Their private 192-bit token (in the emailed link) lets them call `getSigningSession`
  and `signContract` only for their own contract; other parties' tokens and admin notes are never sent to them.
