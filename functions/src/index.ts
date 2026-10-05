import { initializeApp } from 'firebase-admin/app';
import { DocumentReference, FieldValue, getFirestore, Transaction } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { APP_URL, REGION, SMTP_PASSWORD } from './config';
import { MailResult, sendMail } from './mailer';
import { completionEmail, invitationEmail, reminderEmail, RenderedEmail } from './templates';
import {
  AuditEvent,
  Contract,
  EmailLog,
  PartyRoleKey,
  SignatureField,
  SignatureMethod,
  Signatory
} from './types';
import {
  TOKEN_PATTERN,
  auditEvent,
  clientIp,
  email as validEmail,
  newId,
  newSigningToken,
  pct,
  requireAdmin,
  sha256Hex,
  str,
  tokenKey
} from './util';

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 10 });

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const contractsCol = db.collection('contracts');
const tokensCol = db.collection('signingTokens');

/** Functions that send email need the SMTP secret bound to them. */
const MAIL_OPTS = { secrets: [SMTP_PASSWORD], cors: true } as const;
const PLAIN_OPTS = { cors: true } as const;

const ROLE_KEYS: PartyRoleKey[] = ['party1', 'party2', 'party3'];
const INVALID_LINK = 'Invalid or expired signing link. Please contact the sender.';
const MAX_SIGNATURE_CHARS = 400_000;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const signingLink = (token: string): string => `${APP_URL.value().replace(/\/+$/, '')}/#sign?token=${token}`;

function syncShortcuts(c: Contract): void {
  c.party1 = c.parties[0];
  c.party2 = c.parties[1];
  c.party3 = c.parties[2];
}

interface Draft {
  recipient: Signatory;
  type: EmailLog['type'];
  mail: RenderedEmail;
  link: string;
}

/**
 * Sends each email and records the REAL outcome (sent / failed) on the contract.
 * Failures never throw: the admin sees them in the outbox and can retry with a reminder.
 */
async function deliver(ref: DocumentReference, contract: Contract, drafts: Draft[]): Promise<{ failed: number }> {
  if (drafts.length === 0) return { failed: 0 };
  const logs: EmailLog[] = [];
  const audits: AuditEvent[] = [];

  for (const d of drafts) {
    const result: MailResult = await sendMail({
      to: { name: d.recipient.name, address: d.recipient.email },
      subject: d.mail.subject,
      html: d.mail.html,
      text: d.mail.text
    });
    const log: EmailLog = {
      id: newId('eml', 6),
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      recipientName: d.recipient.name,
      recipientEmail: d.recipient.email,
      recipientRole: d.recipient.role,
      type: d.type,
      subject: d.mail.subject,
      sentAt: new Date().toISOString(),
      signingLink: d.link,
      previewContent: d.mail.html,
      status: result.ok ? 'sent' : 'failed'
    };
    if (result.messageId) log.providerMessageId = result.messageId;
    if (result.error) log.error = result.error;
    logs.push(log);

    if (!result.ok) {
      audits.push(
        auditEvent(
          'email_failed',
          `Email (${d.type}) to ${d.recipient.name} <${d.recipient.email}> could not be delivered: ${result.error}`,
          'System',
          'server'
        )
      );
    }
  }

  const update: Record<string, unknown> = { invitationHistory: FieldValue.arrayUnion(...logs) };
  if (audits.length > 0) update.auditTrail = FieldValue.arrayUnion(...audits);
  await ref.update(update);
  return { failed: logs.filter(l => l.status === 'failed').length };
}

const invitationDrafts = (c: Contract, targets: Signatory[]): Draft[] =>
  targets.map(r => {
    const link = signingLink(r.signingToken);
    return { recipient: r, type: 'invitation', mail: invitationEmail(c, r, link), link };
  });

async function readContract(ref: DocumentReference): Promise<Contract> {
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Contract not found.');
  return snap.data() as Contract;
}

/** Strip everything a signer must not see: tokens, admin notes, email history, other parties' details beyond name/role/status. */
function sanitizeForSigner(c: Contract): Contract {
  const parties = c.parties.map(p => ({ ...p, signingToken: '', email: p.email }));
  const safe: Contract = {
    ...c,
    notes: undefined,
    parties,
    party1: parties[0],
    party2: parties[1],
    party3: parties[2],
    invitationHistory: [],
    auditTrail: c.status === 'fully_signed' ? c.auditTrail : []
  };
  return safe;
}

