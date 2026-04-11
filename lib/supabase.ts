import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoaG9kZ3piZ3d6YmF0cWduY2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NzE3MDcsImV4cCI6MjA4NjI0NzcwN30.6rBI5wQoGd76-6O7o8F0R3767xFaGllB3BS5avb8uYo';

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
