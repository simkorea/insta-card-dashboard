-- ============================================================================
-- S3: scheduled_posts / instagram_settings 를 서버(service role) 전용으로 잠근다
-- ============================================================================
--
-- 왜: 두 테이블의 정책이 전부 roles=public, USING true 였다. anon 키는 브라우저에
--     공개되므로, 로그인하지 않은 누구든
--       - scheduled_posts 에 pending 행을 넣으면 10시 크론이 @aptshowhome 에 발행하고
--       - instagram_settings 에서 인스타 액세스 토큰을 읽을 수 있었다.
--     (정책 이름 "service_role_only" 는 실제로는 public 전체 허용이었다)
--     근거: docs/security-plan.md
--
-- ⚠️ 전제 — 반드시 이 순서:
--   1) S2(서버 코드를 service role 로 전환, 커밋 ebeb582)가 배포돼 있을 것
--   2) 그 뒤 10시 크론이 service role 로 정상 발행된 것을 확인했을 것
--      (automation_runs 의 publish ok, scheduled_posts published + published_at)
--   정책을 먼저 막으면 크론이 대기 행과 토큰을 못 읽어 발행이 조용히 멈춘다.
--
-- ⚠️ 이 파일을 통째로 실행하면 [1] 적용만 돈다.
--   [2] 확인과 [3] 되돌리기는 주석으로 막아 두었다 — 필요할 때 그 블록만 골라 실행할 것.
-- ============================================================================


-- [1] 적용 ------------------------------------------------------------------
begin;

drop policy if exists "Anyone can read"   on public.scheduled_posts;
drop policy if exists "Anyone can insert" on public.scheduled_posts;
drop policy if exists "Anyone can update" on public.scheduled_posts;
drop policy if exists "Anyone can delete" on public.scheduled_posts;
drop policy if exists "service_role_only" on public.instagram_settings;  -- 이름과 달리 public 전체 허용이었다

-- RLS 는 켜 둔다 (정책이 없으면 anon/authenticated 는 기본 거부)
alter table public.scheduled_posts    enable row level security;
alter table public.instagram_settings enable row level security;

-- 이중 잠금: 테이블 권한도 회수 (service_role 은 RLS 를 우회하며 영향 없음)
revoke all on public.scheduled_posts    from anon, authenticated;
revoke all on public.instagram_settings from anon, authenticated;

commit;


-- [2] 적용 직후 확인 (SELECT만) — 필요할 때 주석을 풀고 이 블록만 실행 -----------
--
-- -- anon 으로는 "permission denied" 가 나야 정상
-- begin;
-- set local role anon;
-- select count(*) from public.scheduled_posts;
-- rollback;
--
-- -- 정책이 남아 있지 않은지 (0행이어야 정상)
-- select tablename, policyname from pg_policies
-- where tablename in ('scheduled_posts', 'instagram_settings');


-- [3] 되돌리기 — 문제가 생기면 주석을 풀고 이 블록만 실행 -------------------------
-- 적용 전 상태(정책 5개 + anon/authenticated 전체 권한)를 그대로 복원한다.
--
-- begin;
--
-- grant all on public.scheduled_posts    to anon, authenticated;
-- grant all on public.instagram_settings to anon, authenticated;
--
-- create policy "Anyone can read"   on public.scheduled_posts for select using (true);
-- create policy "Anyone can insert" on public.scheduled_posts for insert with check (true);
-- create policy "Anyone can update" on public.scheduled_posts for update using (true);
-- create policy "Anyone can delete" on public.scheduled_posts for delete using (true);
-- create policy "service_role_only" on public.instagram_settings for all using (true);
--
-- commit;