async function resolveToken(token: unknown, tx?: Transaction) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new HttpsError('not-found', INVALID_LINK);
  const idxRef = tokensCol.doc(tokenKey(token));
  const idx = await (tx ? tx.get(idxRef) : idxRef.get());
  if (!idx.exists) throw new HttpsError('not-found', INVALID_LINK);

  const contractRef = contractsCol.doc(String(idx.get('contractId')));
  const snap = await (tx ? tx.get(contractRef) : contractRef.get());
  if (!snap.exists) throw new HttpsError('not-found', INVALID_LINK);

  const contract = snap.data() as Contract;
  const signerIndex = contract.parties.findIndex(p => p.signingToken === token);
  if (signerIndex < 0) throw new HttpsError('not-found', INVALID_LINK);
  return { contractRef, contract, signerIndex };
}

function evaluateTurn(c: Contract, signerIndex: number): { canSignNow: boolean; waitingMessage: string | null } {
  const signer = c.parties[signerIndex];
  if (c.status === 'cancelled' || c.status === 'expired') return { canSignNow: false, waitingMessage: null };
  if (signer.status === 'signed') return { canSignNow: false, waitingMessage: null };
  if (c.status === 'draft') {
    return { canSignNow: false, waitingMessage: 'This document has not been issued for signature yet.' };
  }
  if (c.signingOrder === 'sequential') {
    const blocker = c.parties.slice(0, signerIndex).find(p => p.status !== 'signed');
    if (blocker) {
      return {
        canSignNow: false,
        waitingMessage: `This document requires sequential execution. Awaiting signature from ${blocker.name} (${blocker.role}). You will receive an email as soon as it is your turn.`
      };
    }
  }
  return { canSignNow: true, waitingMessage: null };
}

