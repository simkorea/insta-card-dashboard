-- ============================================================
-- card_designs 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS card_designs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  pages_data  JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security 활성화
ALTER TABLE card_designs ENABLE ROW LEVEL SECURITY;

-- 정책: 누구나 조회 가능
DO $$ BEGIN
  CREATE POLICY "Anyone can read card_designs"
    ON card_designs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 정책: 누구나 저장 가능
DO $$ BEGIN
  CREATE POLICY "Anyone can insert card_designs"
    ON card_designs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 정책: 누구나 삭제 가능
DO $$ BEGIN
  CREATE POLICY "Anyone can delete card_designs"
    ON card_designs FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
