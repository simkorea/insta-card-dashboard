-- 레퍼런스 리서치 (경쟁사 광고 검색 + 직접 업로드) 저장 테이블
CREATE TABLE IF NOT EXISTS reference_ads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('search', 'upload')),
  keyword TEXT,
  advertiser_name TEXT,
  ad_text TEXT,
  media_url TEXT,
  landing_domain TEXT,
  library_id TEXT,
  started_at TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reference_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on reference_ads" ON reference_ads
  FOR ALL USING (true) WITH CHECK (true);
