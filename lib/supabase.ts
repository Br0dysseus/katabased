import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// createClient with empty strings returns a non-functional client that won't crash at init.
// Actual API calls will fail with auth errors — surfaced per-call, not at module load.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Types for our database tables
export type User = {
  id: string;
  wallet_hash: string; // HMAC-SHA256 of wallet address — raw address is never stored
  username: string;
  karma?: number; // computed client-side from confirms/disputes — not stored in DB
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  company_name: string | null;
  confirms: number;
  disputes: number;
  created_at: string;
  updated_at: string;
  users?: {
    username: string;
  };
};
