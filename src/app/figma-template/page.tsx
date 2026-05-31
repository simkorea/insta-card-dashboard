"use client";

import React, { useState } from "react";
import { PenTool, ArrowRight, Loader2, CheckCircle2, AlertCircle, Save, Database } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function FigmaTemplatePage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [category, setCategory] = useState("공덕역 자이르네 분양 정보용"); // Default or combobox
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setSaveSuccess(false);

    try {
      const response = await fetch("http://localhost:8000/api/figma/extract-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "API 호출에 실패했습니다.");
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || "알 수 없는 에러가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDB = async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      
      const { error: dbError } = await supabase
        .from('card_designs')
        .insert({
          name: result.name || "Figma Template",
          description: "Imported via Figma API",
          category: category,
          pages_data: result.frames || []
        });

      if (dbError) throw dbError;
      
      setSaveSuccess(true);
    } catch (err: any) {
      setError(err.message || "DB 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-2xl shadow-inner">
              <PenTool className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Figma 템플릿 변환</h1>
              <p className="text-gray-500 mt-2">피그마 URL을 입력하고 디자인 데이터를 분석하여 추출하세요.</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.figma.com/file/... 또는 design/..."
                className="w-full pl-5 pr-5 py-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800 placeholder:text-gray-400"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold rounded-2xl flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  추출 중...
                </>
              ) : (
                <>
                  연동하기
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-800 p-6 rounded-3xl flex items-start gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-500" />
            <div>
              <h3 className="font-bold text-lg">오류가 발생했습니다</h3>
              <p className="mt-1 text-red-600/90">{error}</p>
            </div>
          </div>
        )}

        {/* Success State & Result */}
        {result && (
          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="flex items-center gap-3 text-emerald-500">
              <div className="p-2 bg-emerald-50 rounded-full">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">추출이 완료되었습니다</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-medium block mb-2">Figma 파일명</span>
                <span className="font-bold text-gray-900 text-lg">{result.name}</span>
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <span className="text-gray-500 font-medium block mb-2">마지막 수정 일시</span>
                <span className="font-bold text-gray-900 text-lg">
                  {new Date(result.lastModified).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <label className="text-sm font-bold text-gray-700 whitespace-nowrap">카테고리 지정</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="예: 부동산 상식 카드용"
                  className="flex-1 md:w-64 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  <option value="공덕역 자이르네 분양 정보용" />
                  <option value="부동산 상식 카드용" />
                  <option value="유튜브 썸네일" />
                  <option value="인스타그램 피드" />
                </datalist>
              </div>

              <button
                onClick={handleSaveToDB}
                disabled={isSaving || saveSuccess}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 w-full md:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    저장 완료
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    DB에 저장하기
                  </>
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-800">추출된 레이아웃 & 스타일 데이터 (JSON)</h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  {result.frames?.length || 0} Frames Found
                </span>
              </div>
              <div className="bg-[#0D1117] rounded-2xl p-6 overflow-x-auto shadow-inner">
                <pre className="text-gray-300 text-sm font-mono leading-relaxed">
                  {JSON.stringify(result.frames, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
