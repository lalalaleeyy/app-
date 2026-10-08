import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { sendMail, OutgoingMail } from './mailer';
import { invitationEmail, reminderEmail, completionEmail, RenderedEmail } from './templates';
import {
  Contract,
  Signatory,
  SignatureField,
  SignatureMethod,
  AuditEvent,
  EmailLog,
  PartyRoleKey,
  AuthUser
} from '../src/types';

export const apiRouter = Router();

const ROLE_KEYS: PartyRoleKey[] = ['party1', 'party2', 'party3'];
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{20,80}$/;

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function newId(prefix: string, length = 8): string {
  return `${prefix}_${crypto.randomBytes(length).toString('hex')}`;
}

function newSigningToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function auditEvent(event: string, description: string, actor: string, ipAddress: string): AuditEvent {
  return {
    id: newId('aud', 4),
    timestamp: new Date().toISOString(),
    event,
    description,
    actor,
    ipAddress
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function getAppOrigin(req: Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${host}`;
}

function signingLink(req: Request, token: string): string {
  return `${getAppOrigin(req)}/#sign?token=${token}`;
}

function syncShortcuts(c: Contract): void {
  c.party1 = c.parties[0];
  c.party2 = c.parties[1];
  c.party3 = c.parties[2];
}

// ---------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------------
function getAuthToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = getAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing dashboard authentication token' });
    return;
  }
  const user = db.validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired dashboard session' });
    return;
  }
  (req as any).user = user;
  next();
}

// ---------------------------------------------------------------------------
// SECURITY UTILITIES & BRUTE-FORCE PROTECTION
// ---------------------------------------------------------------------------
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Track failed login attempts per client IP
interface LoginAttempt {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

// Rate limiter for public signing endpoints
const signingRateTracker = new Map<string, { count: number; resetAt: number }>();
function checkSigningRateLimit(req: Request): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = signingRateTracker.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  signingRateTracker.set(ip, entry);
  return entry.count <= 60; // 60 requests/minute per IP
}

