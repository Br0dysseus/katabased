'use server';

import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';
import { timeAgo } from '@/lib/posts';
import type { FeedPost } from '@/lib/posts';

function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

// ─── Input sanitization ────────────────────────────────────────────────────────
// Strip HTML tags and trim whitespace. Prevents stored-XSS if content ever
// renders in a non-React context (emails, mobile apps, third-party integrations).
function sanitizeContent(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

// biome-ignore lint: supabase returns untyped rows
function normalizePost(p: Record<string, unknown> & { users?: { username?: string } }): FeedPost {
  return {
    id: String(p.id),
    author: p.users?.username ?? 'anon_unknown',
    entity: (p.company_name as string) ?? '—',
    title: p.title as string,
    content: p.content as string,
    confirms: (p.confirms as number) ?? 0,
    disputes: (p.disputes as number) ?? 0,
    replies: 0,
    time: timeAgo(p.created_at as string),
  };
}

export async function createPost(
  sessionToken: string,
  title: string,
  content: string,
  entityName: string,
): Promise<FeedPost> {
  const userId = verifySession(sessionToken);

  const trimmedTitle = sanitizeContent(title);
  const trimmedContent = sanitizeContent(content);
  const trimmedEntity = sanitizeContent(entityName);

  if (!trimmedTitle || trimmedTitle.length > 120) throw new Error('Title must be 1–120 characters');
  if (!trimmedContent || trimmedContent.length > 2000) throw new Error('Content must be 1–2000 characters');
  if (trimmedEntity.length > 100) throw new Error('Entity name must be ≤ 100 characters');

  const supabase = serverSupabase();

  // Rate limit: max 5 posts per user per hour
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (countError) throw countError;
  if ((count ?? 0) >= 5) throw new Error('Rate limit: max 5 transmissions per hour');

  const { data, error } = await supabase
    .from('posts')
    .insert([{
      user_id: userId,
      title: trimmedTitle,
      content: trimmedContent,
      category: 'transmission',
      company_name: trimmedEntity || null,
      confirms: 0,
      disputes: 0,
    }])
    .select('*, users(username)')
    .single();

  if (error) throw error;
  return normalizePost(data);
}
