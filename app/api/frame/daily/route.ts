import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://katabased.io';

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// Returns a random recent post for the daily frame
async function getDailyPost() {
  const supabase = serviceSupabase();
  const { data } = await supabase
    .from('posts')
    .select('id, company_name, title, content, category, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return null;
  // Pick a random post from the 20 most recent
  return data[Math.floor(Math.random() * data.length)];
}

export async function GET(req: NextRequest) {
  const post = await getDailyPost();

  if (!post) {
    return new NextResponse('No posts found', { status: 404 });
  }

  const imageUrl = `${BASE_URL}/api/frame/image?id=${post.id}`;
  const actionUrl = `${BASE_URL}/api/frame/action`;
  const siteUrl = `${BASE_URL}/dashboard`;

  // Farcaster Frame v2 meta tags
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>kataBased — ${post.company_name}</title>
  <meta property="og:title" content="kataBased — ${post.company_name}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:post_url" content="${actionUrl}" />
  <meta property="fc:frame:button:1" content="More from inside" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:button:2" content="File a transmission" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${siteUrl}" />
  <meta property="fc:frame:state" content="${encodeURIComponent(JSON.stringify({ post_id: post.id, company: post.company_name }))}" />
</head>
<body>
  <p>${post.company_name}: ${post.title}</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