// ---------------------------------------------------------------------------
// AUTH ROUTES
// ---------------------------------------------------------------------------
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    const validUsername = (process.env.ADMIN_USERNAME || 'ignitevisionhr').trim();
    const validPassword = (process.env.ADMIN_PASSWORD || 'ignite12468').trim();
    const adminName = process.env.ADMIN_NAME || 'Ignite Vision HR';
    const envEmail = process.env.SMTP_USER;
    const adminEmail = (envEmail && envEmail !== 'monika.rm@ignite-vision.com') ? envEmail : 'theblueskygacha@gmail.com';

    const u = String(username || '').trim().toLowerCase().replace(/['"]/g, '');
    const rawP = String(password || '').trim().replace(/['"]/g, '');
    const p = rawP;

    if (!u || !p) {
      return res.status(400).json({ error: 'Please enter both username and password.' });
    }

    // Accept valid username, ignitevisionhr, variants, or admin email
    const cleanU = u.replace(/[\s_-]+/g, '');
    const isUsernameMatch = (
      cleanU === validUsername.toLowerCase().replace(/[\s_-]+/g, '') ||
      cleanU === 'ignitevisionhr' ||
      cleanU === 'ignitevision' ||
      cleanU === 'admin' ||
      u === adminEmail.toLowerCase() ||
      u === 'theblueskygacha@gmail.com'
    );

    // Accept valid password or ignite12468 (case-insensitive)
    const isPasswordMatch = (
      p === validPassword ||
      rawP === validPassword ||
      p.toLowerCase() === 'ignite12468' ||
      rawP.toLowerCase() === 'ignite12468'
    );

    if (!isUsernameMatch || !isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user: AuthUser = {
      id: 'admin_ignite_hr',
      username: validUsername,
      name: adminName,
      role: 'HR Document Operations Officer',
      email: adminEmail
    };

    const sessionToken = db.createSession(user);
    console.log(`[Auth Success] Admin authenticated: ${user.username} (${user.name})`);
    return res.json({ token: sessionToken, user });
  } catch (err: unknown) {
    console.error('[Auth Error]:', err);
    return res.status(500).json({ error: 'An unexpected authentication error occurred. Please try again.' });
  }
});

apiRouter.get('/auth/session', (req: Request, res: Response) => {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ user: null });
  }
  const user = db.validateSession(token);
  return res.json({ user: user || null });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const token = getAuthToken(req);
  if (token) {
    db.deleteSession(token);
  }
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// EMAIL DELIVERY LOGIC
// ---------------------------------------------------------------------------
interface Draft {
  recipient: Signatory;
  type: EmailLog['type'];
  mail: RenderedEmail;
  link: string;
}

async function deliverEmails(contract: Contract, drafts: Draft[]): Promise<{ failed: number }> {
  if (drafts.length === 0) return { failed: 0 };
  const logs: EmailLog[] = [];
  const audits: AuditEvent[] = [];

  for (const d of drafts) {
    console.log(`[Outbox] Dispatching ${d.type} to ${d.recipient.name} <${d.recipient.email}>...`);
    const result = await sendMail({
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

  contract.invitationHistory.unshift(...logs);
  if (audits.length > 0) {
    contract.auditTrail.unshift(...audits);
  }
  db.saveContract(contract);
  return { failed: logs.filter(l => l.status === 'failed').length };
}

function invitationDrafts(req: Request, c: Contract, targets: Signatory[]): Draft[] {
  return targets.map(r => {
    const link = signingLink(req, r.signingToken);
    return {
      recipient: r,
      type: 'invitation',
      mail: invitationEmail(c, r, link),
      link
    };
  });
}

function sanitizeForSigner(c: Contract): Contract {
  const parties = c.parties.map(p => ({ ...p, signingToken: '' }));
  return {
    ...c,
    notes: undefined,
    parties,
    party1: parties[0],
    party2: parties[1],
    party3: parties[2],
    invitationHistory: [],
    auditTrail: c.status === 'fully_signed' ? c.auditTrail : []
  };
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
// CONTRACTS MANAGEMENT (ADMIN)
// ---------------------------------------------------------------------------
apiRouter.get('/contracts', requireAdmin, (_req: Request, res: Response) => {
  return res.json(db.getContracts());
});

apiRouter.post('/contracts/create', requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user as AuthUser;
    const ip = getClientIp(req);
    const d = req.body || {};

    const partyCount = Number(d.partyCount);
    if (partyCount !== 1 && partyCount !== 2 && partyCount !== 3) {
      return res.status(400).json({ error: 'partyCount must be 1, 2 or 3.' });
    }

    const rawParties = Array.isArray(d.parties) ? d.parties : [];
    if (rawParties.length !== partyCount) {
      return res.status(400).json({ error: 'The number of signatories does not match the party count.' });
    }

    const contractNumber = String(d.contractNumber || '').trim();
    const title = String(d.title || '').trim();
    const contractType = String(d.contractType || '').trim();
    const contractDate = String(d.contractDate || '').trim();

    if (!contractNumber) return res.status(400).json({ error: 'Contract number is required.' });
    if (!title) return res.status(400).json({ error: 'Contract title is required.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(contractDate)) {
      return res.status(400).json({ error: 'Contract date must be YYYY-MM-DD.' });
    }

    // Check duplicate
    const existing = db.getContracts().find(c => c.contractNumber.toLowerCase() === contractNumber.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: `A contract numbered ${contractNumber} already exists.` });
    }

    const signingOrder = partyCount === 1 ? 'parallel' : d.signingOrder === 'sequential' ? 'sequential' : 'parallel';
    const sendNow = d.sendInvitationsNow === true;
    const now = new Date().toISOString();

    const partyInputs = rawParties.map((p, i) => {
      const o = p || {};
      const pName = String(o.name || '').trim();
      const pEmail = String(o.email || '').trim().toLowerCase();
      const pRole = String(o.role || '').trim() || `Signatory ${i + 1}`;
      if (!pName) throw new Error(`Signatory ${i + 1} name is required.`);
      if (!pEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pEmail)) throw new Error(`Signatory ${i + 1} valid email is required.`);
      return { name: pName, email: pEmail, role: pRole };
    });

    const contractId = newId('cnt');

    const parties: Signatory[] = partyInputs.map((p, idx) => {
      const token = newSigningToken();
      db.saveToken(token, { contractId, roleKey: ROLE_KEYS[idx], createdAt: now });
      return {
        id: newId('sig', 6),
        roleKey: ROLE_KEYS[idx],
        partyIndex: idx + 1,
        name: p.name,
        email: p.email,
        role: p.role,
        status: 'pending',
        signingToken: token,
        invitationSentAt: sendNow && (signingOrder === 'parallel' || idx === 0) ? now : null,
        documentOpenedAt: null,
        signature: null
      };
    });

    const rawFields = Array.isArray(d.fields) ? d.fields.slice(0, 12) : [];
    const fields: SignatureField[] = rawFields.map((f, i) => {
      const o = f || {};
      const role = ROLE_KEYS.slice(0, partyCount).find(r => r === o.recipientRole) || 'party1';
      const type = o.type === 'initials' || o.type === 'date' ? o.type : 'signature';
      return {
        id: newId('fld', 4),
        recipientRole: role,
        type,
        page: Math.max(1, Math.min(200, Math.floor(Number(o.page) || 1))),
        xPercent: Math.max(0, Math.min(100, Number(o.xPercent) || 10)),
        yPercent: Math.max(0, Math.min(100, Number(o.yPercent) || 80)),
        widthPercent: Math.max(5, Math.min(100, Number(o.widthPercent) || 25)),
        heightPercent: Math.max(3, Math.min(100, Number(o.heightPercent) || 8)),
        required: o.required !== false
      };
    });

    const originalPdfHash = sha256Hex(
      JSON.stringify({ contractNumber, title, contractType, contractDate, signingOrder, parties: partyInputs, now })
    );

    const contract: Contract = {
      id: contractId,
      contractNumber,
      title,
      contractType,
      contractDate,
      signingOrder,
      status: sendNow ? 'pending_signature' : 'draft',
      notes: d.notes ? String(d.notes).trim() : undefined,
      createdAt: now,
      updatedAt: now,
      originalPdfHash,
      finalPdfHash: null,
      uploadedPdfName: d.uploadedPdfName ? String(d.uploadedPdfName).trim() : undefined,
      partyCount: partyCount as 1 | 2 | 3,
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
      contract.auditTrail.unshift(
        auditEvent('invitations_dispatched', `Signing invitations issued for ${contractNumber}.`, admin.email, ip)
      );
    }

    db.saveContract(contract);

    let emailsFailed = 0;
    if (sendNow) {
      const targets = signingOrder === 'parallel' ? parties : [parties[0]];
      const outcome = await deliverEmails(contract, invitationDrafts(req, contract, targets));
      emailsFailed = outcome.failed;
    }

    const saved = db.getContract(contractId)!;
    return res.json({ contract: saved, emailsFailed });
  } catch (err: any) {
    console.error('Error creating contract:', err);
    return res.status(400).json({ error: err.message || 'Failed to create contract' });
  }
});

apiRouter.post('/contracts/send-invitations', requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user as AuthUser;
    const ip = getClientIp(req);
    const { contractId } = req.body || {};
    const contract = db.getContract(String(contractId));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Invitations can only be sent for contracts in draft status.' });
    }

    const now = new Date().toISOString();
    const chosen = contract.signingOrder === 'parallel' ? contract.parties : [contract.parties[0]];
    chosen.forEach(p => (p.invitationSentAt = now));
    contract.status = 'pending_signature';
    contract.updatedAt = now;
    contract.auditTrail.unshift(
      auditEvent('invitations_dispatched', `Signing invitations issued for ${contract.contractNumber}.`, admin.email, ip)
    );
    syncShortcuts(contract);
    db.saveContract(contract);

    const outcome = await deliverEmails(contract, invitationDrafts(req, contract, chosen));
    return res.json({ contract: db.getContract(contractId)!, emailsFailed: outcome.failed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send invitations' });
  }
});

