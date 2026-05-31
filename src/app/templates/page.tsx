"use client";

import React, { useEffect, useState } from "react";
import { LayoutTemplate, Loader2, Calendar, LayoutList, Tag } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase
        .from('card_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const items = data || [];
      setTemplates(items);
      
      // 추출된 카테고리 목록 생성
      const uniqueCategories = Array.from(new Set(items.map(item => item.category || '미분류')));
      setCategories(['전체', ...uniqueCategories]);
      
    } catch (err) {
      console.error("템플릿 로딩 에러:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = selectedCategory === "전체" 
    ? templates 
    : templates.filter(t => (t.category || '미분류') === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-2xl shadow-inner">
                <LayoutTemplate className="w-7 h-7" />
              </div>
              나만의 템플릿 저장소
            </h1>
            <p className="text-gray-500 mt-2 font-medium">피그마에서 가져온 디자인 틀을 카테고리별로 관리하세요.</p>
          </div>
          
          <div className="bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-500">총 템플릿</span>
            <span className="text-2xl font-bold text-indigo-600">{templates.length}</span>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  selectedCategory === cat 
                    ? "bg-gray-900 text-white shadow-md scale-105" 
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading & Empty State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
            <p className="font-medium text-gray-500">템플릿을 불러오는 중입니다...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center max-w-2xl mx-auto mt-10">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <LayoutTemplate className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">저장된 템플릿이 없습니다</h3>
            <p className="text-gray-500 font-medium">
              피그마 변환 메뉴에서 새로운 템플릿을 추출하고<br />
              카테고리를 지정해 저장해보세요.
            </p>
          </div>
        ) : (
          /* Template Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <div 
                key={template.id} 
                className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 group hover:-translate-y-1.5 overflow-hidden flex flex-col cursor-pointer"
              >
                <div className="p-7 flex-1 border-b border-gray-50/80 bg-gradient-to-br from-white to-gray-50/30">
                  <div className="flex items-start justify-between mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50/80 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100/50">
                      <Tag className="w-3.5 h-3.5" />
                      {template.category || '미분류'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {template.name}
                  </h3>
                  <p className="text-sm font-medium text-gray-500 mb-2 line-clamp-2">{template.description}</p>
                </div>
                
                <div className="bg-white px-7 py-5 flex items-center justify-between text-sm font-bold text-gray-400">
                  <div className="flex items-center gap-2">
                    <LayoutList className="w-4.5 h-4.5 text-gray-300" />
                    <span className="text-gray-600">{template.pages_data ? template.pages_data.length : 0} Frames</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4.5 h-4.5 text-gray-300" />
                    <span className="text-gray-500">{new Date(template.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
