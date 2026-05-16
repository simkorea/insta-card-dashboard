import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

async function uploadToLitterbox(buf: ArrayBuffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', '72h');
  form.append('fileToUpload', new Blob([buf], { type: 'image/jpeg' }), filename);

  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
  });
  const url = (await res.text()).trim();
  if (!url.startsWith('http')) throw new Error(`litterbox 실패: ${url}`);
  return url;
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
    const filename = `card_${Date.now()}.jpg`;

    let url: string;
    try {
      url = await uploadToLitterbox(buf, filename);
    } catch {
      url = await uploadToImgur(buf);
    }

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
