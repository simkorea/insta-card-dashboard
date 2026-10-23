// 옵시디언 볼트의 "승인 소재집"(대표가 승인한 6~7개 현장)을 Supabase site_facts 로 올린다. 볼트는 읽기만 한다.
// 사용: node --env-file=.env.local --env-file=.env.development.local scripts/sync-sites.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { createClient } from '@supabase/supabase-js';

const DIR = process.env.VAULT_APPROVED_DIR
  || 'D:/다운로드/ai등 공부 자료 및 잡동/00_중앙비서실/3_Resources (★비서가읽을승인소재)';
const dry = process.argv.includes('--dry');

const rows = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('_승인소재집.md')) continue; // _TEMPLATE·인벤토리 제외
  const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) { console.warn('머리말 없음, 건너뜀:', f); continue; }
  const facts = yaml.load(m[1]) || {};
  rows.push({
    slug: f.replace('_승인소재집.md', ''),
    name: String(facts['현장명'] || f),
    facts,
    body_md: m[2].trim(),
    source_path: f,
    source_hash: crypto.createHash('sha1').update(raw).digest('hex'),
    synced_at: new Date().toISOString(),
  });
}
console.log(rows.map(r => `${r.slug} (${r.body_md.length}자)`).join('\n'));
if (dry) process.exit(0);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await sb.from('site_facts').upsert(rows, { onConflict: 'slug' });
if (error) { console.error(error.message); process.exit(1); }
console.log(`올림: ${rows.length}개`);
