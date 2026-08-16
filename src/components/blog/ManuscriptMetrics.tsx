'use client';
import { measureDoc } from '@/lib/blog/qualityRubric';

// 이 원고의 수치.
//
// 품질 점검(채점)과 다른 자리다. 채점은 AI를 부르고 20초쯤 걸리는데,
// 여기 있는 값들은 세기만 하면 나오는 것이라 즉시 보여줄 수 있다.
// 본문을 고치면 바로 따라 움직이므로, 채점을 다시 돌리기 전에도
// 무엇이 늘고 줄었는지 눈으로 확인된다.
//
// 여기서는 판정하지 않는다 — '좋다/나쁘다'는 점검 패널의 몫이다.
// 다만 0개인 것과 너무 긴 문장만 눈에 띄게 둔다. 그건 해석이 아니라
// 사실이고, 보자마자 손볼 수 있는 것들이다.

type Props = {
  title: string;
  body: string;
  tags: string[];
  images: { url?: string; label?: string }[];
};

export default function ManuscriptMetrics({ title, body, tags, images }: Props) {
  const m = measureDoc({ title, body, tags, images, targetKeyword: '' });

  const stats: { label: string; value: string; warn?: boolean; hint: string }[] = [
    { label: '본문', value: `${m.charCount.toLocaleString()}자`, hint: '공백 제외' },
    { label: '제목', value: `${m.titleLen}자`, hint: '검색 결과에 잘리지 않는 길이는 20~35자' },
    { label: '소제목', value: `${m.headingCount}개`, warn: m.headingCount === 0, hint: '문단을 나누는 짧은 줄' },
    { label: '수치', value: `${m.numericCount}개`, warn: m.numericCount === 0, hint: '단위가 붙은 숫자 — 인용될 때 근거가 된다' },
    { label: '목록', value: `${m.bulletCount}개`, warn: m.bulletCount === 0, hint: '- 나 1. 로 시작하는 줄' },
    { label: '질문형', value: `${m.questionCount}개`, warn: m.questionCount === 0, hint: '질문 형태의 소제목·문장' },
    { label: '이미지', value: `${m.imageCount}장`, warn: m.imageCount === 0, hint: `설명이 붙은 이미지 ${m.imageLabeled}장` },
    { label: '긴 문장', value: `${m.longSentences}개`, warn: m.longSentences > 0, hint: '120자를 넘는 문장' },
    { label: '태그', value: `${m.tagCount}개`, warn: m.tagCount === 0, hint: '본문 끝에 해시태그로 붙는다' },
  ];

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 mr-1 shrink-0">이 글의 수치</span>
        {stats.map(s => (
          <span
            key={s.label}
            title={s.hint}
            className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-lg border text-[11px] ${
              s.warn
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            <span className="text-gray-400 text-[10px]">{s.label}</span>
            <span className="font-bold tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
