-- ============================================================================
-- instagram_inbox / dm_automation_rules 를 서버(service role) 전용으로 잠근다
-- ============================================================================
--
-- 왜: 두 테이블의 정책이 전부 roles=public, USING true 였다. anon 키는 브라우저에
--     공개되므로, 로그인하지 않은 누구든
--       - instagram_inbox 에서 실제 사람들의 DM·댓글 원문과 보낸 사람을 읽고
--       - dm_automation_rules 를 바꿔 계정이 엉뚱한 자동 DM 을 보내게 할 수 있었다.
--     근거: docs/security-next.md (1순위)
--
-- 코드 변경은 필요 없다. 두 테이블을 쓰는 곳 7개(webhook, inbox, comments/reply,
-- dm/send, dm-automation-rules, [id], lib/dmAutomation/runRules)가 전부 이미
-- SUPABASE_SERVICE_ROLE_KEY 를 쓴다. 브라우저에서 직접 읽는 곳은 없다.
--
-- ⚠️ 이 파일을 통째로 실행하면 [1] 적용만 돈다.
--   [2] 확인과 [3] 되돌리기는 주석으로 막아 두었다 — 필요할 때 그 블록만 골라 실행할 것.
-- ============================================================================


-- [1] 적용 ------------------------------------------------------------------
begin;

drop policy if exists "Anyone can insert instagram_inbox" on public.instagram_inbox;
drop policy if exists "Anyone can read instagram_inbox"   on public.instagram_inbox;
drop policy if exists "Anyone can update instagram_inbox" on public.instagram_inbox;
drop policy if exists "Allow all on dm_automation_rules"  on public.dm_automation_rules;

-- RLS 는 켜 둔다 (정책이 없으면 anon/authenticated 는 기본 거부)
alter table public.instagram_inbox     enable row level security;
alter table public.dm_automation_rules enable row level security;

-- 이중 잠금: 테이블 권한도 회수 (service_role 은 RLS 를 우회하며 영향 없음)
revoke all on public.instagram_inbox     from anon, authenticated;
revoke all on public.dm_automation_rules from anon, authenticated;

commit;


-- [2] 적용 직후 확인 (SELECT만) — 필요할 때 주석을 풀고 이 블록만 실행 -----------
--
-- -- 정책이 남아 있지 않은지 (0행이어야 정상)
-- select tablename, policyname from pg_policies
-- where tablename in ('instagram_inbox', 'dm_automation_rules');
--
-- -- anon/authenticated 는 false, service_role 은 true 여야 정상
-- select r, t, has_table_privilege(r, 'public.'||t, 'SELECT') as can_select
-- from unnest(array['anon','authenticated','service_role']) r,
--      unnest(array['instagram_inbox','dm_automation_rules']) t;


-- [3] 되돌리기 — 문제가 생기면 주석을 풀고 이 블록만 실행 -------------------------
-- 적용 전 상태(정책 4개 + anon/authenticated 전체 권한)를 그대로 복원한다.
--
-- begin;
--
-- grant all on public.instagram_inbox     to anon, authenticated;
-- grant all on public.dm_automation_rules to anon, authenticated;
--
-- create policy "Anyone can insert instagram_inbox" on public.instagram_inbox for insert with check (true);
-- create policy "Anyone can read instagram_inbox"   on public.instagram_inbox for select using (true);
-- create policy "Anyone can update instagram_inbox" on public.instagram_inbox for update using (true);
-- create policy "Allow all on dm_automation_rules"  on public.dm_automation_rules for all using (true) with check (true);
--
-- commit;
