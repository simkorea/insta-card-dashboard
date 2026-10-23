-- 현장 근거 자료. 로컬 옵시디언 볼트의 "승인 소재집"을 scripts/sync-sites.mjs 가 올려둔다.
-- 서버(service role)만 읽는다 — RLS 켜고 정책을 만들지 않는다.
create table if not exists public.site_facts (
  slug        text primary key,
  name        text not null,
  facts       jsonb not null default '{}'::jsonb,  -- 소재집 맨 위 요약(지역·시공사·분양가…)
  body_md     text not null default '',            -- 소재집 본문(대표 승인 세일즈 포인트 등)
  source_path text,
  source_hash text,
  synced_at   timestamptz not null default now()
);
alter table public.site_facts enable row level security;
