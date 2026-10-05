import { AuthUser } from '../types';

const TOKEN_KEY = 'ignite_admin_token';
const USER_KEY = 'ignite_admin_user';

let currentSessionUser: AuthUser | null = null;
const listeners: Set<(user: AuthUser | null) => void> = new Set();

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  if (currentSessionUser) return currentSessionUser;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function notifyListeners(user: AuthUser | null) {
  currentSessionUser = user;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  listeners.forEach(cb => cb(user));
}

/**
 * Subscribes to the admin session.
 */
export function watchAdminSession(onChange: (user: AuthUser | null) => void): () => void {
  listeners.add(onChange);

  const token = getAuthToken();
  if (!token) {
    onChange(null);
  } else {
    // Validate session with backend
    fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Session invalid');
        return res.json();
      })
      .then(data => {
        if (data.user) {
          notifyListeners(data.user);
        } else {
          notifyListeners(null);
        }
      })
      .catch(() => {
        notifyListeners(null);
      });
  }

  return () => {
    listeners.delete(onChange);
  };
}

export async function signInAdmin(username: string, password: string): Promise<AuthUser> {
  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '').trim();

  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
    });
  } catch (netErr: any) {
    throw new Error('Connection error. Please check your internet connection.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed. Please check your credentials.');
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  notifyListeners(data.user);
  return data.user;
}

export async function signOutAdmin(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => undefined);
  }
  notifyListeners(null);
}
