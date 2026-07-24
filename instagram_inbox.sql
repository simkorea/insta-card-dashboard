-- ============================================================
-- instagram_inbox 테이블 생성 SQL
-- 인스타그램 댓글/DM 웹훅 수신 + AI 초안 + 사람 승인 후 전송 흐름
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS instagram_inbox (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source            TEXT        NOT NULL,              -- 'comment' | 'dm'
  ig_object_id      TEXT        NOT NULL,               -- 댓글 id 또는 메시지 id
  thread_or_media_id TEXT,                               -- 댓글이 달린 media id 또는 DM 대화(thread) id
  from_ig_id        TEXT,
  from_username     TEXT,
  text              TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending', -- pending | drafted | approved | sent | ignored
  ai_drafts         JSONB,                                -- [{ text, style }]
  chosen_reply      TEXT,
  sent_reply_id     TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 같은 댓글/메시지에 대한 웹훅 중복 수신 방지
CREATE UNIQUE INDEX IF NOT EXISTS instagram_inbox_ig_object_id_key ON instagram_inbox (ig_object_id);
CREATE INDEX IF NOT EXISTS instagram_inbox_status_idx ON instagram_inbox (status);

-- Row Level Security 활성화
ALTER TABLE instagram_inbox ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 조회 가능 (서버 라우트는 SERVICE_ROLE_KEY로 RLS 우회, 이 정책은 기존 테이블들과 스타일 일관성 용도)
DO $$ BEGIN
  CREATE POLICY "Anyone can read instagram_inbox"
    ON instagram_inbox FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert instagram_inbox"
    ON instagram_inbox FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can update instagram_inbox"
    ON instagram_inbox FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
