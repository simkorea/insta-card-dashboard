-- 카드뉴스 목록용 가벼운 보기. 목록 화면이 본문(pages_data, 최대 수 MB)을 통째로 읽다가 느려지고
-- 시간 제한에 걸리는 문제를 막는다. 표지 한 장(pages_data 의 첫 장)과 장수(pages_count)만 돌려준다.
-- 본문 전체는 /api/designs/[id] 로 필요할 때 한 건씩 읽는다.
-- 이 파일은 Supabase SQL 편집기에서 한 번 실행한다. 실행 전에도 앱은 예전 방식으로 동작한다.
create or replace view public.card_designs_list
with (security_invoker = true) as
select
  id, name, description, created_at, share_token, is_public, category, audio_url,
  jsonb_array_length(pages_data) as pages_count,
  jsonb_build_array(pages_data -> 0) as pages_data
from public.card_designs;

grant select on public.card_designs_list to anon, authenticated, service_role;
