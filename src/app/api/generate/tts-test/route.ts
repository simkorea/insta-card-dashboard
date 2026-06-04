import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'ko-KR-InJoonNeural' } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text가 필요합니다' }, { status: 400 });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      audioStream.on('end', () => {
        resolve();
      });
      audioStream.on('error', (err) => {
        reject(err);
      });
    });

    const audioBuffer = Buffer.concat(chunks);
    const base64Audio = audioBuffer.toString('base64');

    return NextResponse.json({ audio: base64Audio });
  } catch (error: any) {
    console.error('TTS Test Error:', error);
    return NextResponse.json({ error: error.message || '음성 합성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
