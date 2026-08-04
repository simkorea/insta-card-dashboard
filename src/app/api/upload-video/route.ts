import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 영상 업로드용 서명 URL을 발급한다.
//
// 왜 파일을 여기로 받지 않는가: Vercel 라우트는 요청 본문이 약 4.5MB로 제한된다.
// 릴스 영상은 보통 그보다 훨씬 커서 라우트를 거치면 반드시 실패한다.
// 그래서 서명된 업로드 주소만 내주고, 파일 자체는 브라우저 → Supabase로
// 바로 올린다.

export const maxDuration = 30;

const BUCKET = 'card-images';           // 기존 공개 버킷을 그대로 쓴다 (videos/ 하위)
const MAX_BYTES = 300 * 1024 * 1024;    // 300MB. 인스타 릴스 자체 한도가 1GB지만 실용선

// webm은 영상 생성 화면이 브라우저에서 녹화할 때 나올 수 있다. 유튜브·틱톡은
// 받지만 인스타는 받지 않는다 — 그 판단은 발행 화면에서 한다.
const ALLOWED = ['video/mp4', 'video/quicktime', 'video/webm'];

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, size } = await request.json();

    if (!filename) return NextResponse.json({ error: '파일명이 필요합니다.' }, { status: 400 });

    // MediaRecorder는 'video/mp4;codecs=avc1.42E01E' 처럼 코덱까지 붙여서 준다.
    const baseType = String(contentType || '').split(';')[0].trim();
    if (baseType && !ALLOWED.includes(baseType)) {
      return NextResponse.json(
        { error: 'MP4 · MOV · WebM 파일만 올릴 수 있습니다.' },
        { status: 400 }
      );
    }
    if (size && Number(size) > MAX_BYTES) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (${Math.round(Number(size) / 1024 / 1024)}MB). 300MB 이하로 올려주세요.` },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: 'Supabase 설정이 없습니다.' }, { status: 500 });

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Storage 오브젝트 키는 ASCII만 허용된다 — 한글 파일명을 그대로 쓰면
    // "Invalid key"로 업로드가 통째로 거부된다(예전에 노트 카드에서 겪은 문제).
    const ext = (filename.split('.').pop() || 'mp4').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'mp4';
    const path = `videos/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: `업로드 준비 실패: ${error.message}` }, { status: 500 });

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ bucket: BUCKET, path, token: data.token, publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '알 수 없는 오류' }, { status: 500 });
  }
}
