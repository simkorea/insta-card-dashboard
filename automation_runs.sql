-- 자동 작업이 왜 실패했는지 남긴다.
--
-- 왜 필요한가: 2026-09-05 에 카드뉴스 초안이 안 만들어졌는데, 이유를 끝내
-- 확인하지 못했다. Vercel Hobby 는 런타임 로그를 1시간만 보관하고 이 앱에는
-- 실행 기록이 어디에도 남지 않는다. 결과물(브리핑·초안·발행·글)이 있는지로
-- 되짚을 수는 있지만 "왜 없는지"는 알 수 없다.
--
-- 한 줄이면 충분하다. 언제, 어느 단계가, 됐는지 안 됐는지, 안 됐으면 왜.

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL,              -- 한국 날짜 기준
  step TEXT NOT NULL,                  -- briefing | cardnews | blog | publish
  ok BOOLEAN NOT NULL,
  reason TEXT,                         -- 실패/건너뜀 사유. 성공이면 비어 있어도 된다
  ms INTEGER,                          -- 그 단계에 걸린 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_runs_date_idx ON automation_runs (run_date DESC, created_at DESC);

-- 기존 테이블들과 같은 방식(permissive)으로 맞춘다.
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_runs all" ON automation_runs;
CREATE POLICY "automation_runs all" ON automation_runs
  FOR ALL USING (true) WITH CHECK (true);
