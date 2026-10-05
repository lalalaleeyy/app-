# Improvements in this revision

## Security
- **Stored XSS fixed**: email previews were rendered with `dangerouslySetInnerHTML` from templates that interpolated
  unescaped names/titles/roles. All values are now HTML-escaped, and previews render in a fully sandboxed iframe
  (`EmailPreviewFrame`).
- **Signing tokens / ids** now use `crypto.getRandomValues` (192-bit tokens) instead of `Math.random()`.
- **Google Drive scopes** reduced from 13 overlapping scopes (incl. scripts, install, photos, meet) to one: `drive`.
- Drive query strings and file ids are escaped/encoded (no query injection through search or folder ids).

## Correctness
- `generateSha256` is a real SHA-256 of content (no `Date.now()` mixed in, no fake fallback hash); the original hash now
  covers the contract data plus the attached PDF data.
- Audit trail no longer records invented IPs (`192.168.1.x`, `127.0.0.1`); it states "not captured (client-side)".
- localStorage quota failures are no longer swallowed: saving throws a clear error that the UI shows.
- State guards: can't re-send invitations on non-draft contracts, remind signed parties, remind/cancel closed contracts,
  or create a contract whose party count doesn't match its signatories.
- `App.tsx`: fixed stale closure / missing hook dependencies in dashboard reload.

## Code quality
- `pdfGenerator.ts`: ~465 -> ~330 lines; shared banner/body/footer helpers instead of copy-pasted layout; long
  titles/names are truncated instead of overflowing; audit log notes when events are omitted; safe file names.
- Removed duplicated helpers in `storage.ts` (party shortcut sync, audit ids).
- Replaced `catch (err: any)` with typed `getErrorMessage(err)`; removed `any` for `onSuccess` and Drive metadata.
- Signer portal uses inline error messages instead of `alert()`.
- Removed unused deps (`express`, `dotenv`, `@google/genai`, `esbuild`, `tsx`, `autoprefixer`, `@types/express`,
  `motion`); moved build tooling to `devDependencies`; fixed the `clean` script; rewrote README and `.env.example`.

## Real email + shared database (second revision)
- **Emails are actually sent** from monika.rm@ignite-vision.com via Gmail SMTP in a Cloud Function (`functions/`).
  The old "Delivered" label was hardcoded; the outbox now shows the real result (**Sent / Failed + error**).
- **Contracts moved from localStorage to Firestore**, so signers can open their link on any device.
  The dashboard updates live when someone signs.
- **Real admin sign-in**: Google, restricted to `@ignite-vision.com` (replaces the accept-any-username login).
- **Server-side workflow**: all mutations run in Cloud Functions with transactions. Sequential signing order,
  double-sign protection, validation, real client IP/user-agent, content-bound SHA-256 seal.
- Signers only receive their own session (no other parties' tokens, admin notes, or email history).
- Drive sign-out no longer signs the admin out of the dashboard.
- Setup instructions: `DEPLOY.md`.

## Not changed (recommended next)
- Contract categories are still per-browser (localStorage); move them to Firestore if teams need to share them.
- Consider Firebase App Check to rate-limit the public signing functions.
- Run `bun install` / `npm install` to refresh the lockfile after the dependency cleanup, then `npm run lint`.
- Consider `"strict": true` in `tsconfig.json` and splitting the 1,500-line `CreateContractModal.tsx`.
