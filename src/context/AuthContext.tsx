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
import { createUserProfile } from '../services/userService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch (error) {
          console.error('Failed to sync user profile:', error);
        }
      }

      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    const { user: signedInUser } = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(signedInUser);
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(newUser, { displayName });
    await ensureUserProfile({ ...newUser, displayName } as User);
  }

  async function signInWithGoogle() {
    const { user: googleUser } = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(googleUser);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
