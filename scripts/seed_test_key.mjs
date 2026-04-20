// Inserts a smoke-test API key into Supabase via the JS client (supports sb_secret format).
// Usage: node scripts/seed_test_key.mjs
// Prints: RAW_KEY=<key>
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const rawKey  = `kb_smoke_${randomBytes(16).toString('hex')}`;
const keyHash = createHash('sha256').update(rawKey).digest('hex');

const { error } = await supabase.from('api_keys').insert([{
  key_hash: keyHash,
  tier: 'agent',
  source: 'smoke_test',
}]);

if (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
}

process.stdout.write(`RAW_KEY=${rawKey}\nKEY_HASH=${keyHash}\n`);
