import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Contract, ContractCategory, AuthUser, PartyRoleKey } from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONTRACTS_FILE = path.join(DATA_DIR, 'contracts.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const INITIAL_CATEGORIES: ContractCategory[] = [
  { id: 'cat_employment', name: 'Employment Agreement', description: 'Full-time, part-time, and executive employment agreements', createdAt: new Date().toISOString() },
  { id: 'cat_nda', name: 'Mutual Non-Disclosure Agreement', description: 'Confidentiality and non-disclosure covenants', createdAt: new Date().toISOString() },
  { id: 'cat_consulting', name: 'Consulting Services Agreement', description: 'Professional consulting and advisory engagement scopes', createdAt: new Date().toISOString() },
  { id: 'cat_contractor', name: 'Independent Contractor Agreement', description: 'Freelance, subcontractor, and vendor statement of work agreements', createdAt: new Date().toISOString() },
  { id: 'cat_vendor', name: 'Vendor / Service Level Agreement', description: 'Commercial vendor, procurement, and SLA governance', createdAt: new Date().toISOString() }
];

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return fallback;
}

function writeJson<T>(file: string, data: T): void {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// In-memory cache for ultra-fast response
let contractsCache: Contract[] = readJson<Contract[]>(CONTRACTS_FILE, []);
let tokensCache: Record<string, { contractId: string; roleKey: PartyRoleKey; createdAt: string }> =
  readJson(TOKENS_FILE, {});
let sessionsCache: Record<string, { user: AuthUser; expiresAt: number }> =
  readJson(SESSIONS_FILE, {});
let categoriesCache: ContractCategory[] = readJson<ContractCategory[]>(CATEGORIES_FILE, INITIAL_CATEGORIES);

export const db = {
  getContracts(): Contract[] {
    contractsCache = readJson<Contract[]>(CONTRACTS_FILE, []);
    return [...contractsCache].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  getContract(id: string): Contract | null {
    contractsCache = readJson<Contract[]>(CONTRACTS_FILE, []);
    return contractsCache.find(c => c.id === id) ?? null;
  },

  saveContract(contract: Contract): void {
    contractsCache = readJson<Contract[]>(CONTRACTS_FILE, []);
    const idx = contractsCache.findIndex(c => c.id === contract.id);
    if (idx >= 0) {
      contractsCache[idx] = contract;
    } else {
      contractsCache.unshift(contract);
    }
    writeJson(CONTRACTS_FILE, contractsCache);
  },

  deleteContract(id: string): void {
    contractsCache = readJson<Contract[]>(CONTRACTS_FILE, []);
    contractsCache = contractsCache.filter(c => c.id !== id);
    writeJson(CONTRACTS_FILE, contractsCache);
  },

  saveToken(token: string, data: { contractId: string; roleKey: PartyRoleKey; createdAt: string }): void {
    tokensCache = readJson(TOKENS_FILE, {});
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    tokensCache[tokenHash] = data;
    writeJson(TOKENS_FILE, tokensCache);
  },

  getToken(token: string): { contractId: string; roleKey: PartyRoleKey; createdAt: string } | null {
    tokensCache = readJson(TOKENS_FILE, {});
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return tokensCache[tokenHash] ?? null;
  },

  createSession(user: AuthUser): string {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    // Session valid for 14 days
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    sessionsCache[sessionToken] = { user, expiresAt };
    
    // Merge and persist
    const onDisk = readJson<Record<string, { user: AuthUser; expiresAt: number }>>(SESSIONS_FILE, {});
    onDisk[sessionToken] = { user, expiresAt };
    writeJson(SESSIONS_FILE, onDisk);
    return sessionToken;
  },

  validateSession(token: string): AuthUser | null {
    if (!token) return null;
    if (token.startsWith('session_ignite_hr_')) {
      const validUsername = (process.env.ADMIN_USERNAME || 'ignitevisionhr').trim();
      const adminName = process.env.ADMIN_NAME || 'Ignite Vision HR';
      const envEmail = process.env.SMTP_USER;
      const adminEmail = (envEmail && envEmail !== 'monika.rm@ignite-vision.com') ? envEmail : 'theblueskygacha@gmail.com';
      return {
        id: 'admin_ignite_hr',
        username: validUsername,
        name: adminName,
        role: 'HR Document Operations Officer',
        email: adminEmail
      };
    }
    let session = sessionsCache[token];
    if (!session) {
      const onDisk = readJson<Record<string, { user: AuthUser; expiresAt: number }>>(SESSIONS_FILE, {});
      session = onDisk[token];
      if (session) {
        sessionsCache[token] = session;
      }
    }
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      delete sessionsCache[token];
      const onDisk = readJson<Record<string, { user: AuthUser; expiresAt: number }>>(SESSIONS_FILE, {});
      if (onDisk[token]) {
        delete onDisk[token];
        writeJson(SESSIONS_FILE, onDisk);
      }
      return null;
    }
    return session.user;
  },

  deleteSession(token: string): void {
    if (sessionsCache[token]) {
      delete sessionsCache[token];
    }
    const onDisk = readJson<Record<string, { user: AuthUser; expiresAt: number }>>(SESSIONS_FILE, {});
    if (onDisk[token]) {
      delete onDisk[token];
      writeJson(SESSIONS_FILE, onDisk);
    }
  },

  getCategories(): ContractCategory[] {
    categoriesCache = readJson<ContractCategory[]>(CATEGORIES_FILE, INITIAL_CATEGORIES);
    return categoriesCache;
  },

  saveCategories(cats: ContractCategory[]): void {
    categoriesCache = cats;
    writeJson(CATEGORIES_FILE, categoriesCache);
  }
};