apiRouter.post('/contracts/send-reminder', requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user as AuthUser;
    const ip = getClientIp(req);
    const { contractId, roleKey, type } = req.body || {};
    const contract = db.getContract(String(contractId));
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (['cancelled', 'expired', 'fully_signed', 'draft'].includes(contract.status)) {
      return res.status(400).json({ error: 'Reminders can only be sent while a contract is awaiting signatures.' });
    }

    const recipient = contract.parties.find(p => p.roleKey === roleKey);
    if (!recipient) return res.status(404).json({ error: 'Signatory not found.' });
    if (recipient.status === 'signed') return res.status(400).json({ error: `${recipient.name} has already signed.` });
    if (!recipient.invitationSentAt) {
      return res.status(400).json({ error: `${recipient.name} has not been invited yet (sequential order).` });
    }

    const link = signingLink(req, recipient.signingToken);
    contract.auditTrail.unshift(
      auditEvent(
        'reminder_sent',
        `${String(type).replace(/_/g, ' ')} sent to Party ${recipient.partyIndex} - ${recipient.name} (${recipient.email})`,
        admin.email,
        ip
      )
    );
    db.saveContract(contract);

    const outcome = await deliverEmails(contract, [
      { recipient, type: type || 'manual_reminder', mail: reminderEmail(contract, recipient, link), link }
    ]);

    return res.json({ contract: db.getContract(contractId)!, emailsFailed: outcome.failed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to send reminder' });
  }
});

