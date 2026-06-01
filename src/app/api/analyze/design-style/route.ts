import { generateWithRetry, toKoreanError } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();
    if (!images?.length) return NextResponse.json({ error: '이미지가 필요합니다' }, { status: 400 });

    const analyzeOne = async (base64: string) => {
      const mimeType = base64.startsWith('data:image/png') ? 'image/png'
        : base64.startsWith('data:image/webp') ? 'image/webp'
        : 'image/jpeg';
      const data = base64.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `이 카드뉴스/디자인 이미지를 분석하세요. 반드시 JSON만 응답하세요:
{
  "primaryColor": "가장 눈에 띄는 주색상 HEX (배경이나 강조색)",
  "secondaryColor": "두 번째 강조 HEX 또는 보조색",
  "backgroundColor": "배경색 HEX",
  "textColor": "텍스트 색상 HEX",
  "fontWeight": "light | regular | bold | black",
  "fontStyle": "sans-serif | serif | display | handwriting",
  "layoutType": "centered | split | corner-text | full-overlay | minimal-card | bold-banner",
  "hasGradient": true 또는 false,
  "styleKeywords": ["최대 3개: clean, bold, elegant, playful, modern, minimal, vibrant, dark, pastel, professional 중 해당하는 것"],
  "contentRatio": "image-heavy | text-heavy | balanced"
}`;

      let text = (await generateWithRetry({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data } },
            { text: prompt },
          ],
        }],
      })).trim();
      if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
      else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
      return JSON.parse(text);
    };

    const analyses = await Promise.all(images.map(analyzeOne));

    // Synthesize across multiple images
    const synthesize = (key: string) => {
      const vals = analyses.map((a: Record<string, unknown>) => a[key]).filter(Boolean);
      // For colors: pick most common, or first valid HEX
      return vals[0];
    };

    const allKeywords: string[] = analyses.flatMap((a: Record<string, unknown>) => (a.styleKeywords as string[] | undefined) || []);
    const keywordCounts: Record<string, number> = {};
    allKeywords.forEach(k => { keywordCounts[k] = (keywordCounts[k] || 0) + 1; });
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    const avgColor = (key: string) => {
      const hexes = analyses
        .map((a: Record<string, unknown>) => a[key] as string)
        .filter(h => h && /^#[0-9A-Fa-f]{6}$/.test(h));
      if (!hexes.length) return null;
      const rgbs = hexes.map(h => ({
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
      }));
      const avg = {
        r: Math.round(rgbs.reduce((s, c) => s + c.r, 0) / rgbs.length),
        g: Math.round(rgbs.reduce((s, c) => s + c.g, 0) / rgbs.length),
        b: Math.round(rgbs.reduce((s, c) => s + c.b, 0) / rgbs.length),
      };
      return `#${avg.r.toString(16).padStart(2, '0')}${avg.g.toString(16).padStart(2, '0')}${avg.b.toString(16).padStart(2, '0')}`;
    };
function getBrandTone(hex: string): 'gold' | 'sage' {
  try {
    const cleanHex = hex.replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex) && !/^[0-9A-Fa-f]{3}$/.test(cleanHex)) {
      return 'gold';
    }
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0]+cleanHex[0] : cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1]+cleanHex[1] : cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2]+cleanHex[2] : cleanHex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    const hue = h * 360;

    // Green/Sage family (hue typically between 70 and 170)
    if (hue >= 70 && hue <= 170) {
      return 'sage';
    }
    // Yellow/Gold or other families default to gold
    return 'gold';
  } catch {
    return 'gold';
  }
}

    const primaryColor = avgColor('primaryColor') || '#6366f1';
    const brandTone = getBrandTone(primaryColor);

    const profile = {
      primaryColor,
      secondaryColor: avgColor('secondaryColor') || '#818cf8',
      backgroundColor: avgColor('backgroundColor') || '#ffffff',
      textColor: avgColor('textColor') || '#1a1a1a',
      fontWeight: synthesize('fontWeight') || 'bold',
      fontStyle: synthesize('fontStyle') || 'sans-serif',
      layoutType: synthesize('layoutType') || 'centered',
      hasGradient: analyses.some((a: Record<string, unknown>) => a.hasGradient === true),
      styleKeywords: topKeywords.length ? topKeywords : ['modern'],
      contentRatio: synthesize('contentRatio') || 'balanced',
      imageCount: images.length,
      brandTone,
      showFrame: true,
      analyses,
    };

    return NextResponse.json({ profile });
  } catch (e: any) {
    return NextResponse.json({ error: toKoreanError(e) }, { status: 500 });
  }
}
