import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const company = searchParams.get('company');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const limit = Math.min(parseInt(limitParam ?? '20', 10) || 20, 100);
  const offset = parseInt(offsetParam ?? '0', 10) || 0;

  const supabase = serviceSupabase();

  let query = supabase
    .from('posts')
    .select('id, company_name, title, content, category, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (company) {
    // Case-insensitive exact match on company name
    query = query.ilike('company_name', company);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data ?? [], count: (data ?? []).length });
}
