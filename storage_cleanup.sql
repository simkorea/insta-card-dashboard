-- ============================================================================
-- 카드 이미지(card-images 버킷) 정리용 함수
-- ============================================================================
--
-- 왜: 2026-10 에 Supabase 무료 한도(저장공간 1GB)를 넘겨 서비스가 막혔다. 서버가 그린
--     카드 PNG 가 하루 수십 MB 씩 쌓이는데 지우는 코드가 없었다.
--
-- 이 함수들은 "무엇을 지울지 고르는 일"만 한다. 파일을 실제로 지우는 것은 앱이 Storage API 로
-- 한다 (SQL 로 storage.objects 를 지우면 파일이 남아 용량이 안 줄고, Supabase 가 막아 두었다).
--
-- 모두 서버(service role) 전용이다. anon / authenticated 에게는 실행 권한을 주지 않는다.

-- 어떤 행이든 안에 'card-images/<경로>' 주소가 들어 있으면 그 경로를 뽑는다.
-- (주소가 컬럼 어디에 있든 — slide_image_urls, images_data, pages_data … — 놓치지 않으려고 jsonb 전체를 본다)
create or replace function public.card_image_refs(include_published boolean default true)
returns table(name text)
language sql stable
as $$
  with src as (
    select to_jsonb(x)::text txt from public.scheduled_posts x
      where x.status = 'pending' or (include_published and x.status = 'published')
    union all select to_jsonb(x)::text from public.blog_posts x
    union all select to_jsonb(x)::text from public.card_designs x
    union all select to_jsonb(x)::text from public.user_templates x
  )
  select distinct (regexp_matches(txt, 'card-images/([^"\\\s)?,]+)', 'g'))[1] from src;
$$;

-- 어디에서도 가리키지 않는 파일 (실패·중복 렌더링, 지워진 디자인의 그림 …).
-- min_age_hours 보다 어린 파일은 건드리지 않는다 — 지금 막 그려서 아직 저장 중일 수 있다.
create or replace function public.orphan_card_images(min_age_hours int default 24)
returns table(name text, size_bytes bigint, created_at timestamptz)
language sql stable
as $$
  select o.name, (o.metadata->>'size')::bigint, o.created_at
  from storage.objects o
  where o.bucket_id = 'card-images'
    -- mcp-uploads/(사람이 올린 원본 사진)·uploads/·videos/ 는 다시 쓸 수 있어서 건드리지 않는다
    and (o.name like 'auto/%' or o.name like 'mcp-bg/%' or o.name like 'notebook/%')
    and o.created_at < now() - make_interval(hours => min_age_hours)
    and o.name not in (select r.name from public.card_image_refs(true) r)
$$;

-- 서버가 그린 카드 그림(auto/) 중 days 일이 지난 것.
-- 발행 대기(pending) 중인 예약이 가리키는 것은 뺀다 — 아직 올라가지 않았다.
-- design_id / design_name 은 파일 이름 앞부분(<디자인ID>_…)으로 찾아 ZIP 폴더 이름에 쓴다.
create or replace function public.expired_card_images(days int default 7)
returns table(name text, size_bytes bigint, created_at timestamptz, design_id uuid, design_name text)
language sql stable
as $$
  with pending as (
    select distinct (regexp_matches(to_jsonb(x)::text, 'card-images/([^"\\\s)?,]+)', 'g'))[1] as name
    from public.scheduled_posts x where x.status = 'pending'
  )
  select o.name, (o.metadata->>'size')::bigint, o.created_at, d.id, d.name
  from storage.objects o
  left join public.card_designs d
    on d.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
  where o.bucket_id = 'card-images'
    and o.name like 'auto/%'
    and o.created_at < now() - make_interval(days => days)
    and o.name not in (select p.name from pending p)
  order by o.created_at, o.name
$$;

-- 파일을 지운 뒤 DB 에 남은 죽은 주소를 치운다.
--  · 블로그 글의 그림 칸(images_data)은 url 을 '' 로 비운다 (화면이 "빈 칸"으로 처리한다)
--  · 예약 게시물은 thumbnail_url 을 null 로, slide_image_urls 에서 해당 주소를 뺀다
create or replace function public.scrub_card_image_refs(paths text[])
returns void
language plpgsql
as $$
begin
  if paths is null or array_length(paths, 1) is null then return; end if;

  -- strpos 로 정확히 비교한다 (LIKE 는 파일 이름의 '_' 를 아무 글자로 읽는다)
  update public.blog_posts b
     set images_data = (
       select coalesce(jsonb_agg(
         case when exists (select 1 from unnest(paths) p where strpos(coalesce(e->>'url', ''), 'card-images/' || p) > 0)
              then jsonb_set(e, '{url}', '""'::jsonb) else e end
         order by ord), '[]'::jsonb)
       from jsonb_array_elements(b.images_data) with ordinality as t(e, ord))
   where jsonb_typeof(b.images_data) = 'array'
     and exists (select 1 from unnest(paths) p where strpos(b.images_data::text, 'card-images/' || p) > 0);

  update public.scheduled_posts s
     set thumbnail_url = case when exists (select 1 from unnest(paths) p where strpos(coalesce(s.thumbnail_url, ''), 'card-images/' || p) > 0)
                              then null else s.thumbnail_url end,
         slide_image_urls = (
           select nullif(array_agg(u), '{}')
           from unnest(s.slide_image_urls) u
           where not exists (select 1 from unnest(paths) p where strpos(u, 'card-images/' || p) > 0))
   where s.status <> 'pending'
     and (exists (select 1 from unnest(paths) p where strpos(coalesce(s.thumbnail_url, ''), 'card-images/' || p) > 0)
          or exists (select 1 from unnest(coalesce(s.slide_image_urls, '{}')) u, unnest(paths) p where strpos(u, 'card-images/' || p) > 0));
end;
$$;

revoke all on function public.card_image_refs(boolean) from public, anon, authenticated;
revoke all on function public.orphan_card_images(int) from public, anon, authenticated;
revoke all on function public.expired_card_images(int) from public, anon, authenticated;
revoke all on function public.scrub_card_image_refs(text[]) from public, anon, authenticated;
grant execute on function public.card_image_refs(boolean) to service_role;
grant execute on function public.orphan_card_images(int) to service_role;
grant execute on function public.expired_card_images(int) to service_role;
grant execute on function public.scrub_card_image_refs(text[]) to service_role;
