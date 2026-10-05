export type ContractStatus = 
  | 'draft' 
  | 'pending_signature' 
  | 'partially_signed' 
  | 'fully_signed' 
  | 'cancelled' 
  | 'expired';

export type SigningOrder = 'sequential' | 'parallel';

export type SignatureMethod = 'draw' | 'type' | 'upload';

export type PartyRoleKey = 'party1' | 'party2' | 'party3';

export interface SignatureRecord {
  signatureImage: string;
  signatureMethod: SignatureMethod;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  signerName: string;
}

export interface Signatory {
  id: string;
  roleKey: PartyRoleKey;
  partyIndex: number; // 1, 2, or 3
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'signed';
  signingToken: string;
  invitationSentAt: string | null;
  documentOpenedAt: string | null;
  signature: SignatureRecord | null;
}

export interface SignatureField {
  id: string;
  recipientRole: PartyRoleKey;
  type: 'signature' | 'initials' | 'date';
  page: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  required: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  event: string;
  description: string;
  actor: string;
  ipAddress: string;
}

export interface EmailLog {
  id: string;
  contractId: string;
  contractNumber: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  type: 'invitation' | 'reminder_24h' | 'reminder_48h' | 'manual_reminder' | 'completed';
  subject: string;
  sentAt: string;
  signingLink: string;
  previewContent: string;
  /** 'sent' = accepted by the mail server, 'failed' = delivery attempt errored. */
  status: 'sent' | 'failed';
  /** Mail server message id when sent, or a short error description when failed. */
  providerMessageId?: string;
  error?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  contractType: string;
  contractDate: string;
  signingOrder: SigningOrder;
  status: ContractStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  originalPdfHash: string;
  finalPdfHash: string | null;
  uploadedPdfData?: string; // base64 data url or file name
  uploadedPdfName?: string;
  partyCount: 1 | 2 | 3;
  parties: Signatory[];
  // Backwards compatibility shortcuts
  party1: Signatory;
  party2?: Signatory;
  party3?: Signatory;
  fields: SignatureField[];
  auditTrail: AuditEvent[];
  invitationHistory: EmailLog[];
}

export interface ContractCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ContractStats {
  total: number;
  draft: number;
  pending: number;
  partiallySigned: number;
  fullySigned: number;
  expiredCancelled: number;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string;
}
