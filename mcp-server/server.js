#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = 'https://katabased.io';

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_market_sentiment',
    description:
      'Get current crypto market sentiment, Hyperliquid factor scores, and top Polymarket predictions from kataBased',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_reviews',
    description:
      'Search company reviews on kataBased Web3 workplace review platform',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Company name or keyword to search reviews for',
        },
        limit: {
          type: 'number',
          description: 'Max number of results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'submit_review',
    description:
      'Submit an anonymous workplace review to kataBased. Requires a valid API key.',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Company name (max 100 chars)',
        },
        title: {
          type: 'string',
          description: 'Review title / headline (max 120 chars)',
        },
        review_text: {
          type: 'string',
          description: 'Full review content (max 2000 chars)',
        },
        category: {
          type: 'string',
          description:
            'Optional category: e.g. "culture", "compensation", "remote", "management"',
        },
        api_key: {
          type: 'string',
          description:
            'X-KB-Key API key. Obtain one at katabased.io.',
        },
      },
      required: ['company', 'title', 'review_text', 'api_key'],
    },
  },
  {
    name: 'get_api_info',
    description:
      'Get information about the kataBased API, authentication, available endpoints, and rate limits',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleGetMarketSentiment() {
  const res = await fetch(`${BASE_URL}/api/mega-index`, {
    headers: { 'User-Agent': 'katabased-mcp/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `mega-index fetch failed: HTTP ${res.status}`,
        },
      ],
      isError: true,
    };
  }

  const data = await res.json();

  const lines = [
    `=== kataBased Market Sentiment ===`,
    `Updated: ${data.updated_at ?? 'unknown'}`,
    `Regime: ${data.regime ?? 'unknown'}`,
    `Dominant sentiment: ${data.dominant_sentiment ?? 'neutral'}`,
    '',
  ];

  if (data.narratives?.length) {
    lines.push('Narratives:');
    for (const n of data.narratives) lines.push(`  - ${n}`);
    lines.push('');
  }

  if (data.session_notes) {
    lines.push(`Session notes: ${data.session_notes}`, '');
  }

  if (data.top_long?.length) {
    lines.push(`Top LONG signals: ${data.top_long.join(', ')}`);
  }
  if (data.top_short?.length) {
    lines.push(`Top SHORT signals: ${data.top_short.join(', ')}`);
  }
  lines.push('');

  if (data.entities?.length) {
    lines.push('Top HL Factor Scores (by |score|):');
    const top = data.entities.slice(0, 10);
    for (const e of top) {
      lines.push(
        `  ${e.coin.padEnd(8)} score=${String(e.factor_score).padStart(7)}  signal=${e.signal}  confidence=${e.confidence}  sentiment=${e.sentiment}`
      );
    }
    lines.push('');
  }

  if (data.polymarket?.length) {
    lines.push('Top Polymarket Predictions:');
    for (const p of data.polymarket) {
      lines.push(`  [${p.yes_prob}% YES] ${p.question}  (vol $${p.volume.toLocaleString()})`);
    }
    lines.push('');
  }

  if (data.news?.length) {
    lines.push('Latest Crypto News:');
    for (const n of data.news) {
      lines.push(`  [${n.source}] ${n.title}`);
      lines.push(`    ${n.url}`);
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}

async function handleSearchReviews(args) {
  const query = (args.query ?? '').trim();
  const limit = args.limit ?? 10;

  // Try the posts endpoint; it may not be live yet
  try {
    const url = `${BASE_URL}/api/posts?search=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'katabased-mcp/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      return {
        content: [
          {
            type: 'text',
            text: [
              `kataBased review search for "${query}":`,
              '',
              'The /api/posts search endpoint is not yet live — kataBased is currently in early access.',
              '',
              'To browse existing reviews or submit your own, visit: https://katabased.io',
              'To submit a review via API, use the submit_review tool with a valid X-KB-Key.',
              'To request early API access, reach out at katabased.io.',
            ].join('\n'),
          },
        ],
      };
    }

    if (!res.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `search_reviews failed: HTTP ${res.status}`,
          },
        ],
        isError: true,
      };
    }

    const data = await res.json();
    const posts = Array.isArray(data) ? data : (data.posts ?? data.results ?? []);

    if (!posts.length) {
      return {
        content: [
          {
            type: 'text',
            text: `No reviews found for "${query}" on kataBased.`,
          },
        ],
      };
    }

    const lines = [`kataBased reviews matching "${query}" (${posts.length} result${posts.length > 1 ? 's' : ''}):`, ''];
    for (const p of posts) {
      lines.push(`Company: ${p.company ?? 'Unknown'}`);
      if (p.title) lines.push(`Title: ${p.title}`);
      if (p.category) lines.push(`Category: ${p.category}`);
      if (p.content) lines.push(`Review: ${p.content}`);
      if (p.created_at) lines.push(`Date: ${p.created_at}`);
      lines.push('---');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: [
            `kataBased review search for "${query}":`,
            '',
            'Posts endpoint not reachable at this time.',
            'Visit https://katabased.io to browse reviews directly.',
          ].join('\n'),
        },
      ],
    };
  }
}

async function handleSubmitReview(args) {
  const { company, title, review_text, category, api_key } = args;

  if (!company || !title || !review_text || !api_key) {
    return {
      content: [
        {
          type: 'text',
          text: 'submit_review: company, title, review_text, and api_key are all required.',
        },
      ],
      isError: true,
    };
  }

  const body = { company, title, content: review_text };
  if (category) body.category = category;

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/agent/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KB-Key': api_key,
        'User-Agent': 'katabased-mcp/1.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `submit_review: network error — ${err.message}` },
      ],
      isError: true,
    };
  }

  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    return {
      content: [
        {
          type: 'text',
          text: `submit_review: invalid or missing API key. Get one at katabased.io.\nServer: ${json.error ?? ''}`,
        },
      ],
      isError: true,
    };
  }

  if (res.status === 429) {
    return {
      content: [
        {
          type: 'text',
          text: `submit_review: rate limit reached (${json.limit ?? 10} posts/day per key). Try again tomorrow.`,
        },
      ],
      isError: true,
    };
  }

  if (!res.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `submit_review failed: HTTP ${res.status} — ${json.error ?? JSON.stringify(json)}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: [
          'Review submitted successfully to kataBased.',
          `Post ID: ${json.post_id ?? 'unknown'}`,
          `Company: ${company}`,
          `Title: ${title}`,
          category ? `Category: ${category}` : null,
          '',
          'Review is now live at https://katabased.io',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  };
}

function handleGetApiInfo() {
  const info = [
    '=== kataBased API ===',
    'Platform: Anonymous Web3 workplace review platform',
    'Site: https://katabased.io',
    '',
    '── Endpoints ──',
    'GET  /api/mega-index          Crypto market sentiment + HL factor scores + Polymarket',
    'POST /api/agent/post          Submit a review (requires X-KB-Key header)',
    'GET  /api/votes               Vote tallies',
    'POST /api/keys/generate       Generate an API key (coming soon / restricted)',
    '',
    '── Authentication ──',
    'Header: X-KB-Key: <your-api-key>',
    'Keys are per-project. Request access at katabased.io.',
    '',
    '── Rate Limits ──',
    'POST /api/agent/post: 10 posts per day per API key',
    'GET  /api/mega-index: public, no key required, cached 2 min',
    '',
    '── Review Fields ──',
    'company    (string, required)  max 100 chars',
    'title      (string, required)  max 120 chars',
    'content    (string, required)  max 2000 chars',
    'category   (string, optional)  e.g. culture / compensation / remote / management',
    '',
    '── MCP Tools ──',
    'get_market_sentiment   Fetch live crypto sentiment + HL signals + Polymarket',
    'search_reviews         Search kataBased reviews by company or keyword',
    'submit_review          Submit anonymous workplace review (requires API key)',
    'get_api_info           This info',
    '',
    '── About ──',
    'kataBased (κατάβασις — the descent) surfaces honest, anonymous insights',
    'from builders inside Web3 companies. Built on Next.js 15, Supabase, RainbowKit.',
  ];

  return {
    content: [{ type: 'text', text: info.join('\n') }],
  };
}

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'katabased', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_market_sentiment':
      return handleGetMarketSentiment();
    case 'search_reviews':
      return handleSearchReviews(args ?? {});
    case 'submit_review':
      return handleSubmitReview(args ?? {});
    case 'get_api_info':
      return handleGetApiInfo();
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ── Transport ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
