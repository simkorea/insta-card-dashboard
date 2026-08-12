import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'ko-KR-InJoonNeural', rate } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text가 필요합니다' }, { status: 400 });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // 말 속도. 영상 길이를 줄이는 가장 손쉬운 방법이라 밖에서 조절할 수 있게 열어 둔다.
    // SSML은 1.0 기준의 배수를 받는다 (1.2 = 20% 빠르게). 너무 빠르면 안 들리므로 막아 둔다.
    const r = Number(rate);
    const prosody = Number.isFinite(r) && r !== 1
      ? { rate: Math.min(1.6, Math.max(0.7, r)) }
      : undefined;

    const { audioStream } = tts.toStream(text, prosody);
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
