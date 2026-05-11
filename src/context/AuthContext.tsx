import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { clearDeletedUserLocalData, createUserProfile } from '../services/userService';

const DISABLED_ACCOUNT_MESSAGE = 'This account has been disabled and its data was deleted. Sign-in is blocked so the same account cannot receive a new free trial or reset credits.';

function isDisabledAccountError(error: unknown): error is Error {
  return error instanceof Error && /account has been disabled/i.test(error.message);
}

function normalizeAuthError(error: unknown): Error {
  if (isDisabledAccountError(error)) {
    return new Error(DISABLED_ACCOUNT_MESSAGE);
  }

  return error instanceof Error ? error : new Error('Authentication failed.');
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccountData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function ensureUserProfile(firebaseUser: User) {
    await createUserProfile(
      firebaseUser.uid,
      firebaseUser.email ?? '',
      firebaseUser.displayName ?? 'TubeFlow User',
      firebaseUser.photoURL ?? undefined,
    );
  }

  async function ensureActiveSession(firebaseUser: User): Promise<void> {
    try {
      await ensureUserProfile(firebaseUser);
    } catch (error) {
      if (isDisabledAccountError(error)) {
        await firebaseSignOut(auth);
        throw normalizeAuthError(error);
      }

      throw error;
    }
  }

  async function finalizeAuthenticatedUser(firebaseUser: User): Promise<void> {
    try {
      await ensureActiveSession(firebaseUser);
    } catch (error) {
      if (isDisabledAccountError(error)) {
        throw normalizeAuthError(error);
      }

      console.error('Failed to sync user profile after authentication:', error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        await ensureActiveSession(firebaseUser);
        setUser(firebaseUser);
      } catch (error) {
        setUser(isDisabledAccountError(error) ? null : firebaseUser);
        console.error('Failed to sync user profile:', error);
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    const { user: signedInUser } = await signInWithEmailAndPassword(auth, email, password);
    await finalizeAuthenticatedUser(signedInUser);
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName });
    await finalizeAuthenticatedUser({ ...newUser, displayName } as User);
  }

  async function signInWithGoogle() {
    const { user: googleUser } = await signInWithPopup(auth, googleProvider);
    await finalizeAuthenticatedUser(googleUser);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function deleteAccountData() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Sign in again before deleting your account data.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    const payload = await response.json().catch(() => null) as { userMessage?: string; error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.userMessage || payload?.error || 'Failed to delete account data.');
    }

    clearDeletedUserLocalData(currentUser.uid);
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut, deleteAccountData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
