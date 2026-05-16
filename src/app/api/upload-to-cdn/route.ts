import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

async function uploadToSupabase(buf: ArrayBuffer, filename: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const path = `sns/${filename}`;
  const { error } = await supabase.storage
    .from('card-images')
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(`Supabase 업로드 실패: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from('card-images')
    .getPublicUrl(path);

  return publicUrl;
}

async function uploadToImgur(buf: ArrayBuffer): Promise<string> {
  const base64 = Buffer.from(buf).toString('base64');
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: 'Client-ID 546c25a59c58ad7',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64, type: 'base64' }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`imgur 실패: ${JSON.stringify(data)}`);
  return data.data.link as string;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file 필드 없음' }, { status: 400 });

    const buf = await file.arrayBuffer();
    const filename = `card_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

    let url: string;
    try {
      url = await uploadToSupabase(buf, filename);
    } catch {
      url = await uploadToImgur(buf);
    }

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