// ---------------------------------------------------------------------------
// ADMIN: create / invite / remind / cancel
// ---------------------------------------------------------------------------
export const createContract = onCall(MAIL_OPTS, async req => {
  const admin = requireAdmin(req);
  const ip = clientIp(req);
  const d = (req.data ?? {}) as Record<string, unknown>;

  const partyCount = d.partyCount;
  if (partyCount !== 1 && partyCount !== 2 && partyCount !== 3) {
    throw new HttpsError('invalid-argument', 'partyCount must be 1, 2 or 3.');
  }
  const rawParties = Array.isArray(d.parties) ? d.parties : [];
  if (rawParties.length !== partyCount) {
    throw new HttpsError('invalid-argument', 'The number of signatories does not match the party count.');
  }

  const contractNumber = str(d.contractNumber, 'Contract number', 60);
  const title = str(d.title, 'Title', 200);
  const contractType = str(d.contractType, 'Category', 120);
  const contractDate = str(d.contractDate, 'Contract date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contractDate)) throw new HttpsError('invalid-argument', 'Contract date must be YYYY-MM-DD.');
  const notes = str(d.notes, 'Notes', 2000, { optional: true });
  const uploadedPdfName = str(d.uploadedPdfName, 'File name', 200, { optional: true });
  const signingOrder = partyCount === 1 ? 'parallel' : d.signingOrder === 'sequential' ? 'sequential' : 'parallel';
  const sendNow = d.sendInvitationsNow === true;

  const dup = await contractsCol.where('contractNumber', '==', contractNumber).limit(1).get();
  if (!dup.empty) throw new HttpsError('already-exists', `A contract numbered ${contractNumber} already exists.`);

  const now = new Date().toISOString();
  const partyInputs = rawParties.map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      name: str(o.name, `Signatory ${i + 1} name`, 120),
      email: validEmail(o.email, `Signatory ${i + 1} email`),
      role: str(o.role, `Signatory ${i + 1} role`, 120, { optional: true }) || `Signatory ${i + 1}`
    };
  });

  const parties: Signatory[] = partyInputs.map((p, idx) => ({
    id: newId('sig', 6),
    roleKey: ROLE_KEYS[idx],
    partyIndex: idx + 1,
    name: p.name,
    email: p.email,
    role: p.role,
    status: 'pending',
    signingToken: newSigningToken(),
    invitationSentAt: sendNow && (signingOrder === 'parallel' || idx === 0) ? now : null,
    documentOpenedAt: null,
    signature: null
  }));

  const rawFields = Array.isArray(d.fields) ? d.fields.slice(0, 12) : [];
  const fields: SignatureField[] = rawFields.map((f, i) => {
    const o = (f ?? {}) as Record<string, unknown>;
    const role = ROLE_KEYS.slice(0, partyCount).find(r => r === o.recipientRole);
    if (!role) throw new HttpsError('invalid-argument', `Signature field ${i + 1} targets an unknown party.`);
    const type = o.type === 'initials' || o.type === 'date' ? o.type : 'signature';
    return {
      id: newId('fld', 4),
      recipientRole: role,
      type,
      page: Math.max(1, Math.min(200, Math.floor(typeof o.page === 'number' ? o.page : 1))),
      xPercent: pct(o.xPercent, 10),
      yPercent: pct(o.yPercent, 80),
      widthPercent: pct(o.widthPercent, 25),
      heightPercent: pct(o.heightPercent, 8),
      required: o.required !== false
    };
  });

  const originalPdfHash = sha256Hex(
    JSON.stringify({ contractNumber, title, contractType, contractDate, signingOrder, uploadedPdfName, parties: partyInputs, now })
  );

  const id = newId('cnt');
  const contract: Contract = {
    id,
    contractNumber,
    title,
    contractType,
    contractDate,
    signingOrder,
    status: sendNow ? 'pending_signature' : 'draft',
    notes,
    createdAt: now,
    updatedAt: now,
    originalPdfHash,
    finalPdfHash: null,
    uploadedPdfName: uploadedPdfName || undefined,
    partyCount,
    parties,
    party1: parties[0],
    party2: parties[1],
    party3: parties[2],
    fields,
    auditTrail: [
      auditEvent(
        'contract_created',
        `Contract ${contractNumber} (${partyCount}-Party workflow) created by ${admin.name} with SHA-256 fingerprint ${originalPdfHash.slice(0, 16)}...`,
        admin.email,
        ip
      )
    ],
    invitationHistory: []
  };
  if (sendNow) {
    contract.auditTrail.push(auditEvent('invitations_dispatched', `Signing invitations issued for ${contractNumber}.`, admin.email, ip));
  }

  const ref = contractsCol.doc(id);
  const batch = db.batch();
  batch.set(ref, contract);
  parties.forEach(p => batch.set(tokensCol.doc(tokenKey(p.signingToken)), { contractId: id, roleKey: p.roleKey, createdAt: now }));
  await batch.commit();

  let emailsFailed = 0;
  if (sendNow) {
    const targets = signingOrder === 'parallel' ? parties : [parties[0]];
    emailsFailed = (await deliver(ref, contract, invitationDrafts(contract, targets))).failed;
  }
  return { contract: await readContract(ref), emailsFailed };
});

export const sendInvitations = onCall(MAIL_OPTS, async req => {
  const admin = requireAdmin(req);
  const ip = clientIp(req);
  const contractId = str((req.data as Record<string, unknown> | undefined)?.contractId, 'contractId', 80);
  const ref = contractsCol.doc(contractId);

  const targets = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Contract not found.');
    const c = snap.data() as Contract;
    if (c.status !== 'draft') {
      throw new HttpsError('failed-precondition', 'Invitations can only be sent for contracts in draft status.');
    }
    const now = new Date().toISOString();
    const chosen = c.signingOrder === 'parallel' ? c.parties : [c.parties[0]];
    chosen.forEach(p => (p.invitationSentAt = now));
    c.status = 'pending_signature';
    c.updatedAt = now;
    c.auditTrail.push(auditEvent('invitations_dispatched', `Signing invitations issued for ${c.contractNumber}.`, admin.email, ip));
    syncShortcuts(c);
    tx.set(ref, c);
    return chosen.map(p => p.signingToken);
  });

  const contract = await readContract(ref);
  const recipients = contract.parties.filter(p => targets.includes(p.signingToken));
  const { failed } = await deliver(ref, contract, invitationDrafts(contract, recipients));
  return { contract: await readContract(ref), emailsFailed: failed };
});

const REMINDER_TYPES = ['reminder_24h', 'reminder_48h', 'manual_reminder'] as const;
const REMINDER_COOLDOWN_MS = 60_000;

