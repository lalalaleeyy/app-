import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  AuditEvent,
  Contract,
  ContractCategory,
  ContractStats,
  EmailLog,
  PartyRoleKey,
  SignatureMethod,
  SigningSession
} from '../types';
import { db, functions } from './firebase';
import { newId } from './security';

const STORAGE_KEY_CATEGORIES = 'ignite_vision_contract_categories';

// ----------------------------------------------------------------------
// CATEGORY MANAGEMENT (ADD / EDIT / REMOVE)
// ----------------------------------------------------------------------
const INITIAL_CATEGORIES: ContractCategory[] = [
  { id: 'cat_employment', name: 'Employment Agreement', description: 'Full-time, part-time, and executive employment agreements', createdAt: new Date().toISOString() },
  { id: 'cat_nda', name: 'Mutual Non-Disclosure Agreement', description: 'Confidentiality and non-disclosure covenants', createdAt: new Date().toISOString() },
  { id: 'cat_consulting', name: 'Consulting Services Agreement', description: 'Professional consulting and advisory engagement scopes', createdAt: new Date().toISOString() },
  { id: 'cat_contractor', name: 'Independent Contractor Agreement', description: 'Freelance, subcontractor, and vendor statement of work agreements', createdAt: new Date().toISOString() },
  { id: 'cat_vendor', name: 'Vendor / Service Level Agreement', description: 'Commercial vendor, procurement, and SLA governance', createdAt: new Date().toISOString() }
];

export function getCategories(): ContractCategory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CATEGORIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      return INITIAL_CATEGORIES;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CATEGORIES;
  } catch {
    return INITIAL_CATEGORIES;
  }
}

export function saveCategories(categories: ContractCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.error('Error saving categories:', err);
  }
}

export function addCategory(name: string, description?: string): ContractCategory {
  const categories = getCategories();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const exists = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) throw new Error(`Category "${trimmed}" already exists`);

  const newCat: ContractCategory = {
    id: newId('cat', 4),
    name: trimmed,
    description: description?.trim() || '',
    createdAt: new Date().toISOString()
  };

  categories.push(newCat);
  saveCategories(categories);
  return newCat;
}

export function updateCategory(id: string, name: string, description?: string): ContractCategory {
  const categories = getCategories();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const index = categories.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Category not found');

  const duplicate = categories.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) throw new Error(`Category "${trimmed}" already exists`);

  categories[index] = {
    ...categories[index],
    name: trimmed,
    description: description?.trim() || ''
  };

  saveCategories(categories);
  return categories[index];
}

export function deleteCategory(id: string): void {
  const categories = getCategories();
  if (categories.length <= 1) {
    throw new Error('At least one contract category must be maintained.');
  }
  const filtered = categories.filter(c => c.id !== id);
  saveCategories(filtered);
}

// ----------------------------------------------------------------------
// CONTRACTS (shared Firestore database, written only by Cloud Functions)
// ----------------------------------------------------------------------

/** Live-updates when a signer signs, an email is logged, etc. Returns the unsubscribe function. */
export function subscribeContracts(onData: (contracts: Contract[]) => void, onError: (err: Error) => void): () => void {
  const q = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => d.data() as Contract)),
    err => onError(err)
  );
}

export function filterContracts(list: Contract[], statusFilter = 'all', searchQuery = ''): Contract[] {
  let out = list;
  if (statusFilter && statusFilter !== 'all') {
    out =
      statusFilter === 'expired_cancelled'
        ? out.filter(c => c.status === 'cancelled' || c.status === 'expired')
        : out.filter(c => c.status === statusFilter);
  }
  const q = searchQuery.toLowerCase().trim();
  if (q) {
    out = out.filter(
      c =>
        c.contractNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.contractType.toLowerCase().includes(q) ||
        c.parties.some(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
    );
  }
  return out;
}

export function calculateStats(contracts: Contract[]): ContractStats {
  const count = (pred: (c: Contract) => boolean) => contracts.filter(pred).length;
  return {
    total: contracts.length,
    draft: count(c => c.status === 'draft'),
    pending: count(c => c.status === 'pending_signature'),
    partiallySigned: count(c => c.status === 'partially_signed'),
    fullySigned: count(c => c.status === 'fully_signed'),
    expiredCancelled: count(c => c.status === 'cancelled' || c.status === 'expired')
  };
}

/** Every email attempt across all contracts, newest first. */
export function buildEmailOutbox(contracts: Contract[]): EmailLog[] {
  return contracts
    .flatMap(c => c.invitationHistory ?? [])
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
}

export type AuditVaultEntry = AuditEvent & { contractNumber: string; contractTitle: string; contractId: string };

export function buildAuditVault(contracts: Contract[]): AuditVaultEntry[] {
  return contracts
    .flatMap(c => c.auditTrail.map(a => ({ ...a, contractId: c.id, contractNumber: c.contractNumber, contractTitle: c.title })))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

// ----------------------------------------------------------------------
// CLOUD FUNCTION CALLS
// ----------------------------------------------------------------------
async function call<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
  try {
    const res = await httpsCallable<TReq, TRes>(functions, name)(data);
    return res.data;
  } catch (err) {
    // Firebase errors carry a user-facing message from the function (e.g. "A contract numbered X already exists.")
    const message = err instanceof Error ? err.message : 'Request failed';
    throw new Error(message === 'internal' ? 'The server could not complete the request. Please try again.' : message);
  }
}

export interface ContractMutationResult {
  contract: Contract;
  /** Number of emails the mail server refused or that errored. 0 means every email was accepted for delivery. */
  emailsFailed: number;
}

export interface CreateContractParams {
  contractNumber: string;
  title: string;
  contractType: string;
  contractDate: string;
  signingOrder: 'sequential' | 'parallel';
  sendInvitationsNow: boolean;
  notes?: string;
  partyCount: 1 | 2 | 3;
  parties: { name: string; email: string; role: string }[];
  fields: Contract['fields'];
  uploadedPdfName?: string;
}

export const createContract = (params: CreateContractParams) =>
  call<CreateContractParams, ContractMutationResult>('createContract', params);

export const sendInvitations = (contractId: string) =>
  call<{ contractId: string }, ContractMutationResult>('sendInvitations', { contractId });

export const sendReminder = (
  contractId: string,
  roleKey: PartyRoleKey,
  type: 'reminder_24h' | 'reminder_48h' | 'manual_reminder'
) => call<{ contractId: string; roleKey: PartyRoleKey; type: string }, ContractMutationResult>('sendReminder', { contractId, roleKey, type });

export const cancelContract = (contractId: string, reason: string) =>
  call<{ contractId: string; reason: string }, { contract: Contract }>('cancelContract', { contractId, reason });

// Signer (no login; authorised by the private token in the link)
export const getSigningSession = (token: string) => call<{ token: string }, SigningSession>('getSigningSession', { token });

export const signContract = (params: {
  token: string;
  fullName: string;
  signatureImage: string;
  signatureMethod: SignatureMethod;
  consentAgreed: boolean;
}) => call<typeof params, SigningSession>('signContract', params);
