'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { clientFirebaseConfigured, getFirebaseAuth, getGoogleProvider } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(clientFirebaseConfigured());

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    } catch { /* The initial state is already false when browser Firebase is absent. */ }
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const result = await signInWithPopup(auth, getGoogleProvider());
    const idToken = await result.user.getIdToken(true);
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      await signOut(auth);
      throw new Error('This Google account is not authorized for the owner workspace.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
    await signOut(getFirebaseAuth());
    window.location.assign('/owner-login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