export const sendReminder = onCall(MAIL_OPTS, async req => {
  const admin = requireAdmin(req);
  const ip = clientIp(req);
  const d = (req.data ?? {}) as Record<string, unknown>;
  const ref = contractsCol.doc(str(d.contractId, 'contractId', 80));
  const roleKey = ROLE_KEYS.find(r => r === d.roleKey);
  const type = REMINDER_TYPES.find(t => t === d.type);
  if (!roleKey || !type) throw new HttpsError('invalid-argument', 'Invalid reminder request.');

  const contract = await readContract(ref);
  if (['cancelled', 'expired', 'fully_signed', 'draft'].includes(contract.status)) {
    throw new HttpsError('failed-precondition', 'Reminders can only be sent while a contract is awaiting signatures.');
  }
  const idx = contract.parties.findIndex(p => p.roleKey === roleKey);
  const recipient = contract.parties[idx];
  if (!recipient) throw new HttpsError('not-found', 'Signatory not found.');
  if (recipient.status === 'signed') throw new HttpsError('failed-precondition', `${recipient.name} has already signed.`);
  if (!recipient.invitationSentAt) {
    throw new HttpsError('failed-precondition', `${recipient.name} has not been invited yet (sequential order).`);
  }
  const recent = contract.invitationHistory.some(
    l => l.recipientEmail === recipient.email && Date.now() - Date.parse(l.sentAt) < REMINDER_COOLDOWN_MS
  );
  if (recent) throw new HttpsError('resource-exhausted', 'An email was just sent to this signatory. Please wait a minute.');

  const link = signingLink(recipient.signingToken);
  await ref.update({
    auditTrail: FieldValue.arrayUnion(
      auditEvent('reminder_sent', `${type.replace(/_/g, ' ')} sent to Party ${recipient.partyIndex} - ${recipient.name} (${recipient.email})`, admin.email, ip)
    )
  });
  const { failed } = await deliver(ref, contract, [{ recipient, type, mail: reminderEmail(contract, recipient, link), link }]);
  return { contract: await readContract(ref), emailsFailed: failed };
});

export const cancelContract = onCall(PLAIN_OPTS, async req => {
  const admin = requireAdmin(req);
  const ip = clientIp(req);
  const d = (req.data ?? {}) as Record<string, unknown>;
  const reason = str(d.reason, 'Reason', 500, { optional: true }) || 'Administrative void';
  const ref = contractsCol.doc(str(d.contractId, 'contractId', 80));

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Contract not found.');
    const c = snap.data() as Contract;
    if (c.status === 'fully_signed') throw new HttpsError('failed-precondition', 'A fully signed contract cannot be cancelled.');
    if (c.status === 'cancelled') throw new HttpsError('failed-precondition', 'This contract is already cancelled.');
    c.status = 'cancelled';
    c.updatedAt = new Date().toISOString();
    c.auditTrail.push(auditEvent('contract_cancelled', `Contract cancelled by ${admin.name}. Reason: ${reason}`, admin.email, ip));
    tx.set(ref, c);
  });
  return { contract: await readContract(ref) };
});

// ---------------------------------------------------------------------------
// PUBLIC (token holders): view + sign
// ---------------------------------------------------------------------------
function sessionPayload(c: Contract, signerIndex: number) {
  const signer = c.parties[signerIndex];
  const safe = sanitizeForSigner(c);
  return {
    contract: safe,
    signer: safe.parties[signerIndex],
    otherSigners: safe.parties.filter((_, i) => i !== signerIndex),
    role: signer.roleKey,
    ...evaluateTurn(c, signerIndex)
  };
}

export const getSigningSession = onCall(PLAIN_OPTS, async req => {
  const token = (req.data as Record<string, unknown> | undefined)?.token;
  const ip = clientIp(req);

  const result = await db.runTransaction(async tx => {
    const { contractRef, contract, signerIndex } = await resolveToken(token, tx);
    const signer = contract.parties[signerIndex];
    if (!signer.documentOpenedAt) {
      signer.documentOpenedAt = new Date().toISOString();
      contract.auditTrail.push(
        auditEvent('document_opened', `Party ${signer.partyIndex} - ${signer.name} opened the document.`, signer.name, ip)
      );
      syncShortcuts(contract);
      tx.set(contractRef, contract);
    }
    return { contract, signerIndex };
  });
  return sessionPayload(result.contract, result.signerIndex);
});

