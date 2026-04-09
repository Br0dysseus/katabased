import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
