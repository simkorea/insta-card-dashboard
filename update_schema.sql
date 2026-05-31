-- ============================================================
-- card_designs 테이블에 category 컬럼 추가 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- ============================================================

ALTER TABLE card_designs 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '미분류';

-- 기존 데이터가 있다면 '미분류'로 업데이트 (선택 사항)
-- UPDATE card_designs SET category = '미분류' WHERE category IS NULL;
