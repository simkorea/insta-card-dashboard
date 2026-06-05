import { callOpenRouter } from "@/lib/ai/openrouter";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await callOpenRouter("안녕? 한 문장으로 자기소개 해줘.");
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
