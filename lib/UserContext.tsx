'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getOrCreateUser, updateUsername } from '@/lib/auth';
import { buildSignMessage } from '@/lib/siwe';
import { User } from '@/lib/supabase';

type UserContextType = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  refetchUser: () => Promise<void>;
  changeUsername: (newUsername: string) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  signingIn: false,
  authError: null,
  refetchUser: async () => {},
  changeUsername: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [user,      setUser]      = useState<User | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Track which address we've already authenticated this session
  // so we don't re-prompt on every re-render.
  const authedAddress = useRef<string | null>(null);

  async function loadUser() {
    if (!isConnected || !address) {
      setUser(null);
      setLoading(false);
      authedAddress.current = null;
      return;
    }

    // Already authenticated this address this session — user is in state, nothing to do
    if (authedAddress.current === address.toLowerCase() && user) {
      setLoading(false);
      return;
    }

    // New address this session — require wallet signature
    try {
      setLoading(true);
      setSigningIn(true);
      setAuthError(null);

      const message = buildSignMessage(address);
      const signature = await signMessageAsync({ message });

      const userData = await getOrCreateUser(address, signature);
      setUser(userData);
      authedAddress.current = address.toLowerCase();
    } catch (error) {
      console.error('Sign-in failed:', error);
      setUser(null);
      authedAddress.current = null;
      const msg = error instanceof Error ? error.message : String(error);
      setAuthError(msg);
    } finally {
      setLoading(false);
      setSigningIn(false);
    }
  }

  async function changeUsername(newUsername: string) {
    if (!user) throw new Error('No user logged in');
    const updatedUser = await updateUsername(user.id, newUsername);
    setUser(updatedUser);
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  return (
    <UserContext.Provider value={{ user, loading, signingIn, authError, refetchUser: loadUser, changeUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
