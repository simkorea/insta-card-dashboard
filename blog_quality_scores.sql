-- 블로그 원고 품질 채점 이력
--
-- blog_posts 에 컬럼을 붙이지 않고 별도 테이블로 둔 이유:
--   1) 한 원고를 고쳐 가며 여러 번 채점한다 (1:N)
--   2) 이 기능의 목적이 '발행 전' 점검이라, 채점 시점에 blog_posts 행이
--      아직 없을 수 있다 → blog_post_id 는 nullable, draft_key 로 묶는다
--
-- model / rubric_version 을 같이 남기는 이유:
-- 나중에 모델이나 채점 기준을 바꾸면 점수가 움직인다. 기록이 없으면
-- 원고가 좋아진 건지 기준이 바뀐 건지 구분할 수 없다.

CREATE TABLE IF NOT EXISTS blog_quality_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 저장된 글이면 연결, 저장 전 초안이면 NULL
  blog_post_id  uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  -- 저장 전에도 같은 원고의 채점들을 묶는 키 (화면에서 발급)
  draft_key     text NOT NULL,

  title         text,
  -- 같은 내용을 다시 채점하는 것을 건너뛰기 위한 해시
  content_hash  text,

  seo_score     integer NOT NULL,
  aeo_score     integer NOT NULL,
  geo_score     integer NOT NULL,
  total_score   integer NOT NULL,

  items         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 항목별 점수 + 근거
  priorities    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 먼저 고칠 순서

  target_keyword text,
  model          text NOT NULL,
  rubric_version text NOT NULL,

  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_quality_scores_draft_idx
  ON blog_quality_scores (draft_key, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_quality_scores_post_idx
  ON blog_quality_scores (blog_post_id, created_at DESC);

-- 기존 테이블들과 같은 방식(permissive)으로 맞춘다.
-- 라우트는 service role 로 접근하므로 정책과 무관하게 동작하지만,
-- RLS 를 켜 두지 않으면 다른 테이블과 설정이 어긋난다.
ALTER TABLE blog_quality_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_quality_scores_all" ON blog_quality_scores;
CREATE POLICY "blog_quality_scores_all" ON blog_quality_scores
  FOR ALL USING (true) WITH CHECK (true);
