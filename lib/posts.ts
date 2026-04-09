import { supabase } from './supabase';

export type FeedPost = {
  id: string | number;
  author: string;
  entity: string;
  title: string;
  content: string;
  confirms: number;
  disputes: number;
  replies: number;
  time: string;
};

export type EntityRow = {
  name: string;
  count: number;
  sent: number;
};

export type LeaderRow = {
  rank: number;
  user: string;
  karma: number;
  posts: number;
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

// biome-ignore lint: supabase returns untyped rows
function normalizePost(p: Record<string, unknown> & { users?: { username?: string } }): FeedPost {
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

export async function getPosts(entity?: string): Promise<FeedPost[]> {
  let query = supabase
    .from('posts')
    .select('*, users(username)')
    .order('created_at', { ascending: false })
    .limit(30);

  if (entity) {
    query = query.ilike('company_name', entity);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

export async function createPost(
  userId: string,
  title: string,
  content: string,
  entityName: string,
): Promise<FeedPost> {
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
      title: title.trim(),
      content: content.trim(),
      category: 'transmission',
      company_name: entityName.trim() || null,
      confirms: 0,
      disputes: 0,
    }])
    .select('*, users(username)')
    .single();

  if (error) throw error;
  return normalizePost(data);
}

export async function getUserStats(userId: string): Promise<{ postCount: number; karma: number }> {
  const { data, error } = await supabase
    .from('posts')
    .select('confirms, disputes')
    .eq('user_id', userId);

  if (error || !data) return { postCount: 0, karma: 0 };

  return {
    postCount: data.length,
    karma: data.reduce(
      (sum: number, p: { confirms?: number; disputes?: number }) =>
        sum + (p.confirms ?? 0) - (p.disputes ?? 0),
      0,
    ),
  };
}

export async function getEntities(): Promise<EntityRow[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('company_name, confirms, disputes')
    .not('company_name', 'is', null);

  if (error || !data || data.length === 0) return [];

  const map = new Map<string, { count: number; conf: number; total: number }>();
  for (const p of data as Array<{ company_name: string | null; confirms?: number; disputes?: number }>) {
    if (!p.company_name) continue;
    const e = map.get(p.company_name) ?? { count: 0, conf: 0, total: 0 };
    map.set(p.company_name, {
      count: e.count + 1,
      conf: e.conf + (p.confirms ?? 0),
      total: e.total + (p.confirms ?? 0) + (p.disputes ?? 0),
    });
  }

  return Array.from(map.entries())
    .map(([name, s]) => ({
      name,
      count: s.count,
      sent: s.total > 0 ? s.conf / s.total : 0.5,
    }))
    .sort((a, b) => b.count - a.count);
}

/** @deprecated use getEntities */
export const getCompanies = getEntities;

export async function getLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('user_id, confirms, disputes, users(username)')
    .not('user_id', 'is', null);

  if (error || !data || data.length === 0) return [];

  const map = new Map<string, { username: string; karma: number; posts: number }>();
  for (const p of data as Array<{ user_id: string; confirms?: number; disputes?: number; users?: { username?: string } }>) {
    if (!p.user_id) continue;
    const e = map.get(p.user_id) ?? { username: p.users?.username ?? 'anon', karma: 0, posts: 0 };
    map.set(p.user_id, {
      username: e.username,
      karma: e.karma + (p.confirms ?? 0) - (p.disputes ?? 0),
      posts: e.posts + 1,
    });
  }

  return Array.from(map.values())
    .sort((a, b) => b.karma - a.karma)
    .slice(0, 10)
    .map((e, i) => ({ rank: i + 1, user: e.username, karma: e.karma, posts: e.posts }));
}
