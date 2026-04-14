import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://katabased.io';

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// Handle button press — button 1 = "More from <company>"
export async function POST(req: NextRequest) {
  let body: { untrustedData?: { buttonIndex?: number; state?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const buttonIndex = body?.untrustedData?.buttonIndex ?? 1;
  const rawState = body?.untrustedData?.state ?? '';

  let company = '';
  let currentPostId = '';
  try {
    const state = JSON.parse(decodeURIComponent(rawState));
    company = state.company ?? '';
    currentPostId = state.post_id ?? '';
  } catch {
    // no state — serve any post
  }

  if (buttonIndex === 1 && company) {
    // Fetch another post from the same company
    const supabase = serviceSupabase();
    const { data } = await supabase
      .from('posts')
      .select('id, company_name, title, content')
      .ilike('company_name', company)
      .neq('id', currentPostId)
      .order('created_at', { ascending: false })
      .limit(10);

    const posts = data ?? [];
    const post = posts.length > 0
      ? posts[Math.floor(Math.random() * posts.length)]
      : null;

    if (post) {
      const imageUrl = `${BASE_URL}/api/frame/image?id=${post.id}`;
      const nextState = encodeURIComponent(JSON.stringify({ post_id: post.id, company: post.company_name }));

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/action" />
  <meta property="fc:frame:button:1" content="Pull the thread" />
  <meta property="fc:frame:button:1:action" content="post" />
  <meta property="fc:frame:button:2" content="Add your signal" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${BASE_URL}/dashboard" />
  <meta property="fc:frame:state" content="${nextState}" />
</head>
<body></body>
</html>`;
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  // Fallback: redirect to dashboard
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${BASE_URL}/api/frame/image" />
  <meta property="fc:frame:button:1" content="Open kataBased" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${BASE_URL}/dashboard" />
</head>
<body></body>
</html>`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
