import { NextRequest, NextResponse } from 'next/server';
import type { SlideBlock } from '@/lib/cardnews/blocks';
import { notebookFactsFromBlocks } from '@/lib/notebookImage/factsFromBlocks';
import { generateNewsNotebookImage, type CardStyle } from '@/lib/notebookImage/generate';
import { uploadNotebookImage } from '@/lib/notebookImage/upload';
import { mapWithLimit, budget } from '@/lib/notebookImage/pool';

// 이미 만들어진 카드(blocks)를 그림 스타일(손글씨 노트 / 신문)로 다시 그린다.
//
// 문구를 새로 만들지 않는다. 각 생성 탭(텍스트/URL/트렌드/9단계/완전자동)이
// 자기 방식대로 카드를 만든 뒤, 그 결과를 그대로 받아 그림만 입히는 구조라
// 기존 생성 로직을 하나도 건드리지 않는다.

export const maxDuration = 300;

type InCard = { blocks?: SlideBlock[] };

export async function POST(request: NextRequest) {
  try {
    const { cards, noteNumber, ratio, noteLabel, style } = await request.json();
    // 'photo'는 여기까지 오지 않는다(기존 렌더러가 그린다). 모르는 값은 노트로 본다.
    const cardStyle: CardStyle = style === 'newspaper' ? 'newspaper' : 'notebook';

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: '카드가 없습니다.' }, { status: 400 });
    }
    if (cards.length > 12) {
      return NextResponse.json({ error: '한 번에 12장까지만 그릴 수 있습니다.' }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: '이미지 생성 키(GEMINI_API_KEY)가 설정되지 않았습니다.' },
        { status: 503 }
      );
    }

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const note =
      noteNumber ||
      `No.${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`;

    // 한꺼번에 던지면 서로 밀려 호출마다 제한에 걸리고 라우트가 통째로 죽는다.
    // 몇 개씩 나눠 돌리고, 시간이 다하면 그때까지 만든 것만 돌려준다.
    const bud = budget(265_000);
    const results = await mapWithLimit(cards as InCard[], 4, async (card, i) => {
        if (!bud.canStart(70_000)) {
          return { url: null, reason: '시간이 모자라 건너뛰었습니다. 장수를 줄여 다시 시도해주세요' };
        }
        const blocks = Array.isArray(card.blocks) ? card.blocks : [];
        const facts = notebookFactsFromBlocks(blocks, i + 1);

        // 제목도 포인트도 없으면 그릴 내용이 없다 — 그 장은 원래 스타일로 남긴다
        if (!facts.headline) return { url: null, reason: '제목이 없어 건너뛰었습니다' };

        const img = await generateNewsNotebookImage(
          {
            ...facts,
            noteLabel: noteLabel || (cardStyle === 'newspaper' ? '오늘의 뉴스' : '오늘의 노트'),
            noteNumber: note,
            ratio: ratio || '4:5',
          },
          { style: cardStyle }
        );
        if (!img) return { url: null, reason: '이미지 생성에 실패했습니다' };

        const url = await uploadNotebookImage(img.base64, i + 1);
        if (!url) return { url: null, reason: '이미지 저장에 실패했습니다' };

        return { url, verified: img.verified, reason: img.verified ? undefined : img.note };
    });

    return NextResponse.json({
      noteNumber: note,
      images: results,
      drawn: results.filter(r => r.url).length,
      total: cards.length,
    });
  } catch (e: any) {
    console.error('[NotebookCards] 실패:', e?.message);
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
