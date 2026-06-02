import { generateWithRetry } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { blogText, slotLabel } = await request.json();

    if (!blogText) {
      return NextResponse.json({ error: 'blogText가 필요합니다.' }, { status: 400 });
    }

    const prompt = `You are a professional AI image generation prompt engineer.
Your task is to generate a highly descriptive, cinematic, and professional image generation prompt in English (suitable for DALL-E 3 or Midjourney) based on the blog content and a specific section label.

Blog Content Context:
"""
${blogText.slice(0, 1000)}
"""

Specific Section Label / Target Image Concept:
"""
${slotLabel || 'General blog banner image'}
"""

Please generate an English prompt following these guidelines:
1. It must be descriptive and sentence-based (around 15-30 words). Describe the subjects, setting, textures, lightings, and colors.
2. Focus on realistic, modern, and high-quality photography styles.
3. If the topic is about real estate, finance, business, or economics, incorporate professional elements (e.g., sleek modern architecture, clean interior offices, financial charts, warm natural light, urban cityscapes).
4. Strictly avoid any text, logos, or watermarks within the generated image description.
5. Return ONLY the final English prompt, with absolutely no preamble, no markdown, and no additional notes.

Example:
"A close-up shot of a modern tablet displaying glowing stock charts on a sleek wooden table, warm ambient office lighting in the background, professional corporate setting, photorealistic, 8k resolution, highly detailed."

Generate the prompt now:`;

    const text = await generateWithRetry(prompt);
    const suggestedPrompt = text
      .trim()
      .replace(/^["']|["']$/g, '')
      .split('\n')[0];

    return NextResponse.json({ prompt: suggestedPrompt });
  } catch (err: any) {
    console.error('suggest-image-prompt error:', err);
    return NextResponse.json({ error: err.message || 'Failed to suggest image prompt' }, { status: 500 });
  }
}
