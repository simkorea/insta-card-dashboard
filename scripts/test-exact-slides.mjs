// save_cardnews_exact 확장(띠지·숫자표·배지·출처·도장·paper 스타일) 테스트.
// 외부 호출(AI·DB·네트워크)을 하지 않는다. Node 내장 node:test 만 쓴다(설치 없음).
//
// 실행:  node --test scripts/test-exact-slides.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exactSlideSchema,
  buildExactBlocks,
  checkExactSlides,
  kstNoteNumber,
  resolveStamp,
} from '../src/lib/mcp/exactSlides.ts';

const base = { headline: '분양 상담 준비', body: '서류를 미리 챙기면 상담이 빨라집니다.' };
const parse = (o) => exactSlideSchema.safeParse({ ...base, ...o });
const issue = (r) => r.error?.issues?.[0];

// ── 1. 예전 입력은 예전과 똑같이 ─────────────────────────────────────────────
test('선택 칸이 없으면 예전과 똑같은 블록(headline·sub·checklist)', () => {
  // 예전 route.ts 가 만들던 모양을 그대로 적어 둔 기준
  const legacy = (s) => [
    { type: 'headline', text: s.headline },
    { type: 'sub', text: s.body },
    ...(s.points?.length ? [{ type: 'checklist', items: s.points }] : []),
  ];
  const a = { ...base };
  const b = { ...base, points: ['신분증', '재직증명서'] };
  assert.deepEqual(buildExactBlocks(a), legacy(a));
  assert.deepEqual(buildExactBlocks(b), legacy(b));
  // 빈 배열은 블록을 만들지 않는다
  assert.deepEqual(buildExactBlocks({ ...base, points: [], stats: [], badges: [] }), legacy(a));
});

test('도장 칸이 없으면 예전과 똑같이 note/impact 모두 같은 결과', () => {
  assert.deepEqual(resolveStamp('note', 0, 5, undefined), {});
  assert.deepEqual(resolveStamp('note', 2, 5, {}), {});
  assert.deepEqual(resolveStamp('paper', 2, 5, {}), {});
  assert.deepEqual(resolveStamp('impact', 1, 5, undefined), { noteNumber: '2 / 5' }); // 예전 impact
});

// ── 2. 새 칸이 그대로 블록이 된다 ────────────────────────────────────────────
test('eyebrow·stats·badges·source 가 글자 그대로 블록이 된다(순서 포함)', () => {
  const s = {
    ...base,
    eyebrow: '① 혜택',
    stats: [
      { value: '84㎡', label: '전용면적' },
      { value: '5.2억', label: '분양가' },
    ],
    badges: ['선착순', '계약금 5%'],
    source: '출처: 국토교통부 실거래가',
  };
  const blocks = buildExactBlocks(s);
  assert.deepEqual(blocks.map((b) => b.type), ['eyebrow', 'headline', 'sub', 'statGrid', 'badgeRow', 'sourceNote']);
  assert.deepEqual(blocks[0], { type: 'eyebrow', text: '① 혜택' });
  assert.deepEqual(blocks[3], {
    type: 'statGrid',
    cols: 2,
    items: [{ value: '84㎡', label: '전용면적' }, { value: '5.2억', label: '분양가' }],
  });
  assert.deepEqual(blocks[4], { type: 'badgeRow', badges: [{ text: '선착순' }, { text: '계약금 5%' }] });
  assert.deepEqual(blocks[5], { type: 'sourceNote', text: '출처: 국토교통부 실거래가' });
});

test('글자를 바꾸지 않는다: 공백·기호·줄 끝 공백도 그대로', () => {
  const s = { headline: ' 앞뒤 공백 ', body: '  본문  ', eyebrow: ' ① 혜택 ', source: ' 출처: A·B ', points: [' 항목 '] };
  const texts = JSON.stringify(buildExactBlocks(s));
  for (const t of [' 앞뒤 공백 ', '  본문  ', ' ① 혜택 ', ' 출처: A·B ', ' 항목 ']) assert.ok(texts.includes(t), JSON.stringify(t));
});

test('stats 1개는 cols 를 정하지 않고, 3개는 cols 3', () => {
  const one = buildExactBlocks({ ...base, stats: [{ value: '84㎡', label: '면적' }] }).find((b) => b.type === 'statGrid');
  assert.equal('cols' in one, false);
  const three = buildExactBlocks({
    ...base,
    stats: [1, 2, 3].map((n) => ({ value: `${n}`, label: `L${n}` })),
  }).find((b) => b.type === 'statGrid');
  assert.equal(three.cols, 3);
});

