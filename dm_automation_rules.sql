-- 키워드 댓글 → 자동 DM 규칙
CREATE TABLE IF NOT EXISTS dm_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  dm_message TEXT NOT NULL,
  comment_reply TEXT,
  is_active BOOLEAN DEFAULT false,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dm_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on dm_automation_rules" ON dm_automation_rules
  FOR ALL USING (true) WITH CHECK (true);
