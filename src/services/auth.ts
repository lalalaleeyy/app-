import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { ADMIN_EMAIL_DOMAIN } from '../config';
import { AuthUser } from '../types';
import { auth } from './firebase';

const provider = new GoogleAuthProvider();
// Hint Google to pre-select the company account. Authorization is still enforced server-side.
provider.setCustomParameters({ prompt: 'select_account', hd: ADMIN_EMAIL_DOMAIN });

export function isCompanyAccount(user: User | null): boolean {
  const email = user?.email?.toLowerCase() ?? '';
  return !!user?.emailVerified && email.endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}

function toAuthUser(user: User): AuthUser {
  const email = user.email ?? '';
  return {
    id: user.uid,
    username: email,
    name: user.displayName || email,
    role: 'HR Document Operations Officer',
    email
  };
}

/** Subscribes to the admin session. Non-company accounts are signed out immediately. */
export function watchAdminSession(onChange: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, async firebaseUser => {
    if (firebaseUser && !isCompanyAccount(firebaseUser)) {
      await signOut(auth);
      onChange(null);
      return;
    }
    onChange(firebaseUser ? toAuthUser(firebaseUser) : null);
  });
}

export async function signInAdmin(): Promise<AuthUser> {
  const result = await signInWithPopup(auth, provider);
  if (!isCompanyAccount(result.user)) {
    await signOut(auth);
    throw new Error(`Please sign in with your @${ADMIN_EMAIL_DOMAIN} Google account.`);
  }
  return toAuthUser(result.user);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
