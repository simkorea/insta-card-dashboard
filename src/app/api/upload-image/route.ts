import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from('card-images')
      .upload(filename, bytes, { contentType: file.type, upsert: false });

    if (error) {
      // 버킷이 없으면 안내 메시지
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        return NextResponse.json({
          error: 'Supabase Storage 버킷 "card-images"를 먼저 생성해주세요.',
          bucketRequired: true,
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('card-images')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