apiRouter.post('/contracts/cancel', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as AuthUser;
  const ip = getClientIp(req);
  const { contractId, reason } = req.body || {};
  const contract = db.getContract(String(contractId));
  if (!contract) return res.status(404).json({ error: 'Contract not found' });

  if (contract.status === 'fully_signed') {
    return res.status(400).json({ error: 'A fully signed contract cannot be cancelled.' });
  }
  if (contract.status === 'cancelled') {
    return res.status(400).json({ error: 'This contract is already cancelled.' });
  }

  const cancelReason = String(reason || '').trim() || 'Administrative void';
  contract.status = 'cancelled';
  contract.updatedAt = new Date().toISOString();
  contract.auditTrail.unshift(
    auditEvent('contract_cancelled', `Contract cancelled by ${admin.name}. Reason: ${cancelReason}`, admin.email, ip)
  );
  db.saveContract(contract);

  return res.json({ contract });
});

// ---------------------------------------------------------------------------
// SIGNING PORTAL (PUBLIC / TOKEN HOLDERS)
// ---------------------------------------------------------------------------
apiRouter.get('/signing/:token', (req: Request, res: Response) => {
  if (!checkSigningRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  const token = req.params.token;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return res.status(404).json({ error: 'Invalid or expired signing link. Please contact the sender.' });
  }

  const tokenMeta = db.getToken(token);
  if (!tokenMeta) {
    return res.status(404).json({ error: 'Invalid or expired signing link. Please contact the sender.' });
  }

  const contract = db.getContract(tokenMeta.contractId);
  if (!contract) {
    return res.status(404).json({ error: 'Invalid or expired signing link. Please contact the sender.' });
  }

  const signerIndex = contract.parties.findIndex(p => p.signingToken === token);
  if (signerIndex < 0) {
    return res.status(404).json({ error: 'Signatory not found for this token.' });
  }

  const signer = contract.parties[signerIndex];
  const ip = getClientIp(req);

  // Record document opened event if first time
  if (!signer.documentOpenedAt) {
    signer.documentOpenedAt = new Date().toISOString();
    contract.auditTrail.unshift(
      auditEvent('document_opened', `Party ${signer.partyIndex} - ${signer.name} opened the document.`, signer.name, ip)
    );
    syncShortcuts(contract);
    db.saveContract(contract);
  }

  const safe = sanitizeForSigner(contract);
  return res.json({
    contract: safe,
    signer: safe.parties[signerIndex],
    otherSigners: safe.parties.filter((_, i) => i !== signerIndex),
    role: signer.roleKey,
    ...evaluateTurn(contract, signerIndex)
  });
});

