import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { generateTimeMachineImage, type CardStyle } from '@/lib/notebookImage/generate';
import { uploadNotebookImage } from '@/lib/notebookImage/upload';

// 타임머신 표 → 카드뉴스 한 장.
// 표는 이미지 모델에게 가장 어려운 과제라 실패하면 CSS 렌더러로 떨어진다
// (blocks를 항상 함께 저장하는 이유).
export const maxDuration = 300;

type Cell = { label: string; found: boolean; priceText?: string; dealDateText?: string };
type Row = { name: string; pyeong?: number; cells: Cell[]; changePct?: number };

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { rows, title, noteNumber, ratio, cardStyle } = await request.json() as {
      rows: Row[]; title?: string; noteNumber?: string; ratio?: string; cardStyle?: CardStyle | 'hybrid';
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '타임머신 결과가 없습니다. 먼저 조회해주세요.' }, { status: 400 });
    }

    // 하이브리드는 표를 브라우저가 조판한다 — 표는 이미지 모델이 가장 자주 틀리는 것이라
    // 오히려 이쪽이 정확하다.
    const isHybrid = cardStyle === 'hybrid';
    const style: CardStyle = cardStyle === 'newspaper' ? 'newspaper' : 'notebook';
    const cols = rows.slice(0, 3);
    const cardTitle = (title || '아파트 타임머신').trim();
    const note = noteNumber || 'No.001';

    // 시점 줄 — 칸마다 "금액 / 거래일". 거래가 없던 시점은 그대로 '거래 없음'.
    const labels = cols[0].cells.map(c => c.label);
    const tableRows = labels.map((label, i) => ({
      label,
      values: cols.map(r => {
        const c = r.cells[i];
        if (!c?.found) return '거래 없음';
        return `${c.priceText}${c.dealDateText ? ` / ${c.dealDateText}` : ''}`;
      }),
    }));

    const changeRow = {
      label: '변동',
      values: cols.map(r =>
        r.changePct == null ? '비교 불가' : `${r.changePct >= 0 ? '▲' : '▼'} ${Math.abs(r.changePct)}%`
      ),
    };

    // 그림이 실패해도 카드가 남도록 blocks를 먼저 만들어 둔다
    const blocks: SlideBlock[] = [
      { type: 'eyebrow', text: '실거래가 기준' },
      { type: 'headline', text: cardTitle },
      {
        type: 'compareTable',
        rows: tableRows.map(r => ({
          label: r.label,
          value: r.values.join('  |  '),
          highlight: r.label === '현재',
        })),
      },
      { type: 'sub', text: cols.map((r, i) => `${i + 1}. ${r.name}${r.pyeong ? ` 전용 ${r.pyeong}평` : ''}`).join(' / ') },
      { type: 'sourceNote', text: '출처: 국토교통부 실거래가 · 거래가 없던 시점은 비워둠' },
    ];

    const img = isHybrid ? null : await generateTimeMachineImage({
      title: cardTitle,
      areaLabel: '실거래가 기준',
      columns: cols.map(r => ({ name: r.name, sub: r.pyeong ? `전용 ${r.pyeong}평` : undefined })),
      rows: tableRows,
      changeRow,
      source: '출처: 국토교통부 실거래가',
      noteLabel: '타임머신',
      noteNumber: note,
      ratio: ratio || '4:5',
    }, { style });

    let bgImage = '';
    let needsReview = false;
    let reviewNote: string | undefined;

    if (isHybrid) {
      // 그릴 것이 없다 — blocks만으로 완성된 카드다
    } else if (!img) {
      needsReview = true;
      reviewNote = '표 그림 생성에 실패해 기본 스타일로 만들었습니다';
    } else {
      bgImage = (await uploadNotebookImage(img.base64, 1, 'timemachine')) || '';
      if (!bgImage) {
        needsReview = true;
        reviewNote = '이미지 저장에 실패해 기본 스타일로 만들었습니다';
      } else if (!img.verified) {
        // 표는 숫자가 생명이라 검증을 못 넘겼으면 반드시 사람이 봐야 한다
        needsReview = true;
        reviewNote = img.note;
      }
    }

    const page = {
      id: '1',
      blocks,
      styleVariant: isHybrid ? 'hybrid' : bgImage ? 'image' : 'notebook',
      ratio: ratio || '4:5',
      noteLabel: '타임머신',
      noteNumber: note,
      bgImage,
      bgLabel: isHybrid ? '노트(빠름)' : style === 'newspaper' ? '신문 지면' : '손글씨 노트',
      overlay: '',
      title: cardTitle,
      subtitle: '',
      layout: 'bottom-left-list',
      needsReview,
      reviewNote,
    };

    const supabase = serviceClient();
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const name = `[타임머신] ${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${cardTitle}`;

    const { data, error } = await supabase
      .from('card_designs')
      .insert({ name, description: `timemachine:${cols.map(c => c.name).join(',')}`, pages_data: [page], category: '단지 리스트' })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });

    return NextResponse.json({ designId: data.id, name, image: Boolean(bgImage), needsReview, reviewNote });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
