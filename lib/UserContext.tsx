'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getOrCreateUser, updateUsername } from '@/lib/auth';
import { buildSignMessage } from '@/lib/siwe';
import { User } from '@/lib/supabase';

type UserContextType = {
  user: User | null;
  sessionToken: string | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  refetchUser: () => Promise<void>;
  changeUsername: (newUsername: string) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  sessionToken: null,
  loading: true,
  signingIn: false,
  authError: null,
  refetchUser: async () => {},
  changeUsername: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [user,         setUser]         = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [signingIn,    setSigningIn]    = useState(false);
  const [authError,    setAuthError]    = useState<string | null>(null);

  // Track which address we've already authenticated this session
  // so we don't re-prompt on every re-render.
  const authedAddress = useRef<string | null>(null);
  // Refs mirror state to avoid stale closure in loadUser
  const userRef         = useRef<User | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  async function loadUser() {
    if (!isConnected || !address) {
      setUser(null);
      setLoading(false);
      authedAddress.current = null;
      userRef.current = null;
      sessionTokenRef.current = null;
      return;
    }

    const addrLower = address.toLowerCase();

    // Already authenticated this address this session — user is in state, nothing to do
    if (authedAddress.current === addrLower && userRef.current && sessionTokenRef.current) {
      setLoading(false);
      return;
    }

    // Check localStorage for existing session — skip signature prompt if valid
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`kb:session:${addrLower}`);
        if (stored) {
          const parsed = JSON.parse(stored) as { user: User; token: string; exp: number };
          if (parsed.exp > Date.now() && parsed.user && parsed.token) {
            setUser(parsed.user);
            setSessionToken(parsed.token);
            userRef.current = parsed.user;
            sessionTokenRef.current = parsed.token;
            authedAddress.current = addrLower;
            setLoading(false);
            return;
          }
          localStorage.removeItem(`kb:session:${addrLower}`);
        }
      } catch {
        // corrupt localStorage — ignore and re-sign
      }
    }

    // New address this session — require wallet signature
    try {
      setLoading(true);
      setSigningIn(true);
      setAuthError(null);

      const message = buildSignMessage(address);
      const signature = await signMessageAsync({ message, account: address as `0x${string}` });

      const { user: userData, sessionToken: token } = await getOrCreateUser(address, signature);
      setUser(userData);
      setSessionToken(token);
      userRef.current = userData;
      sessionTokenRef.current = token;
      authedAddress.current = addrLower;

      // Persist — 24h expiry matches server-side session TTL in auth.ts
      if (typeof window !== 'undefined') {
        localStorage.setItem(`kb:session:${addrLower}`, JSON.stringify({
          user: userData, token, exp: Date.now() + 24 * 60 * 60 * 1000,
        }));
      }
    } catch (error) {
      console.error('Sign-in failed:', error);
      setUser(null);
      setSessionToken(null);
      userRef.current = null;
      sessionTokenRef.current = null;
      authedAddress.current = null;
      const msg = error instanceof Error ? error.message : String(error);
      setAuthError(msg);
    } finally {
      setLoading(false);
      setSigningIn(false);
    }
  }

  async function changeUsername(newUsername: string) {
    if (!sessionToken) throw new Error('No active session — reconnect wallet');
    const updatedUser = await updateUsername(sessionToken, newUsername);
    setUser(updatedUser);
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  return (
    <UserContext.Provider value={{ user, sessionToken, loading, signingIn, authError, refetchUser: loadUser, changeUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