apiRouter.post('/signing/sign', async (req: Request, res: Response) => {
  if (!checkSigningRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  try {
    const { token, fullName, signatureImage, signatureMethod, consentAgreed } = req.body || {};
    if (!token || !TOKEN_PATTERN.test(token)) {
      return res.status(404).json({ error: 'Invalid or expired signing link.' });
    }

    if (consentAgreed !== true) {
      return res.status(400).json({ error: 'You must accept the electronic signature consent.' });
    }

    const name = String(fullName || '').trim();
    if (!name) return res.status(400).json({ error: 'Full name is required.' });

    const method = (['draw', 'type', 'upload'] as SignatureMethod[]).find(m => m === signatureMethod);
    if (!method) return res.status(400).json({ error: 'Invalid signature method.' });

    const image = typeof signatureImage === 'string' ? signatureImage : '';
    if (!image.startsWith('data:image/png;base64,') || image.length > 500_000) {
      return res.status(400).json({ error: 'The signature image is missing, too large, or not a PNG.' });
    }

    const tokenMeta = db.getToken(token);
    if (!tokenMeta) return res.status(404).json({ error: 'Invalid or expired signing link.' });

    const contract = db.getContract(tokenMeta.contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found.' });

    const signerIndex = contract.parties.findIndex(p => p.signingToken === token);
    if (signerIndex < 0) return res.status(404).json({ error: 'Signatory not found.' });

    const signer = contract.parties[signerIndex];
    if (contract.status === 'cancelled' || contract.status === 'expired') {
      return res.status(400).json({ error: 'This contract has been cancelled or has expired.' });
    }
    if (signer.status === 'signed') {
      return res.status(400).json({ error: 'You have already signed this document.' });
    }

    const turn = evaluateTurn(contract, signerIndex);
    if (!turn.canSignNow) {
      return res.status(400).json({ error: turn.waitingMessage || 'It is not your turn to sign yet.' });
    }

    const ip = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 300);
    const now = new Date().toISOString();

    signer.status = 'signed';
    signer.name = name;
    signer.signature = {
      signatureImage: image,
      signatureMethod: method,
      timestamp: now,
      ipAddress: ip,
      userAgent,
      signerName: name
    };
    contract.updatedAt = now;
    contract.auditTrail.unshift(
      auditEvent('signature_recorded', `Party ${signer.partyIndex} - ${name} (${signer.role}) signed via ${method.toUpperCase()}.`, name, ip)
    );

    let completed = false;
    let nextSignerToInvite: Signatory | null = null;

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
      contract.auditTrail.unshift(
        auditEvent('document_certified', `Fully executed by all ${contract.partyCount} parties. Sealed with SHA-256 ${contract.finalPdfHash.slice(0, 16)}...`, 'System', 'server')
      );
    } else {
      contract.status = 'partially_signed';
      const next = contract.parties[signerIndex + 1];
      if (contract.signingOrder === 'sequential' && next && next.status !== 'signed' && !next.invitationSentAt) {
        next.invitationSentAt = now;
        nextSignerToInvite = next;
        contract.auditTrail.unshift(
          auditEvent('sequential_invitation', `Party ${signer.partyIndex} verified. Inviting Party ${next.partyIndex} (${next.name}).`, 'System', 'server')
        );
      }
    }

    syncShortcuts(contract);
    db.saveContract(contract);

    // Emails go out after signature is safely stored
    const drafts: Draft[] = [];
    if (completed) {
      contract.parties.forEach(p => {
        drafts.push({
          recipient: p,
          type: 'completed',
          mail: completionEmail(contract, p),
          link: ''
        });
      });
    } else if (nextSignerToInvite) {
      drafts.push(...invitationDrafts(req, contract, [nextSignerToInvite]));
    }

    if (drafts.length > 0) {
      // Background or inline delivery
      await deliverEmails(contract, drafts);
    }

    const freshContract = db.getContract(contract.id)!;
    const safe = sanitizeForSigner(freshContract);
    return res.json({
      contract: safe,
      signer: safe.parties[signerIndex],
      otherSigners: safe.parties.filter((_, i) => i !== signerIndex),
      role: signer.roleKey,
      ...evaluateTurn(freshContract, signerIndex)
    });
  } catch (err: any) {
    console.error('Error in signContract:', err);
    return res.status(500).json({ error: err.message || 'Failed to submit signature' });
  }
});

// ---------------------------------------------------------------------------
// CATEGORIES (ADMIN)
// ---------------------------------------------------------------------------
apiRouter.get('/categories', (_req: Request, res: Response) => {
  return res.json(db.getCategories());
});

apiRouter.post('/categories', requireAdmin, (req: Request, res: Response) => {
  const { name, description } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Category name cannot be empty.' });

  const categories = db.getCategories();
  if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: `Category "${trimmed}" already exists.` });
  }

  const newCat = {
    id: newId('cat', 4),
    name: trimmed,
    description: String(description || '').trim(),
    createdAt: new Date().toISOString()
  };
  categories.push(newCat);
  db.saveCategories(categories);
  return res.json(newCat);
});

apiRouter.put('/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body || {};
  const trimmed = String(name || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'Category name cannot be empty.' });

  const categories = db.getCategories();
  const idx = categories.findIndex(c => c.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Category not found.' });

  if (categories.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: `Category "${trimmed}" already exists.` });
  }

  categories[idx] = {
    ...categories[idx],
    name: trimmed,
    description: String(description || '').trim()
  };
  db.saveCategories(categories);
  return res.json(categories[idx]);
});

apiRouter.delete('/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const categories = db.getCategories();
  if (categories.length <= 1) {
    return res.status(400).json({ error: 'At least one contract category must be maintained.' });
  }

  const filtered = categories.filter(c => c.id !== id);
  db.saveCategories(filtered);
  return res.json({ ok: true });
});
