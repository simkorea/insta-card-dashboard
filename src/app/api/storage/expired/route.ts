import { NextRequest, NextResponse } from 'next/server';
import { RETENTION_DAYS, listExpired, deleteExpired, publicUrl, summarize } from '@/lib/storage/cardImages';

// 발행한 지 RETENTION_DAYS 일이 지난 카드 그림 — 화면이 "정리할까요?"를 물어볼 때 쓴다.
// 로그인한 사람만 열 수 있다(middleware 의 /api/storage 보호).

export const maxDuration = 60;

// 디자인별로 묶어 돌려준다. ZIP 의 폴더 하나가 된다.
export async function GET() {
  try {
    const rows = await listExpired();
    const groups = new Map<string, { designId: string | null; designName: string; date: string; files: { name: string; url: string; sizeBytes: number }[] }>();
    for (const r of rows) {
      const key = r.design_id || r.name.split('/')[1]?.split('_')[0] || 'unknown';
      let g = groups.get(key);
      if (!g) {
        g = {
          designId: r.design_id,
          designName: r.design_name || '이름 없는 카드뉴스',
          date: String(r.created_at).slice(0, 10),
          files: [],
        };
        groups.set(key, g);
      }
      g.files.push({ name: r.name, url: publicUrl(r.name), sizeBytes: Number(r.size_bytes || 0) });
    }
    return NextResponse.json({ days: RETENTION_DAYS, ...summarize(rows), groups: Array.from(groups.values()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// body: { names: string[] }  — 서버가 다시 확인해 "지워도 되는 것"만 지운다.
export async function POST(request: NextRequest) {
  try {
    const { names } = await request.json();
    if (!Array.isArray(names) || names.length === 0 || names.some(n => typeof n !== 'string')) {
      return NextResponse.json({ error: 'names(문자열 배열)가 필요합니다' }, { status: 400 });
    }
    return NextResponse.json(await deleteExpired(names));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