// ── 3. 길이 제한(정확한 경계) ────────────────────────────────────────────────
test('길이 제한: 경계값은 통과, 1자 넘으면 거절', () => {
  const ok = (o) => assert.equal(parse(o).success, true, JSON.stringify(o).slice(0, 80));
  const no = (o, path) => {
    const r = parse(o);
    assert.equal(r.success, false, JSON.stringify(o).slice(0, 80));
    assert.equal(issue(r).path[0], path);
  };
  ok({ eyebrow: '가'.repeat(12) });
  no({ eyebrow: '가'.repeat(13) }, 'eyebrow');
  no({ eyebrow: '' }, 'eyebrow');
  ok({ source: '가'.repeat(40) });
  no({ source: '가'.repeat(41) }, 'source');
  ok({ badges: ['가'.repeat(8), 'b', 'c'] });
  no({ badges: ['가'.repeat(9)] }, 'badges');
  no({ badges: ['a', 'b', 'c', 'd'] }, 'badges');
  ok({ stats: [{ value: '가'.repeat(10), label: '나'.repeat(12) }] });
  no({ stats: [{ value: '가'.repeat(11), label: 'x' }] }, 'stats');
  no({ stats: [{ value: 'x', label: '나'.repeat(13) }] }, 'stats');
  no({ stats: [1, 2, 3, 4].map((n) => ({ value: `${n}`, label: 'L' })) }, 'stats');
  // 예전 칸의 제한도 그대로
  no({ headline: '가'.repeat(19) }, 'headline');
  no({ body: '가'.repeat(121) }, 'body');
  no({ points: ['가'.repeat(21)] }, 'points');
  no({ points: ['a', 'b', 'c', 'd', 'e'] }, 'points');
});

// ── 4. 같이 쓸 수 없는 조합 ──────────────────────────────────────────────────
test('points 와 badges 를 같이 주면 거절(글자가 조용히 사라지지 않게)', () => {
  const slides = [base, { ...base, points: ['a'], badges: ['b'] }, base];
  const reason = checkExactSlides(slides);
  assert.match(reason, /slides\[1\]/);
  assert.match(reason, /points 와 badges/);
  assert.equal(checkExactSlides([base, { ...base, badges: ['b'] }, { ...base, points: ['a'] }]), null);
  assert.equal(checkExactSlides([base, { ...base, points: ['a'], badges: [] }]), null); // 빈 배열은 없는 것
});

// ── 5. 도장 ──────────────────────────────────────────────────────────────────
test('kstNoteNumber: 한국 시간 No.MMDD', () => {
  assert.equal(kstNoteNumber(Date.parse('2026-10-11T14:59:59Z')), 'No.1011');
  assert.equal(kstNoteNumber(Date.parse('2026-10-11T15:00:00Z')), 'No.1012'); // KST 자정 넘김
  assert.equal(kstNoteNumber(Date.parse('2026-01-09T00:00:00Z')), 'No.0109'); // 0 채움
  assert.equal(kstNoteNumber(Date.parse('2026-12-31T15:00:00Z')), 'No.0101'); // 연말 넘김
});

test('resolveStamp: note·paper 는 라벨을 주면 도장, 번호는 없으면 자동', () => {
  const now = Date.parse('2026-10-11T03:00:00Z');
  assert.deepEqual(resolveStamp('note', 0, 5, { noteLabel: '분양노트' }, now), { noteLabel: '분양노트', noteNumber: 'No.1011' });
  assert.deepEqual(resolveStamp('paper', 3, 5, { noteLabel: '분양노트', noteNumber: 'No.7' }, now), { noteLabel: '분양노트', noteNumber: 'No.7' });
  // 번호만 주면 번호만 (라벨 칸은 만들지 않는다)
  assert.deepEqual(resolveStamp('note', 0, 5, { noteNumber: 'No.7' }, now), { noteNumber: 'No.7' });
});

test('resolveStamp: impact 는 noteNumber 를 쪽번호로 쓰고 noteLabel 만 받는다', () => {
  assert.deepEqual(resolveStamp('impact', 0, 4, { noteLabel: '분양노트', noteNumber: 'No.7' }), { noteLabel: '분양노트', noteNumber: '1 / 4' });
});
