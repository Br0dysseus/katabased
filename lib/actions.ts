'use server';

import { createClient } from '@supabase/supabase-js';
import { verifySession } from '@/lib/session';
import type { FeedPost } from '@/lib/posts';

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// biome-ignore lint: supabase returns untyped rows
function normalizePost(p: Record<string, unknown> & { users?: { username?: string } }): FeedPost {
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d`;
    return `${Math.floor(d / 30)}mo`;
  };
  return {
    id: p.id as string,
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

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const trimmedEntity = entityName.trim();

  if (!trimmedTitle || trimmedTitle.length > 120) throw new Error('Title must be 1–120 characters');
  if (!trimmedContent || trimmedContent.length > 2000) throw new Error('Content must be 1–2000 characters');
  if (trimmedEntity.length > 50) throw new Error('Entity name must be ≤ 50 characters');

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