export const signContract = onCall(MAIL_OPTS, async req => {
  const d = (req.data ?? {}) as Record<string, unknown>;
  const ip = clientIp(req);
  const userAgent = (req.rawRequest.headers['user-agent'] ?? 'unknown').toString().slice(0, 300);

  if (d.consentAgreed !== true) throw new HttpsError('invalid-argument', 'You must accept the electronic signature consent.');
  const fullName = str(d.fullName, 'Full name', 120);
  const method = (['draw', 'type', 'upload'] as SignatureMethod[]).find(m => m === d.signatureMethod);
  if (!method) throw new HttpsError('invalid-argument', 'Invalid signature method.');
  const image = typeof d.signatureImage === 'string' ? d.signatureImage : '';
  if (!image.startsWith('data:image/png;base64,') || image.length > MAX_SIGNATURE_CHARS) {
    throw new HttpsError('invalid-argument', 'The signature image is missing, too large, or not a PNG.');
  }

  const outcome = await db.runTransaction(async tx => {
    const { contractRef, contract, signerIndex } = await resolveToken(d.token, tx);
    const signer = contract.parties[signerIndex];

    if (contract.status === 'cancelled' || contract.status === 'expired') {
      throw new HttpsError('failed-precondition', 'This contract has been cancelled or has expired.');
    }
    if (signer.status === 'signed') throw new HttpsError('failed-precondition', 'You have already signed this document.');
    const turn = evaluateTurn(contract, signerIndex);
    if (!turn.canSignNow) throw new HttpsError('failed-precondition', turn.waitingMessage ?? 'It is not your turn to sign yet.');

    const now = new Date().toISOString();
    signer.status = 'signed';
    signer.name = fullName;
    signer.signature = { signatureImage: image, signatureMethod: method, timestamp: now, ipAddress: ip, userAgent, signerName: fullName };
    contract.updatedAt = now;
    contract.auditTrail.push(
      auditEvent('signature_recorded', `Party ${signer.partyIndex} - ${fullName} (${signer.role}) signed via ${method.toUpperCase()}.`, fullName, ip)
    );

    let completed = false;
    let nextToken: string | null = null;

    if (contract.parties.every(p => p.status === 'signed')) {
      completed = true;
      contract.status = 'fully_signed';
      contract.finalPdfHash = sha256Hex(
        JSON.stringify({
          id: contract.id,
          original: contract.originalPdfHash,
          signatures: contract.parties.map(p => ({
            role: p.roleKey,
            name: p.signature?.signerName,
            email: p.email,
            at: p.signature?.timestamp,
            method: p.signature?.signatureMethod,
            image: sha256Hex(p.signature?.signatureImage ?? '')
          }))
        })
      );
      contract.auditTrail.push(
        auditEvent('document_certified', `Fully executed by all ${contract.partyCount} parties. Sealed with SHA-256 ${contract.finalPdfHash.slice(0, 16)}...`, 'System', 'server', '_cert')
      );
    } else {
      contract.status = 'partially_signed';
      const next = contract.parties[signerIndex + 1];
      if (contract.signingOrder === 'sequential' && next && next.status !== 'signed' && !next.invitationSentAt) {
        next.invitationSentAt = now;
        nextToken = next.signingToken;
        contract.auditTrail.push(
          auditEvent('sequential_invitation', `Party ${signer.partyIndex} verified. Inviting Party ${next.partyIndex} (${next.name}).`, 'System', 'server', '_seq')
        );
      }
    }

    syncShortcuts(contract);
    tx.set(contractRef, contract);
    return { contractRef, contract, signerIndex, completed, nextToken };
  });

  // Emails go out only after the signature is safely committed.
  const drafts: Draft[] = [];
  if (outcome.completed) {
    outcome.contract.parties.forEach(p => drafts.push({ recipient: p, type: 'completed', mail: completionEmail(outcome.contract, p), link: '' }));
  } else if (outcome.nextToken) {
    const next = outcome.contract.parties.find(p => p.signingToken === outcome.nextToken);
    if (next) drafts.push(...invitationDrafts(outcome.contract, [next]));
  }
  await deliver(outcome.contractRef, outcome.contract, drafts);

  const fresh = await readContract(outcome.contractRef);
  return sessionPayload(fresh, outcome.signerIndex);
});

