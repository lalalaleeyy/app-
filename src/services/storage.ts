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
import { getAuthToken } from './auth';
import { newId } from './security';

const STORAGE_KEY_CATEGORIES = 'ignite_vision_contract_categories';

// ----------------------------------------------------------------------
// CATEGORY MANAGEMENT (Synchronized with Server)
// ----------------------------------------------------------------------
const INITIAL_CATEGORIES: ContractCategory[] = [
  { id: 'cat_employment', name: 'Employment Agreement', description: 'Full-time, part-time, and executive employment agreements', createdAt: new Date().toISOString() },
  { id: 'cat_nda', name: 'Mutual Non-Disclosure Agreement', description: 'Confidentiality and non-disclosure covenants', createdAt: new Date().toISOString() },
  { id: 'cat_consulting', name: 'Consulting Services Agreement', description: 'Professional consulting and advisory engagement scopes', createdAt: new Date().toISOString() },
  { id: 'cat_contractor', name: 'Independent Contractor Agreement', description: 'Freelance, subcontractor, and vendor statement of work agreements', createdAt: new Date().toISOString() },
  { id: 'cat_vendor', name: 'Vendor / Service Level Agreement', description: 'Commercial vendor, procurement, and SLA governance', createdAt: new Date().toISOString() }
];

let cachedCategories: ContractCategory[] = INITIAL_CATEGORIES;
try {
  const localData = localStorage.getItem(STORAGE_KEY_CATEGORIES);
  if (localData) {
    const parsed = JSON.parse(localData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedCategories = parsed;
    }
  }
} catch {
  // Use INITIAL_CATEGORIES
}

export function refreshCategoriesFromServer(): void {
  fetch('/api/categories')
    .then(res => (res.ok ? res.json() : null))
    .then(cats => {
      if (Array.isArray(cats) && cats.length > 0) {
        cachedCategories = cats;
        try {
          localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
        } catch {}
      }
    })
    .catch(() => undefined);
}

// Initial sync
refreshCategoriesFromServer();

export function getCategories(): ContractCategory[] {
  return cachedCategories;
}

export function saveCategories(categories: ContractCategory[]): void {
  cachedCategories = categories;
  try {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.error('Error saving categories locally:', err);
  }
}

export function addCategory(name: string, description?: string): ContractCategory {
  const categories = [...getCategories()];
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

  // Sync to server so all devices see the new category
  const token = getAuthToken();
  if (token) {
    fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: trimmed, description: description?.trim() || '' })
    }).catch(err => console.warn('Could not sync category to server:', err));
  }

  return newCat;
}

export function updateCategory(id: string, name: string, description?: string): ContractCategory {
  const categories = [...getCategories()];
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

  // Sync to server so all devices see the updated category
  const token = getAuthToken();
  if (token) {
    fetch(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: trimmed, description: description?.trim() || '' })
    }).catch(err => console.warn('Could not sync updated category to server:', err));
  }

  return categories[index];
}

export function deleteCategory(id: string): void {
  const categories = getCategories();
  if (categories.length <= 1) {
    throw new Error('At least one contract category must be maintained.');
  }
  const filtered = categories.filter(c => c.id !== id);
  saveCategories(filtered);

  // Sync to server so all devices see the deletion
  const token = getAuthToken();
  if (token) {
    fetch(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => console.warn('Could not sync category deletion to server:', err));
  }
}

// ----------------------------------------------------------------------
// CONTRACTS LIVE SYNC ACROSS DEVICES
// ----------------------------------------------------------------------
export function subscribeContracts(
  onData: (contracts: Contract[]) => void,
  onError: (err: Error) => void
): () => void {
  let isCancelled = false;

  const fetchContracts = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      // Sync categories as well
      refreshCategoriesFromServer();

      const res = await fetch('/api/contracts', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) return;
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!isCancelled) {
        onData(data);
      }
    } catch (err: any) {
      if (!isCancelled) {
        onError(err);
      }
    }
  };

  fetchContracts();
  const intervalId = setInterval(fetchContracts, 3000);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
  };
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
// BACKEND API CLIENT CALLS
// ----------------------------------------------------------------------
async function apiCall<TRes>(endpoint: string, options: RequestInit = {}): Promise<TRes> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    credentials: 'include',
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Server request failed (${res.status})`);
  }
  return data as TRes;
}

export interface ContractMutationResult {
  contract: Contract;
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
  apiCall<ContractMutationResult>('/api/contracts/create', {
    method: 'POST',
    body: JSON.stringify(params)
  });

export const sendInvitations = (contractId: string) =>
  apiCall<ContractMutationResult>('/api/contracts/send-invitations', {
    method: 'POST',
    body: JSON.stringify({ contractId })
  });

export const sendReminder = (
  contractId: string,
  roleKey: PartyRoleKey,
  type: 'reminder_24h' | 'reminder_48h' | 'manual_reminder'
) =>
  apiCall<ContractMutationResult>('/api/contracts/send-reminder', {
    method: 'POST',
    body: JSON.stringify({ contractId, roleKey, type })
  });

export const cancelContract = (contractId: string, reason: string) =>
  apiCall<{ contract: Contract }>('/api/contracts/cancel', {
    method: 'POST',
    body: JSON.stringify({ contractId, reason })
  });

// Signer Portal APIs (Public with token)
export const getSigningSession = (token: string) =>
  apiCall<SigningSession>(`/api/signing/${encodeURIComponent(token)}`);

export const signContract = (params: {
  token: string;
  fullName: string;
  signatureImage: string;
  signatureMethod: SignatureMethod;
  consentAgreed: boolean;
}) =>
  apiCall<SigningSession>('/api/signing/sign', {
    method: 'POST',
    body: JSON.stringify(params)
  });
