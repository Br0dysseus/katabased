import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shhodgzbgwzbatqgncab.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postId = searchParams.get('id');

  let company = 'kataBased';
  let title = 'Anonymous Web3 Workplace Reviews';
  let content = 'Real accounts from insiders across crypto and DeFi.';

  if (postId) {
    const supabase = serviceSupabase();
    const { data } = await supabase
      .from('posts')
      .select('company_name, title, content, category')
      .eq('id', postId)
      .single();

    if (data) {
      company = data.company_name;
      title = data.title;
      content = data.content;
    }
  }

  // Extract first sentence as pull quote — more punchy than truncating full content
  const firstSentence = content.split(/[.!?]/)[0]?.trim() ?? content;
  const pull = truncate(firstSentence.length > 40 ? firstSentence : content, 160);
  const attribution = 'Anonymous insider · kataBased';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#04050C',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          fontFamily: 'monospace',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6B9FD4', fontSize: '14px', letterSpacing: '4px', textTransform: 'uppercase' }}>
            kataBased
          </span>
          <span
            style={{
              color: '#04050C',
              background: '#D4845A',
              fontSize: '11px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '4px 10px',
            }}
          >
            {company}
          </span>
        </div>

        {/* Title */}
        <div style={{ color: '#E8E8E8', fontSize: '28px', lineHeight: '1.3', maxWidth: '900px' }}>
          "{truncate(title, 80)}"
        </div>

        {/* Pull quote */}
        <div style={{ color: '#9B9BB4', fontSize: '18px', lineHeight: '1.6', maxWidth: '900px', fontStyle: 'italic' }}>
          {pull}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ color: '#6B9FD4', fontSize: '13px', letterSpacing: '1px' }}>
            {attribution}
          </span>
          <span style={{ color: '#3A3A5C', fontSize: '13px' }}>
            katabased.io
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
