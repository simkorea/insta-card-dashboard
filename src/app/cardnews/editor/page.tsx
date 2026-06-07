'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Undo, Redo, ZoomIn, ZoomOut,
  Save, Copy, Trash2, Check, Plus, Search,
  AlignLeft, AlignCenter, AlignRight, X,
  Maximize2, Minimize2, RotateCcw, Crop,
  GripVertical, ChevronDown, Wand2, Film, Type,
  Image as ImageIcon, ChevronUp, Loader2, Paperclip,
  RefreshCw, FolderOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';
import type { SlideBlock, BrandTone } from '@/lib/cardnews/blocks';
import { BlockRenderer } from '@/components/cardnews/BlockRenderer';
import { SlideFrame } from '@/components/cardnews/SlideFrame';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TextStyle {
  fontSize?: number;       // px at 420px canvas width
  fontWeight?: string;     // '300'|'400'|'500'|'600'|'900'
  fontFamily?: string;
  color?: string;
  letterSpacing?: number;  // px
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

interface CanvasElement {
  id: string;
  type: 'shape' | 'emoji' | 'text';
  // shape
  shape?: 'circle' | 'rect' | 'triangle' | 'star' | 'diamond' | 'heart';
  // emoji
  emoji?: string;
  // text
  text?: string;
  fontSize?: number;    // px at 420px canvas width
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;       // text box width as % of canvas width
  // common
  x: number;            // 0–100% center from left
  y: number;            // 0–100% center from top
  size: number;         // shape/emoji: % of canvas width
  color: string;        // shape fill / text color
  opacity: number;
}

interface CanvasLayer {
  id: number;
  type: 'image' | 'text';
  label: string;
  content?: string;
  style?: TextStyle;
}
interface PexelsPhoto {
  id: number;
  photographer: string;
  src: { medium: string; large: string };
  alt: string;
}
type ImageTab = '상업사용' | '인터넷' | '에셋' | 'AI생성';

// ─── Page Data ────────────────────────────────────────────────────────────────
interface CanvasLayerWithSrc extends CanvasLayer {
  imageSrc?: string;
}

interface PageData {
  id: string;
  bgImage: string;
  bgLabel: string;
  overlay: string;
  title: string;
  subtitle: string;
  accent?: string;
  layout: 'center' | 'bottom-left' | 'bottom-left-list';
  bullets?: string[];
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  bulletStyle?: TextStyle;
  imageKeyword?: string;
  elements?: CanvasElement[];
  bgScale?: number;
  bgPosition?: { x: number; y: number };
  bgBrightness?: number;
  bgBrightnessFilter?: number;  // CSS filter brightness % (50-200, default 100)
  overlayOpacity?: number;       // gradient overlay opacity % (0-100, default 100)
  blocks?: SlideBlock[];
  brandTone?: BrandTone;
  showFrame?: boolean;
  blocksOffsetY?: number;
  handle?: string;
}

const normalizePages = (pages: any[]): PageData[] => {
  return pages.map((p, idx) => {
    let id = p.id;
    if (id === undefined || id === null || String(id) === '' || String(id) === 'NaN' || (typeof id === 'number' && isNaN(id))) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `page_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    } else {
      id = String(id);
    }
    return {
      ...p,
      id,
    };
  });
};


const BUSINESS_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80',
    bgLabel: '도시 전경 이미지',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.3) 100%)',
    title: 'Business Title',
    subtitle: 'Subtitle',
    layout: 'center',
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80',
    bgLabel: '금융 비즈니스 배경',
    overlay: 'linear-gradient(135deg, rgba(10,10,30,0.92) 0%, rgba(10,10,40,0.80) 100%)',
    title: 'Key Point',
    subtitle: '',
    accent: '#ffd700',
    layout: 'bottom-left-list',
    bullets: ['Point 1', 'Point 2'],
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    bgLabel: '건설 현장 배경',
    overlay: 'linear-gradient(135deg, rgba(10,20,10,0.88) 0%, rgba(20,20,10,0.70) 100%)',
    title: 'Expansion',
    subtitle: '',
    accent: '#ffd700',
    layout: 'bottom-left-list',
    bullets: ['Growth 1', 'Growth 2'],
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
    bgLabel: '아파트 단지 배경',
    overlay: 'linear-gradient(135deg, rgba(10,10,30,0.90) 0%, rgba(10,20,40,0.75) 100%)',
    title: 'Market Trend',
    subtitle: '',
    accent: '#ffd700',
    layout: 'bottom-left-list',
    bullets: ['Trend 1', 'Trend 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80',
    bgLabel: '전략 회의 배경',
    overlay: 'linear-gradient(135deg, rgba(10,10,25,0.88) 0%, rgba(20,10,30,0.75) 100%)',
    title: 'Conclusion',
    subtitle: '',
    accent: '#ffd700',
    layout: 'bottom-left-list',
    bullets: ['Step 1', 'Step 2'],
  },
];

const CAFE_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80',
    bgLabel: '카페 테이블',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
    title: 'Cafe Intro',
    subtitle: 'Warm Coffee & Stories',
    layout: 'center',
    titleStyle: { fontSize: 42, fontWeight: '900', color: '#FFFFFF' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    bgLabel: '커피 한 잔',
    overlay: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.7) 100%)',
    title: 'Best Menu',
    subtitle: '',
    accent: '#f3d9ba',
    layout: 'bottom-left-list',
    bullets: ['Signature Drink', 'Seasonal Special'],
    titleStyle: { fontSize: 32, fontWeight: '800', color: '#f3d9ba' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
    bgLabel: '라떼 아트',
    overlay: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))',
    title: 'Atmosphere',
    subtitle: '',
    accent: '#FFFFFF',
    layout: 'center',
    bullets: ['Cozy Space', 'Relaxing Music'],
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    bgLabel: '카페 인테리어',
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 100%)',
    title: 'Location',
    subtitle: '',
    layout: 'bottom-left-list',
    bullets: ['Open Daily', 'Near Station'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1511081692775-05d0f180a065?w=800&q=80',
    bgLabel: '커피 콩',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
    title: 'Visit Us',
    subtitle: '',
    layout: 'center',
    bullets: ['Mangwon-dong 123', 'Slow Life'],
  },
];

const LIFESTYLE_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
    bgLabel: '라이프스타일 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.2) 100%)',
    title: 'Lifestyle',
    subtitle: '더 나은 오늘을 위한 이야기',
    layout: 'center',
    titleStyle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 14, fontWeight: '400', color: '#E5E7EB' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=800&q=80',
    bgLabel: '요가 명상 배경',
    overlay: 'linear-gradient(135deg, rgba(30,20,10,0.85) 0%, rgba(50,30,20,0.70) 100%)',
    title: 'Key Point',
    subtitle: '',
    accent: '#F4A261',
    layout: 'bottom-left-list',
    bullets: ['Point 1', 'Point 2'],
    titleStyle: { fontSize: 26, fontWeight: '900', color: '#F4A261' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    bgLabel: '건강식 배경',
    overlay: 'linear-gradient(135deg, rgba(10,25,10,0.85) 0%, rgba(20,35,15,0.70) 100%)',
    title: 'Insight',
    subtitle: '',
    accent: '#52B788',
    layout: 'bottom-left-list',
    bullets: ['Tip 1', 'Tip 2'],
    titleStyle: { fontSize: 26, fontWeight: '900', color: '#52B788' },
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    bgLabel: '운동 배경',
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.40) 100%)',
    title: 'Action',
    subtitle: '',
    accent: '#F4A261',
    layout: 'bottom-left-list',
    bullets: ['Step 1', 'Step 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
    bgLabel: '라이프스타일 마무리',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.88) 30%, rgba(0,0,0,0.3) 100%)',
    title: 'Conclusion',
    subtitle: '팔로우하고 더 많은 콘텐츠를 받아보세요',
    layout: 'center',
    titleStyle: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 13, fontWeight: '400', color: '#D1D5DB' },
  },
];

const TRAVEL_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    bgLabel: '여행 표지 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.80) 35%, rgba(0,0,0,0.15) 100%)',
    title: 'Travel',
    subtitle: '떠나야 할 이유가 생겼습니다',
    layout: 'center',
    titleStyle: { fontSize: 44, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 14, fontWeight: '400', color: '#FDE68A' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80',
    bgLabel: '여행 스팟 배경',
    overlay: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%)',
    title: 'Spot 1',
    subtitle: '',
    accent: '#FCD34D',
    layout: 'bottom-left-list',
    bullets: ['꿀팁 1', '꿀팁 2'],
    titleStyle: { fontSize: 28, fontWeight: '900', color: '#FCD34D' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
    bgLabel: '여행 풍경 배경',
    overlay: 'linear-gradient(135deg, rgba(10,15,30,0.85) 0%, rgba(10,20,40,0.65) 100%)',
    title: 'Spot 2',
    subtitle: '',
    accent: '#60A5FA',
    layout: 'bottom-left-list',
    bullets: ['꿀팁 1', '꿀팁 2'],
    titleStyle: { fontSize: 28, fontWeight: '900', color: '#60A5FA' },
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80',
    bgLabel: '여행 도시 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.90) 40%, transparent 100%)',
    title: 'Tip',
    subtitle: '',
    accent: '#FCD34D',
    layout: 'bottom-left-list',
    bullets: ['여행 꿀팁 1', '여행 꿀팁 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=800&q=80',
    bgLabel: '여행 마무리 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)',
    title: 'Let\'s Go',
    subtitle: '저장하고 다음 여행에 활용하세요',
    layout: 'center',
    titleStyle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 13, fontWeight: '400', color: '#FDE68A' },
  },
];

const FASHION_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    bgLabel: '패션 표지 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.80) 40%, rgba(0,0,0,0.15) 100%)',
    title: 'Style',
    subtitle: '나만의 스타일을 완성하는 법',
    layout: 'center',
    titleStyle: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
    subtitleStyle: { fontSize: 13, fontWeight: '300', color: '#E5E7EB' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80',
    bgLabel: '패션 쇼핑 배경',
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 100%)',
    title: 'Trend',
    subtitle: '',
    accent: '#F9A8D4',
    layout: 'bottom-left-list',
    bullets: ['트렌드 1', '트렌드 2'],
    titleStyle: { fontSize: 28, fontWeight: '900', color: '#F9A8D4' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=800&q=80',
    bgLabel: '뷰티 배경',
    overlay: 'linear-gradient(135deg, rgba(10,5,15,0.88) 0%, rgba(30,10,30,0.72) 100%)',
    title: 'Beauty',
    subtitle: '',
    accent: '#E879F9',
    layout: 'bottom-left-list',
    bullets: ['뷰티 팁 1', '뷰티 팁 2'],
    titleStyle: { fontSize: 28, fontWeight: '900', color: '#E879F9' },
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80',
    bgLabel: '패션 코디 배경',
    overlay: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)',
    title: 'Styling',
    subtitle: '',
    accent: '#F9A8D4',
    layout: 'bottom-left-list',
    bullets: ['코디 팁 1', '코디 팁 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80',
    bgLabel: '패션 마무리 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.88) 40%, rgba(0,0,0,0.15) 100%)',
    title: 'Follow',
    subtitle: '더 많은 스타일 팁을 받아보세요',
    layout: 'center',
    titleStyle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
    subtitleStyle: { fontSize: 13, fontWeight: '300', color: '#F9A8D4' },
  },
];

const FOOD_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    bgLabel: '음식 표지 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.80) 35%, rgba(0,0,0,0.1) 100%)',
    title: 'Food',
    subtitle: '오늘 뭐 먹지? 고민 해결!',
    layout: 'center',
    titleStyle: { fontSize: 48, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 14, fontWeight: '400', color: '#FED7AA' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
    bgLabel: '맛집 배경',
    overlay: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.88) 100%)',
    title: 'Menu',
    subtitle: '',
    accent: '#FB923C',
    layout: 'bottom-left-list',
    bullets: ['메뉴 포인트 1', '메뉴 포인트 2'],
    titleStyle: { fontSize: 28, fontWeight: '900', color: '#FB923C' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
    bgLabel: '요리 배경',
    overlay: 'linear-gradient(135deg, rgba(20,8,0,0.88) 0%, rgba(40,15,0,0.72) 100%)',
    title: 'Recipe',
    subtitle: '',
    accent: '#FBBF24',
    layout: 'bottom-left-list',
    bullets: ['재료 1', '재료 2'],
    titleStyle: { fontSize: 26, fontWeight: '900', color: '#FBBF24' },
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80',
    bgLabel: '음식 스타일링 배경',
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 100%)',
    title: 'Taste',
    subtitle: '',
    accent: '#FB923C',
    layout: 'bottom-left-list',
    bullets: ['맛 포인트 1', '맛 포인트 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    bgLabel: '음식 마무리 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)',
    title: 'Enjoy',
    subtitle: '저장하고 주변에 공유해보세요',
    layout: 'center',
    titleStyle: { fontSize: 44, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 13, fontWeight: '400', color: '#FED7AA' },
  },
];

const EDUCATION_THEME_DATA: any[] = [
  {
    id: 1,
    bgImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
    bgLabel: '교육 표지 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.80) 35%, rgba(0,0,0,0.20) 100%)',
    title: 'Learn',
    subtitle: '오늘의 지식이 내일의 기회가 됩니다',
    layout: 'center',
    titleStyle: { fontSize: 44, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 13, fontWeight: '400', color: '#BAE6FD' },
  },
  {
    id: 2,
    bgImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80',
    bgLabel: '공부 배경',
    overlay: 'linear-gradient(135deg, rgba(10,15,35,0.90) 0%, rgba(10,20,50,0.75) 100%)',
    title: 'Concept',
    subtitle: '',
    accent: '#38BDF8',
    layout: 'bottom-left-list',
    bullets: ['핵심 개념 1', '핵심 개념 2'],
    titleStyle: { fontSize: 26, fontWeight: '900', color: '#38BDF8' },
  },
  {
    id: 3,
    bgImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',
    bgLabel: '도서관 배경',
    overlay: 'linear-gradient(135deg, rgba(5,15,30,0.88) 0%, rgba(10,25,45,0.72) 100%)',
    title: 'Deep Dive',
    subtitle: '',
    accent: '#818CF8',
    layout: 'bottom-left-list',
    bullets: ['심화 내용 1', '심화 내용 2'],
    titleStyle: { fontSize: 26, fontWeight: '900', color: '#818CF8' },
  },
  {
    id: 4,
    bgImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
    bgLabel: '학습 환경 배경',
    overlay: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.40) 100%)',
    title: 'Practice',
    subtitle: '',
    accent: '#38BDF8',
    layout: 'bottom-left-list',
    bullets: ['실습 항목 1', '실습 항목 2'],
  },
  {
    id: 5,
    bgImage: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
    bgLabel: '교육 마무리 배경',
    overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.20) 100%)',
    title: 'Summary',
    subtitle: '팔로우하고 지식을 함께 쌓아가요',
    layout: 'center',
    titleStyle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
    subtitleStyle: { fontSize: 13, fontWeight: '400', color: '#BAE6FD' },
  },
];

const PAGES_DATA = BUSINESS_THEME_DATA; // 기본값

// ── 내장 테마 목록 ─────────────────────────────────────────────────────────────
const BUILT_IN_THEMES: { id: string; label: string; emoji: string; bg: string; accent: string; data: PageData[] }[] = [
  { id: 'business', label: '비즈니스', emoji: '🏢', bg: '#0a0a1e', accent: '#6366f1', data: BUSINESS_THEME_DATA },
  { id: 'cafe', label: '카페', emoji: '☕', bg: '#1a0f08', accent: '#f3d9ba', data: CAFE_THEME_DATA },
  { id: 'lifestyle', label: '라이프스타일', emoji: '🌿', bg: '#0a1a0a', accent: '#4ADE80', data: LIFESTYLE_THEME_DATA },
  { id: 'travel', label: '여행', emoji: '✈️', bg: '#0a1020', accent: '#38BDF8', data: TRAVEL_THEME_DATA },
  { id: 'fashion', label: '패션/뷰티', emoji: '👗', bg: '#1a0a1a', accent: '#F9A8D4', data: FASHION_THEME_DATA },
  { id: 'food', label: '음식/맛집', emoji: '🍜', bg: '#1a0808', accent: '#FB923C', data: FOOD_THEME_DATA },
  { id: 'education', label: '교육', emoji: '📚', bg: '#08081a', accent: '#A78BFA', data: EDUCATION_THEME_DATA },
];

// 현재 페이지의 레이어 목록 생성 (스타일 정보 포함)
function getLayersForPage(page: PageData): CanvasLayerWithSrc[] {
  return [
    { id: 0, type: 'image', label: page.bgLabel, imageSrc: page.bgImage },
    { id: 1, type: 'text', label: page.title.replace(/\n/g, ' '), content: page.title, style: page.titleStyle },
    ...(page.subtitle ? [{ id: 2, type: 'text' as const, label: page.subtitle.slice(0, 30), content: page.subtitle, style: page.subtitleStyle }] : []),
    ...(page.bullets ? page.bullets.map((b, i) => ({
      id: 3 + i,
      type: 'text' as const,
      label: b.replace(/<[^>]+>/g, '').slice(0, 30),
      content: b.replace(/<[^>]+>/g, ''),
      style: page.bulletStyle,
    })) : []),
  ];
}

// AI 생성 데이터({ page, title, body, backgroundImage, accent, imageKeyword }[]) → PageData[] 변환
function cardNewsToPages(raw: { page: number; title: string; body: string; backgroundImage?: string; accent?: string; imageKeyword?: string; blocks?: SlideBlock[]; brandTone?: BrandTone; showFrame?: boolean; blocksOffsetY?: number; }[], theme: any[] = PAGES_DATA): any[] {
  const lastIdx = raw.length - 1;
  return raw.map((card, i) => {
    // 테마 슬롯 매핑: 첫 장은 표지, 마지막 장은 마무리, 나머지는 중간 레이아웃 반복
    let base;
    if (i === 0) base = theme[0];
    else if (i === lastIdx) base = theme[theme.length - 1];
    else {
      const middleCount = Math.max(1, theme.length - 2);
      const middleIdx = 1 + ((i - 1) % middleCount);
      base = theme[middleIdx];
    }
    const bgImage = card.backgroundImage || base.bgImage;
    const accent = card.accent || base.accent;
    const imageKeyword = card.imageKeyword;
    const blocks = card.blocks || base.blocks;
    const brandTone = card.brandTone || base.brandTone;
    const showFrame = card.showFrame !== undefined ? card.showFrame : base.showFrame;
    const blocksOffsetY = card.blocksOffsetY !== undefined ? card.blocksOffsetY : base.blocksOffsetY;

    if (i === 0) {
      return { ...base, id: String(card.page), title: card.title, subtitle: card.body, bullets: undefined, bgImage, accent, imageKeyword, blocks, brandTone, showFrame, blocksOffsetY };
    }
    const bodyLines = card.body.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return {
      ...base,
      id: String(card.page),
      title: card.title,
      subtitle: '',
      bullets: bodyLines.length > 1 ? bodyLines : [card.body],
      bgImage,
      accent,
      imageKeyword,
      blocks,
      brandTone,
      showFrame,
      blocksOffsetY,
    };
  });
}

// ─── Crop Modal ───────────────────────────────────────────────────────────────
// ─── Theme Change Modal ────────────────────────────────────────────────────────
function ThemeChangeModal({ onApply, onClose }: {
  onApply: (theme: PageData[]) => void;
  onClose: () => void;
}) {
  const supabase = createSupabaseBrowser();
  const [userTemplates, setUserTemplates] = useState<{ id: string; name: string; pages: PageData[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('user_templates')
          .select('id, name, pages')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) {
          setUserTemplates(data.map((r: any) => ({
            id: r.id,
            name: r.name,
            pages: Array.isArray(r.pages) ? r.pages : [],
          })).filter((t: any) => t.pages.length > 0));
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [supabase]);

  const handleApply = (theme: PageData[], id: string) => {
    setApplying(id);
    onApply(theme);
  };

  // 테마 미니 프리뷰 (색상 스트라이프)
  const ThemeCard = ({ id, label, emoji, bg, accent, data }: typeof BUILT_IN_THEMES[0]) => (
    <button
      onClick={() => handleApply(data, id)}
      disabled={applying !== null}
      className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-transparent hover:border-violet-400 transition-all active:scale-95 disabled:opacity-60"
      style={{ background: bg }}
    >
      {/* 미니 슬라이드 프리뷰 */}
      <div className="aspect-[3/4] w-full relative overflow-hidden">
        {data[0]?.bgImage && (
          <img src={data[0].bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0" style={{ background: data[0]?.overlay || 'rgba(0,0,0,0.5)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          <span className="text-2xl mb-1">{emoji}</span>
          <div className="text-white text-[10px] font-bold text-center leading-tight drop-shadow-sm">{label}</div>
          {/* 컬러 포인트 */}
          <div className="flex gap-1 mt-2">
            {data.slice(0, 3).map((p, i) => (
              <div key={i} className="w-3 h-3 rounded-full border border-white/30"
                style={{ background: p.accent || accent }} />
            ))}
          </div>
        </div>
        {applying === id && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 text-center">
        <span className="text-[11px] font-bold text-white/90">{label}</span>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">디자인 변경</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">텍스트·내용은 그대로, 디자인 스타일만 바꿉니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* 내장 테마 */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">기본 테마</h3>
            <div className="grid grid-cols-4 gap-3">
              {BUILT_IN_THEMES.map(t => <ThemeCard key={t.id} {...t} />)}
            </div>
          </div>

          {/* 내 저장 템플릿 */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">내 저장 템플릿</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin mr-2" />
                불러오는 중...
              </div>
            ) : userTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">저장된 템플릿이 없습니다</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {userTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleApply(t.pages, t.id)}
                    disabled={applying !== null}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-transparent hover:border-violet-400 transition-all active:scale-95 disabled:opacity-60 bg-gray-800"
                  >
                    <div className="aspect-[3/4] w-full relative overflow-hidden">
                      {t.pages[0]?.bgImage && (
                        <img src={t.pages[0].bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      )}
                      <div className="absolute inset-0" style={{ background: t.pages[0]?.overlay || 'rgba(0,0,0,0.5)' }} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                        <div className="text-white text-[9px] font-bold text-center leading-tight drop-shadow px-1">
                          {t.pages[0]?.title?.slice(0, 15) || t.name}
                        </div>
                      </div>
                      {applying === t.id && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 text-center">
                      <span className="text-[10px] font-bold text-white/90 line-clamp-1">{t.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Crop Modal ────────────────────────────────────────────────────────────────
function CropModal({ imageSrc, onClose }: { imageSrc: string; onClose: () => void }) {
  const [cropTab, setCropTab] = useState<'자르기' | '조정'>('자르기');
  const [ratio, setRatio] = useState<'자유' | '1:1' | '4:5' | '9:16' | '16:9'>('자유');

  const ratios = ['자유', '1:1', '4:5', '9:16', '16:9'] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">이미지 편집</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['자르기', '조정'] as const).map(t => (
            <button
              key={t}
              onClick={() => setCropTab(t)}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${cropTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {t === '자르기' ? <Crop size={14} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>}
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">
          {cropTab === '자르기' && (
            <>
              {/* Ratio selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">비율:</span>
                <div className="flex gap-1.5">
                  {ratios.map(r => (
                    <button
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${ratio === r ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview image */}
              <div className="relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '360px' }}>
                <img src={imageSrc} alt="crop preview" className="max-w-full max-h-80 object-contain" />
                {/* Crop overlay */}
                <div className="absolute inset-6 border-2 border-white/90 rounded cursor-move" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
                  {/* Corner handles */}
                  {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                    <div key={i} className={`absolute w-4 h-4 bg-white rounded-sm ${pos} -translate-x-0.5 -translate-y-0.5`} />
                  ))}
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/20" />
                    ))}
                  </div>
                </div>
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/80 text-xs">이미지 위에서 드래그하여 자르기 영역을 선택하세요</p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="반시계 회전"><RotateCcw size={16} /></button>
                  <button className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="시계 회전">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                  <div className="w-px bg-gray-200 mx-1" />
                  <button className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="좌우 반전">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3"/><path d="M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3"/><path d="M12 20V4"/></svg>
                  </button>
                  <button className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="상하 반전">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3"/><path d="M21 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3"/><path d="M4 12h16"/></svg>
                  </button>
                  <button className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-600 font-medium">초기화</button>
                </div>
              </div>
            </>
          )}

          {cropTab === '조정' && (
            <div className="space-y-4">
              {[
                { label: '밝기', value: 0, min: -100, max: 100 },
                { label: '대비', value: 0, min: -100, max: 100 },
                { label: '채도', value: 0, min: -100, max: 100 },
                { label: '선명도', value: 0, min: 0, max: 100 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-600 w-14 shrink-0">{item.label}</span>
                  <input type="range" min={item.min} max={item.max} defaultValue={item.value} className="flex-1 accent-primary-600" />
                  <span className="text-sm text-gray-500 w-8 text-right">0</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={onClose} className="px-5 py-2.5 bg-primary-600 rounded-xl text-sm font-semibold text-white hover:bg-primary-700 shadow-sm">저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── Image Panel ──────────────────────────────────────────────────────────────
type UnsplashPhoto = { id: string; url: string; thumbUrl: string; fullUrl: string; author: string; authorUrl: string; color: string; description: string };

function ImagePanel({
  layer,
  currentImageUrl,
  cardContent,
  imageKeyword,
  initialScale,
  initialPosition,
  initialBrightness,
  initialBrightnessFilter,
  initialOverlayOpacity,
  initialBlocksOffsetY,
  onSelectImage,
  onDeselect,
  onUpdateBgTransform,
  onUpdateBrightness,
  onUpdateBrightnessFilter,
  onUpdateOverlayOpacity,
  onUpdateBlocksOffsetY,
  onApplySettingsAll,
}: {
  layer: CanvasLayer;
  currentImageUrl?: string;
  cardContent?: string;
  imageKeyword?: string;
  initialScale?: number;
  initialPosition?: { x: number; y: number };
  initialBrightness?: number;
  initialBrightnessFilter?: number;
  initialOverlayOpacity?: number;
  initialBlocksOffsetY?: number;
  onSelectImage?: (url: string) => void;
  onDeselect: () => void;
  onUpdateBgTransform?: (scale: number, pos: { x: number; y: number }) => void;
  onUpdateBrightness?: (brightness: number) => void;
  onUpdateBrightnessFilter?: (v: number) => void;
  onUpdateOverlayOpacity?: (v: number) => void;
  onUpdateBlocksOffsetY?: (v: number) => void;
  onApplySettingsAll?: (settings: { bgBrightness: number; bgBrightnessFilter: number; overlayOpacity: number }) => void;
}) {
  const [focusDot, setFocusDot] = useState(initialPosition ?? { x: 50, y: 50 });
  // zoom 0-100 → bgScale 1.0-2.5
  const scaleToZoom = (s: number) => Math.round(((s - 1) / 1.5) * 100);
  const [zoom, setZoom] = useState(initialScale ? scaleToZoom(initialScale) : 0);
  const [brightness, setBrightness] = useState(initialBrightness ?? 0);
  const [brightnessFilter, setBrightnessFilter] = useState(initialBrightnessFilter ?? 100);
  const [overlayOpacity, setOverlayOpacity] = useState(initialOverlayOpacity ?? 100);
  const [blocksOffsetY, setBlocksOffsetY] = useState(initialBlocksOffsetY ?? 70);

  useEffect(() => {
    if (initialBlocksOffsetY !== undefined) {
      setBlocksOffsetY(initialBlocksOffsetY);
    }
  }, [initialBlocksOffsetY]);

  const [imgTab, setImgTab] = useState<ImageTab>('상업사용');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedQuery, setSuggestedQuery] = useState('');
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [showCropModal, setShowCropModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRatio, setAiRatio] = useState('4:5');
  const [aiCount, setAiCount] = useState(1);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedUrls, setAiGeneratedUrls] = useState<string[]>([]);
  const [aiError, setAiError] = useState('');
  const [applyAllDone, setApplyAllDone] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError('');
    setAiGeneratedUrls([]);
    try {
      const res = await fetch('/api/generate/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, ratio: aiRatio, count: aiCount }),
      });
      const data = await res.json();
      if (data.error) { setAiError(friendlyError(data.error)); return; }
      setAiGeneratedUrls(data.urls || []);
    } catch (e: any) {
      setAiError(friendlyError(e));
    } finally {
      setAiGenerating(false);
    }
  };
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  // Unsplash 추천 이미지 상태
  const [unsplashPhotos, setUnsplashPhotos] = useState<UnsplashPhoto[]>([]);
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [unsplashTotal, setUnsplashTotal] = useState(0);
  const [aiRecommendPhotos, setAiRecommendPhotos] = useState<UnsplashPhoto[]>([]);
  const [aiRecommendLoading, setAiRecommendLoading] = useState(false);
  const hasLoadedRecommend = useRef(false);
  const [assetFiles, setAssetFiles] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);
  const hasAutoSearched = useRef(false);

  const searchPexels = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pexels?query=${encodeURIComponent(q)}&page=${p}&per_page=9`);
      const data = await res.json();
      if (p === 1) {
        setPhotos(data.photos || []);
      } else {
        setPhotos(prev => [...prev, ...(data.photos || [])]);
      }
      setTotalResults(data.total_results || 0);
      setPage(p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Unsplash 검색
  const searchUnsplash = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) return;
    setUnsplashLoading(true);
    try {
      const res = await fetch(`/api/images/search?query=${encodeURIComponent(q)}&per_page=9&page=${p}&orientation=portrait`);
      const data = await res.json();
      if (p === 1) setUnsplashPhotos(data.photos || []);
      else setUnsplashPhotos(prev => [...prev, ...(data.photos || [])]);
      setUnsplashTotal(data.total || 0);
      setUnsplashPage(p);
    } catch { /* ignore */ } finally {
      setUnsplashLoading(false);
    }
  }, []);

  // imageKeyword로 AI 추천 이미지 자동 로드
  useEffect(() => {
    if (hasLoadedRecommend.current || !imageKeyword) return;
    hasLoadedRecommend.current = true;
    const load = async () => {
      setAiRecommendLoading(true);
      try {
        const res = await fetch(`/api/images/search?query=${encodeURIComponent(imageKeyword)}&per_page=6&orientation=portrait`);
        const data = await res.json();
        setAiRecommendPhotos(data.photos || []);
      } catch { /* ignore */ } finally {
        setAiRecommendLoading(false);
      }
    };
    load();
  }, [imageKeyword]);

  // 마운트 시 카드 텍스트(주제) 또는 이미지를 Claude로 분석 → Pexels 자동 검색
  useEffect(() => {
    if (hasAutoSearched.current) return;
    if (!cardContent && !currentImageUrl) return;
    hasAutoSearched.current = true;

    const analyze = async () => {
      setAnalyzeLoading(true);
      try {
        const body = cardContent
          ? { cardContent }
          : { imageUrl: currentImageUrl };

        const res = await fetch('/api/suggest-image-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.query) {
          setSuggestedQuery(data.query);
          setSearchQuery(data.query);
          await searchPexels(data.query, 1);
        }
      } catch { /* ignore */ } finally {
        setAnalyzeLoading(false);
      }
    };

    analyze();
  }, [cardContent, currentImageUrl, searchPexels]);

  const handleSearch = () => {
    setSuggestedQuery('');
    searchPexels(searchQuery, 1);
  };
  const handleLoadMore = () => searchPexels(searchQuery, page + 1);

  const handleFocusClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const newPos = {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
    };
    setFocusDot(newPos);
    const scale = 1 + (zoom / 100) * 1.5;
    onUpdateBgTransform?.(scale, newPos);
  };

  const handleZoomChange = (val: number) => {
    setZoom(val);
    const scale = 1 + (val / 100) * 1.5;
    onUpdateBgTransform?.(scale, focusDot);
  };

  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    onUpdateBrightness?.(val);
  };

  const handleBrightnessFilterChange = (val: number) => {
    setBrightnessFilter(val);
    onUpdateBrightnessFilter?.(val);
  };

  const handleOverlayOpacityChange = (val: number) => {
    setOverlayOpacity(val);
    onUpdateOverlayOpacity?.(val);
  };

  // 에셋 마운트 시 localStorage에서 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor_assets');
      if (saved) setAssetFiles(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveAssets = (files: string[]) => {
    try { localStorage.setItem('editor_assets', JSON.stringify(files)); } catch { /* ignore */ }
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setIsUploadingAsset(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch('/api/upload-image', { method: 'POST', body: form });
          const data = await res.json();
          if (data.url) { uploaded.push(data.url); continue; }
        } catch { /* fallback */ }
        // Supabase 실패 → data URL (세션 내 유효)
        const dataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        uploaded.push(dataUrl);
      }
      setAssetFiles(prev => {
        const next = [...prev, ...uploaded];
        saveAssets(next);
        return next;
      });
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleDeleteAsset = (idx: number) => {
    setAssetFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      saveAssets(next);
      return next;
    });
  };

  const imgTabs: { key: ImageTab; label: string }[] = [
    { key: '상업사용', label: 'Pexels' },
    { key: '인터넷', label: 'Unsplash' },
    { key: '에셋', label: '내 에셋' },
    { key: 'AI생성', label: 'AI 생성' },
  ];

  return (
    <>
      {showCropModal && (
        <CropModal
          imageSrc={currentImageUrl || 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=800&q=80'}
          onClose={() => setShowCropModal(false)}
        />
      )}

      <div className="flex flex-col overflow-y-auto h-full">
        {/* Layer header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
          <GripVertical size={14} className="text-gray-300 shrink-0" />
          <span className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center shrink-0">
            <ImageIcon size={12} className="text-blue-600" />
          </span>
          <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{layer.label}</span>
          <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><Maximize2 size={13} /></button>
          <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><Copy size={13} /></button>
          <button className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={13} /></button>
          <button onClick={onDeselect} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronDown size={14} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* 내 이미지로 교체 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              내 이미지로 교체
            </button>
            <button
              onClick={() => setShowCropModal(true)}
              className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-primary-600" title="자르기"
            >
              <Crop size={14} />
            </button>
            <button className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500" title="지우개">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16l13-13 4 4z"/><path d="M6 11l7 7"/></svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" />
          </div>

          {/* 초점 위치 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <RotateCcw size={12} className="text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">초점 위치</span>
              </div>
              <span className="text-[11px] text-gray-400">클릭하여 초점을 설정하세요</span>
            </div>
            <div className="flex gap-2">
              {/* Interactive focus image */}
              <div
                onClick={handleFocusClick}
                className="relative flex-1 overflow-hidden rounded-lg cursor-crosshair select-none"
                style={{ aspectRatio: '4/3' }}
              >
                <img
                  src={currentImageUrl || 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=600&q=70'}
                  alt="초점 설정"
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=600&q=70'; }}
                />
                <div className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none" style={{ left: `${focusDot.x}%` }} />
                <div className="absolute left-0 right-0 h-px bg-white/80 pointer-events-none" style={{ top: `${focusDot.y}%` }} />
                <div
                  className="absolute w-5 h-5 rounded-full bg-primary-600 border-2 border-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                  style={{ left: `${focusDot.x}%`, top: `${focusDot.y}%` }}
                />
              </div>

              {/* Zoom slider column */}
              <div className="flex flex-col items-center gap-1.5 w-12 shrink-0 pt-1">
                <div className="flex items-center gap-1">
                  <Search size={10} className="text-gray-500" />
                  <span className="text-[10px] text-gray-500 font-medium">확대</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range" min={0} max={100} value={zoom}
                    onChange={e => handleZoomChange(Number(e.target.value))}
                    className="h-24 accent-primary-600"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '6px' }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1 py-0.5 rounded">{(1 + (zoom / 100) * 1.5).toFixed(1)}x</span>
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    onClick={() => setShowCropModal(true)}
                    className="p-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-white shadow-sm" title="자르기">
                    <Maximize2 size={11} />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="맞춤"><Minimize2 size={11} /></button>
                  <button onClick={() => { const pos = { x: 50, y: 50 }; setFocusDot(pos); setZoom(0); onUpdateBgTransform?.(1, pos); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="초기화"><RotateCcw size={11} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* 밝기·오버레이 카드 */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* 카드 헤더 */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-[11px] font-bold text-gray-600">밝기 · 오버레이 설정</span>
              <span className="text-[10px] text-gray-400">현재 슬라이드</span>
            </div>

            <div className="p-3 space-y-4">
              {/* 배경 밝기 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-700">배경 밝기</span>
                  <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{brightness}%</span>
                </div>
                <input
                  type="range" min={0} max={90} value={brightness}
                  onChange={e => { handleBrightnessChange(Number(e.target.value)); setApplyAllDone(false); }}
                  className="w-full accent-gray-700 h-1.5"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[0, 20, 40, 60, 75].map(v => (
                    <button key={v} onClick={() => { handleBrightnessChange(v); setApplyAllDone(false); }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${brightness === v ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {v === 0 ? '원본' : `${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 밝기 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-700">이미지 밝기</span>
                  <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{brightnessFilter}%</span>
                </div>
                <input
                  type="range" min={30} max={250} value={brightnessFilter}
                  onChange={e => { handleBrightnessFilterChange(Number(e.target.value)); setApplyAllDone(false); }}
                  className="w-full accent-yellow-500 h-1.5"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[50, 75, 100, 150, 200].map(v => (
                    <button key={v} onClick={() => { handleBrightnessFilterChange(v); setApplyAllDone(false); }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${brightnessFilter === v ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {v === 100 ? '원본' : `${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 오버레이 투명도 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-700">오버레이 투명도</span>
                  <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{overlayOpacity}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={overlayOpacity}
                  onChange={e => { handleOverlayOpacityChange(Number(e.target.value)); setApplyAllDone(false); }}
                  className="w-full accent-blue-500 h-1.5"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[0, 30, 60, 80, 100].map(v => (
                    <button key={v} onClick={() => { handleOverlayOpacityChange(v); setApplyAllDone(false); }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${overlayOpacity === v ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {v === 100 ? '최대' : v === 0 ? '없음' : `${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 블록 위치 (blocks가 있는 경우에만) */}
              {initialBlocksOffsetY !== undefined && onUpdateBlocksOffsetY && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-700">블록 상하 위치</span>
                    <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{blocksOffsetY}%</span>
                  </div>
                  <input
                    type="range" min={10} max={90} value={blocksOffsetY}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setBlocksOffsetY(v);
                      onUpdateBlocksOffsetY(v);
                      setApplyAllDone(false);
                    }}
                    className="w-full accent-violet-600 h-1.5"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[20, 40, 60, 70, 80].map(v => (
                      <button key={v} onClick={() => { setBlocksOffsetY(v); onUpdateBlocksOffsetY(v); setApplyAllDone(false); }}
                        className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${blocksOffsetY === v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 일괄 적용 버튼 */}
            {onApplySettingsAll && (
              <button
                onClick={() => {
                  onApplySettingsAll({ bgBrightness: brightness, bgBrightnessFilter: brightnessFilter, overlayOpacity });
                  setApplyAllDone(true);
                  setTimeout(() => setApplyAllDone(false), 2500);
                }}
                className={`w-full py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  applyAllDone
                    ? 'bg-green-500 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white'
                }`}
              >
                {applyAllDone ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    전체 슬라이드에 적용됨!
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    전체 슬라이드에 일괄 적용
                  </>
                )}
              </button>
            )}
          </div>

          {/* AI 추천 이미지 (imageKeyword가 있을 때만 표시) */}
          {(aiRecommendPhotos.length > 0 || aiRecommendLoading) && (
            <div className="border border-primary-100 rounded-xl overflow-hidden bg-primary-50/40">
              <div className="flex items-center justify-between px-3 py-2 border-b border-primary-100">
                <div className="flex items-center gap-1.5">
                  <Wand2 size={12} className="text-primary-600" />
                  <span className="text-[11px] font-bold text-primary-700">AI 추천 이미지</span>
                  {imageKeyword && <span className="text-[10px] text-primary-400 bg-primary-100 px-1.5 py-0.5 rounded">"{imageKeyword}"</span>}
                </div>
                <button
                  onClick={() => {
                    hasLoadedRecommend.current = false;
                    setAiRecommendPhotos([]);
                    if (imageKeyword) {
                      setAiRecommendLoading(true);
                      fetch(`/api/images/search?query=${encodeURIComponent(imageKeyword)}&per_page=6&orientation=portrait`)
                        .then(r => r.json()).then(d => setAiRecommendPhotos(d.photos || []))
                        .catch(() => {}).finally(() => setAiRecommendLoading(false));
                    }
                  }}
                  className="p-1 hover:bg-primary-100 rounded text-primary-500" title="새로 추천"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
              <div className="p-2">
                {aiRecommendLoading ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <Loader2 size={14} className="text-primary-500 animate-spin" />
                    <span className="text-[11px] text-primary-600">Unsplash에서 추천 이미지 검색 중...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {aiRecommendPhotos.map(photo => (
                      <div
                        key={photo.id}
                        className="group relative cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all"
                        style={{ aspectRatio: '4/5', background: photo.color }}
                        onClick={() => onSelectImage?.(photo.url)}
                      >
                        <img src={photo.thumbUrl} alt={photo.description} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                          <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md">
                            <Check size={12} className="text-primary-600" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[9px] text-white truncate">{photo.author}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-primary-400 text-center mt-1.5">Unsplash 제공 · 클릭하면 즉시 적용</p>
              </div>
            </div>
          )}

          {/* 이미지 탭 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Tab row */}
            <div className="grid grid-cols-4 border-b border-gray-100">
              {imgTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setImgTab(tab.key);
                    if (tab.key === '인터넷' && unsplashPhotos.length === 0 && imageKeyword) {
                      setUnsplashQuery(imageKeyword);
                      searchUnsplash(imageKeyword, 1);
                    }
                  }}
                  className={`py-2 text-[11px] font-semibold transition-colors border-r border-gray-100 last:border-r-0 ${imgTab === tab.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3">
              {/* Pexels 탭 */}
              {imgTab === '상업사용' && (
                <div className="space-y-3">
                  {/* 분석 중 상태 */}
                  {analyzeLoading && (
                    <div className="flex items-center gap-3 py-3 px-3 bg-primary-50 rounded-xl border border-primary-100">
                      <Loader2 size={16} className="text-primary-600 animate-spin shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-primary-700">현재 이미지 분석 중...</p>
                        <p className="text-[11px] text-primary-500">AI가 이미지를 분석하여 유사한 이미지를 찾고 있어요</p>
                      </div>
                    </div>
                  )}

                  {/* AI 추천 쿼리 뱃지 */}
                  {suggestedQuery && !analyzeLoading && photos.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-xl border border-primary-100">
                      <Wand2 size={13} className="text-primary-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-primary-600 block">AI 분석 결과</span>
                        <span className="text-[12px] text-primary-800 font-medium truncate block">{suggestedQuery}</span>
                      </div>
                      <button
                        onClick={() => { setSuggestedQuery(''); setPhotos([]); setSearchQuery(''); }}
                        className="text-primary-400 hover:text-primary-600 shrink-0"
                        title="초기화"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Search bar */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100">
                      <Search size={13} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                        placeholder={analyzeLoading ? '분석 중...' : '다른 키워드로 검색...'}
                        disabled={analyzeLoading}
                        className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={loading || analyzeLoading}
                      className="px-3 py-2 bg-gray-900 rounded-lg hover:bg-gray-700 text-white disabled:opacity-40 transition-colors"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    </button>
                  </div>

                  {/* License notice */}
                  <div className="flex items-start gap-1.5">
                    <span className="text-yellow-500 text-[11px] shrink-0">⚠</span>
                    <p className="text-[11px] text-gray-400">제공자의 라이선스 범위 내에서 사용할 수 있습니다.</p>
                  </div>

                  {/* Results */}
                  {photos.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-[#05A081] rounded flex items-center justify-center shrink-0">
                            <span className="text-white font-black text-[10px]">P</span>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-600">{totalResults.toLocaleString()}개 이미지 검색됨</span>
                        </div>
                        <button onClick={() => { setPhotos([]); setTotalResults(0); setSuggestedQuery(''); }} className="text-gray-400 hover:text-gray-600">
                          <X size={13} />
                        </button>
                      </div>

                      {/* 3-column grid with photographer name always visible */}
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map(photo => (
                          <div
                            key={photo.id}
                            className="group cursor-pointer"
                            onClick={() => onSelectImage?.(photo.src.large)}
                          >
                            <div className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all aspect-square">
                              <img
                                src={photo.src.medium}
                                alt={photo.alt}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />
                              {/* Hover overlay with check */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                <div className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                                  <Check size={14} className="text-primary-600" />
                                </div>
                              </div>
                            </div>
                            {/* Photographer name always visible below */}
                            <p className="text-[10px] text-gray-500 truncate mt-1 px-0.5">{photo.photographer}</p>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-gray-400">Pexels 제공</p>
                        {photos.length < totalResults && (
                          <button
                            onClick={handleLoadMore}
                            disabled={loading}
                            className="flex items-center gap-1 text-[11px] text-primary-600 font-semibold hover:text-primary-700 disabled:opacity-50"
                          >
                            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                            더보기
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {photos.length === 0 && !loading && !analyzeLoading && searchQuery && (
                    <div className="text-center py-8 text-gray-400">
                      <Search size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">검색 결과가 없습니다</p>
                    </div>
                  )}

                  {photos.length === 0 && !loading && !analyzeLoading && !searchQuery && (
                    <div className="text-center py-8 text-gray-300">
                      <Search size={28} className="mx-auto mb-2" />
                      <p className="text-sm text-gray-400">키워드를 입력하고 검색하세요</p>
                      <p className="text-[11px] text-gray-300 mt-1">예: business meeting, nature, city</p>
                    </div>
                  )}
                </div>
              )}

              {/* Unsplash 탭 */}
              {imgTab === '인터넷' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100">
                      <Search size={13} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={unsplashQuery}
                        onChange={e => setUnsplashQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { setUnsplashPhotos([]); searchUnsplash(unsplashQuery, 1); } }}
                        placeholder="영어 키워드로 검색..."
                        className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
                      />
                    </div>
                    <button
                      onClick={() => { setUnsplashPhotos([]); searchUnsplash(unsplashQuery, 1); }}
                      disabled={unsplashLoading || !unsplashQuery.trim()}
                      className="px-3 py-2 bg-gray-900 rounded-lg hover:bg-gray-700 text-white disabled:opacity-40 transition-colors"
                    >
                      {unsplashLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    </button>
                  </div>

                  {unsplashLoading && unsplashPhotos.length === 0 && (
                    <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Unsplash 검색 중...</span>
                    </div>
                  )}

                  {unsplashPhotos.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-1.5">
                        {unsplashPhotos.map(photo => (
                          <div
                            key={photo.id}
                            className="group relative cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all"
                            style={{ aspectRatio: '4/5', background: photo.color }}
                            onClick={() => onSelectImage?.(photo.url)}
                          >
                            <img src={photo.thumbUrl} alt={photo.description} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                              <div className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md">
                                <Check size={14} className="text-primary-600" />
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[9px] text-white truncate">{photo.author}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-gray-400">Unsplash 제공 · 무료 상업 사용 가능</p>
                        {unsplashPhotos.length < unsplashTotal && (
                          <button
                            onClick={() => searchUnsplash(unsplashQuery, unsplashPage + 1)}
                            disabled={unsplashLoading}
                            className="flex items-center gap-1 text-[11px] text-primary-600 font-semibold hover:text-primary-700 disabled:opacity-50"
                          >
                            {unsplashLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                            더보기
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {unsplashPhotos.length === 0 && !unsplashLoading && (
                    <div className="text-center py-8 text-gray-300">
                      <svg className="w-7 h-7 mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></svg>
                      <p className="text-sm text-gray-400 mt-1">Unsplash 이미지 검색</p>
                      <p className="text-[11px] text-gray-300 mt-1">예: mountains, coffee shop, abstract</p>
                    </div>
                  )}
                </div>
              )}

              {/* 내 에셋 탭 */}
              {imgTab === '에셋' && (
                <div className="space-y-3">
                  {/* 드래그앤드롭 업로드 존 */}
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer group"
                    onClick={() => assetRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500', 'bg-primary-50'); }}
                    onDragLeave={e => { e.currentTarget.classList.remove('border-primary-500', 'bg-primary-50'); }}
                    onDrop={async e => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-primary-500', 'bg-primary-50');
                      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                      if (files.length === 0) return;
                      const fakeEvent = { target: { files, value: '' } } as any;
                      await handleAssetUpload(fakeEvent);
                    }}
                  >
                    {isUploadingAsset ? (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Loader2 size={16} className="text-primary-500 animate-spin" />
                        <span className="text-sm text-primary-600 font-medium">업로드 중...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-gray-100 group-hover:bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-1.5 transition-colors">
                          <ImageIcon size={16} className="text-gray-400 group-hover:text-primary-500" />
                        </div>
                        <p className="text-[11px] font-semibold text-gray-500 group-hover:text-primary-600">클릭 또는 드래그로 업로드</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, WebP · 여러 파일 가능</p>
                      </>
                    )}
                  </div>

                  {assetFiles.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-1.5">
                        {assetFiles.map((src, i) => (
                          <div
                            key={i}
                            className="group relative rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary-500 transition-all"
                            style={{ aspectRatio: '4/5' }}
                            onClick={() => onSelectImage?.(src)}
                          >
                            <img src={src} alt="asset" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                              <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md">
                                <Check size={12} className="text-primary-600" />
                              </div>
                            </div>
                            {/* 삭제 버튼 */}
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteAsset(i); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-400 text-center">클릭하면 배경에 즉시 적용됩니다</p>
                    </>
                  )}
                  <input ref={assetRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAssetUpload} />
                </div>
              )}

              {/* AI 생성 탭 */}
              {imgTab === 'AI생성' && (
                <div className="space-y-4">
                  {/* Warning */}
                  <div className="flex items-start gap-1.5 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-amber-500 text-xs shrink-0 mt-0.5">⚠</span>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      상업적 사용은 가능하지만 프롬프트, 업로드한 입력 이미지, 로고, 인물 초상, 최종 사용 방식의 관리 확인은 사용자 책임입니다. 일부 국가에서는 순수 AI 생성물 자체가 저작권 보호 대상이 아닐 수 있습니다.
                    </p>
                  </div>

                  {/* Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-gray-600">원하는 이미지를 설명하세요</label>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">GPT Image 2</span>
                    </div>
                    <textarea
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="business strategy meeting discussion"
                      className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none resize-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all placeholder:text-gray-300"
                      rows={3}
                    />
                  </div>

                  {/* Ratio + Count */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-gray-600">이미지 비율</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-600">생성 장수</span>
                        <button onClick={() => setAiCount(c => Math.max(1, c - 1))} className="w-6 h-6 border border-gray-200 rounded flex items-center justify-center text-gray-600 hover:bg-gray-50 text-xs font-bold">−</button>
                        <span className="text-sm font-semibold w-4 text-center">{aiCount}</span>
                        <button onClick={() => setAiCount(c => Math.min(4, c + 1))} className="w-6 h-6 border border-gray-200 rounded flex items-center justify-center text-gray-600 hover:bg-gray-50 text-xs font-bold">+</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {['1:1', '4:5', '3:4', '16:9', '9:16'].map(r => (
                        <button
                          key={r}
                          onClick={() => setAiRatio(r)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${aiRatio === r ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          <span className={`inline-block border-2 border-current rounded-sm ${r === '1:1' ? 'w-3 h-3' : r === '4:5' ? 'w-2.5 h-3.5' : r === '3:4' ? 'w-2.5 h-3' : r === '16:9' ? 'w-4 h-2.5' : 'w-2.5 h-4'}`} />
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference image */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1.5">참고 이미지 (선택)</label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary-300 transition-colors cursor-pointer">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <ImageIcon size={16} className="text-gray-400" />
                      </div>
                      <p className="text-[11px] text-gray-400 text-center">참고할 이미지를 업로드하면 해당 이미지 기반으로 생성합니다</p>
                    </div>
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="w-full py-3 bg-primary-600 rounded-xl text-sm font-bold text-white hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating ? (
                      <>
                        <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        생성 중... (최대 30초)
                      </>
                    ) : (
                      <>
                        <Wand2 size={15} />
                        생성하기 ({aiCount * 5} 크레딧)
                      </>
                    )}
                  </button>

                  {/* Error */}
                  {aiError && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{aiError}</p>
                  )}

                  {/* Generated results */}
                  {aiGeneratedUrls.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-600 mb-2">생성된 이미지 — 클릭하여 적용</p>
                      <div className={`grid gap-2 ${aiGeneratedUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {aiGeneratedUrls.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => onSelectImage?.(url)}
                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all group"
                          >
                            <img src={url} alt={`AI 생성 이미지 ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold bg-black/50 px-2 py-1 rounded-full transition-opacity">적용</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 요소 추가 */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[11px] font-semibold text-gray-500 mb-2">요소 추가</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: <Type size={14} />, label: '텍스트' },
                { icon: <ImageIcon size={14} />, label: '이미지' },
                { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2"/></svg>, label: '로고' },
                { icon: <Film size={14} />, label: '영상' },
              ].map(item => (
                <button key={item.label} className="flex flex-col items-center gap-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600 transition-colors">
                  {item.icon}
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// fontWeight 레이블 ↔ CSS 값 변환
const ELEM_SHAPES = [
  { key: 'circle' as const, label: '원' },
  { key: 'rect' as const, label: '사각형' },
  { key: 'triangle' as const, label: '삼각형' },
  { key: 'star' as const, label: '별' },
  { key: 'diamond' as const, label: '다이아' },
  { key: 'heart' as const, label: '하트' },
];
const ELEM_EMOJIS = ['✨','⭐','🔥','💡','🎯','📌','💫','❤️','🌟','💎','🚀','🎉','💬','📊','✅','🎨','🏆','🌈','🍀','🦋','💪','🎁','🔮','⚡'];
const ELEM_COLORS = ['#FFFFFF','#000000','#ffd700','#E1306C','#7c3aed','#2563eb','#16a34a','#dc2626'];

function ShapeSVG({ shape, color }: { shape: string; color: string }) {
  const fill = color || '#6366f1';
  if (shape === 'circle') return <svg viewBox="0 0 100 100" className="w-full h-full"><circle cx="50" cy="50" r="47" fill={fill} /></svg>;
  if (shape === 'rect') return <svg viewBox="0 0 100 100" className="w-full h-full"><rect x="4" y="4" width="92" height="92" rx="10" fill={fill} /></svg>;
  if (shape === 'triangle') return <svg viewBox="0 0 100 100" className="w-full h-full"><polygon points="50,5 95,90 5,90" fill={fill} /></svg>;
  if (shape === 'star') return <svg viewBox="0 0 100 100" className="w-full h-full"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} /></svg>;
  if (shape === 'diamond') return <svg viewBox="0 0 100 100" className="w-full h-full"><polygon points="50,5 95,50 50,95 5,50" fill={fill} /></svg>;
  if (shape === 'heart') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d="M50 85 C20 65 5 50 5 32 A25 25 0 0 1 50 20 A25 25 0 0 1 95 32 C95 50 80 65 50 85Z" fill={fill} /></svg>;
  return null;
}

const TEXT_PRESETS = [
  { label: '제목', fontSize: 38, fontWeight: '900', color: '#FFFFFF', width: 85 },
  { label: '소제목', fontSize: 20, fontWeight: '700', color: '#FFFFFF', width: 80 },
  { label: '본문', fontSize: 14, fontWeight: '400', color: '#FFFFFF', width: 75 },
  { label: '강조', fontSize: 28, fontWeight: '900', color: '#FFD700', width: 70 },
];

function ElementPanel({
  onAdd, selectedElement, onUpdateElement, onDeleteElement,
}: {
  onAdd: (elem: Omit<CanvasElement, 'id'>) => void;
  selectedElement?: CanvasElement | null;
  onUpdateElement?: (id: string, updates: Partial<CanvasElement>) => void;
  onDeleteElement?: (id: string) => void;
}) {
  const [elemTab, setElemTab] = useState<'text' | 'shape' | 'emoji'>('text');
  const [color, setColor] = useState('#FFFFFF');

  return (
    <div className="flex flex-col overflow-y-auto h-full">

      {/* ── 선택된 요소 편집 패널 ── */}
      {selectedElement && onUpdateElement && onDeleteElement && (
        <div className="p-4 space-y-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-700">
              {selectedElement.type === 'text' ? '텍스트 편집' : selectedElement.type === 'shape' ? '도형 편집' : '이모지 편집'}
            </span>
            <button onClick={() => onDeleteElement(selectedElement.id)} className="px-2 py-1 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg border border-red-200">삭제</button>
          </div>

          {/* ── 텍스트 전용 컨트롤 ── */}
          {selectedElement.type === 'text' && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">텍스트 내용</label>
                <textarea
                  value={selectedElement.text ?? ''}
                  onChange={e => onUpdateElement(selectedElement.id, { text: e.target.value })}
                  rows={3}
                  className="w-full p-2 text-sm bg-white border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-primary-400"
                  placeholder="텍스트를 입력하세요"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">글자 크기 {selectedElement.fontSize ?? 24}px</label>
                <input type="range" min="8" max="72" step="1" value={selectedElement.fontSize ?? 24}
                  onChange={e => onUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">글꼴 굵기</label>
                <div className="flex gap-1.5">
                  {(['300','400','700','900'] as const).map(w => (
                    <button key={w} onClick={() => onUpdateElement(selectedElement.id, { fontWeight: w })}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all ${selectedElement.fontWeight === w ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}
                      style={{ fontWeight: w }}>
                      {w === '300' ? 'L' : w === '400' ? 'R' : w === '700' ? 'B' : 'XB'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">정렬</label>
                <div className="flex gap-1.5">
                  {(['left','center','right'] as const).map(a => (
                    <button key={a} onClick={() => onUpdateElement(selectedElement.id, { textAlign: a })}
                      className={`flex-1 py-1.5 rounded-lg border transition-all text-sm ${selectedElement.textAlign === a ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-500 hover:border-primary-300'}`}>
                      {a === 'left' ? '◀' : a === 'center' ? '■' : '▶'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">텍스트 색상</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ELEM_COLORS.map(c => (
                    <button key={c} onClick={() => onUpdateElement(selectedElement.id, { color: c })} style={{ background: c }}
                      className={`w-6 h-6 rounded-full border-2 shadow-sm transition-all ${selectedElement.color === c ? 'border-primary-600 scale-110' : 'border-gray-300'}`} />
                  ))}
                  <label className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 cursor-pointer overflow-hidden bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 opacity-70">
                    <input type="color" className="sr-only" value={selectedElement.color} onChange={e => onUpdateElement(selectedElement.id, { color: e.target.value })} />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">박스 너비 {selectedElement.width ?? 70}%</label>
                <input type="range" min="20" max="100" step="5" value={selectedElement.width ?? 70}
                  onChange={e => onUpdateElement(selectedElement.id, { width: Number(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">투명도 {Math.round(selectedElement.opacity * 100)}%</label>
                <input type="range" min="0.1" max="1" step="0.05" value={selectedElement.opacity}
                  onChange={e => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
            </>
          )}

          {/* ── 도형/이모지 공통 컨트롤 ── */}
          {selectedElement.type !== 'text' && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">크기 {selectedElement.size}%</label>
                <input type="range" min="5" max="80" step="1" value={selectedElement.size}
                  onChange={e => onUpdateElement(selectedElement.id, { size: Number(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">투명도 {Math.round(selectedElement.opacity * 100)}%</label>
                <input type="range" min="0.1" max="1" step="0.05" value={selectedElement.opacity}
                  onChange={e => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) })}
                  className="w-full accent-primary-600" />
              </div>
              {selectedElement.type === 'shape' && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">색상</label>
                  <div className="flex gap-2 flex-wrap">
                    {ELEM_COLORS.map(c => (
                      <button key={c} onClick={() => onUpdateElement(selectedElement.id, { color: c })} style={{ background: c }}
                        className={`w-6 h-6 rounded-full border-2 shadow-sm transition-all ${selectedElement.color === c ? 'border-primary-600 scale-110' : 'border-gray-300'}`} />
                    ))}
                    <label className="w-6 h-6 rounded-full border-2 border-dashed border-gray-400 cursor-pointer overflow-hidden bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 opacity-70">
                      <input type="color" className="sr-only" value={selectedElement.color} onChange={e => onUpdateElement(selectedElement.id, { color: e.target.value })} />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 탭: 텍스트 / 도형 / 이모지 ── */}
      <div className="flex border-b border-gray-100 px-4 pt-3 shrink-0">
        <button onClick={() => setElemTab('text')} className={`mr-4 pb-2 text-[12px] font-bold border-b-2 transition-colors ${elemTab === 'text' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'}`}>텍스트</button>
        <button onClick={() => setElemTab('shape')} className={`mr-4 pb-2 text-[12px] font-bold border-b-2 transition-colors ${elemTab === 'shape' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'}`}>도형</button>
        <button onClick={() => setElemTab('emoji')} className={`pb-2 text-[12px] font-bold border-b-2 transition-colors ${elemTab === 'emoji' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'}`}>이모지</button>
      </div>

      <div className="p-4 space-y-4">
        {/* ── 텍스트 탭 ── */}
        {elemTab === 'text' && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-gray-500">프리셋을 클릭하면 캔버스 중앙에 추가됩니다</p>
            <div className="grid grid-cols-2 gap-2">
              {TEXT_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => onAdd({
                    type: 'text', text: p.label, fontSize: p.fontSize, fontFamily: 'Noto Sans KR',
                    fontWeight: p.fontWeight, textAlign: 'center', width: p.width,
                    color: p.color, x: 50, y: 50, size: 0, opacity: 1,
                  })}
                  className="flex items-center justify-center h-14 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all"
                  style={{ fontSize: Math.min(p.fontSize * 0.4, 20), fontWeight: p.fontWeight, color: '#374151' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="pt-1 border-t border-gray-100">
              <button
                onClick={() => onAdd({ type: 'text', text: '텍스트를 입력하세요', fontSize: 18, fontFamily: 'Noto Sans KR', fontWeight: '400', textAlign: 'center', width: 80, color: '#FFFFFF', x: 50, y: 50, size: 0, opacity: 1 })}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                + 빈 텍스트 추가
              </button>
            </div>
          </div>
        )}

        {/* ── 도형 탭 ── */}
        {elemTab === 'shape' && (
          <>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">추가 색상</label>
              <div className="flex gap-2 flex-wrap">
                {ELEM_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ background: c }}
                    className={`w-6 h-6 rounded-full border-2 shadow-sm transition-all ${color === c ? 'border-primary-600 scale-110' : 'border-gray-200'}`} />
                ))}
                <label className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 cursor-pointer overflow-hidden bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 opacity-70">
                  <input type="color" className="sr-only" value={color} onChange={e => setColor(e.target.value)} />
                </label>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-2 block">도형 클릭 시 캔버스에 추가</label>
              <div className="grid grid-cols-3 gap-2">
                {ELEM_SHAPES.map(s => (
                  <button key={s.key} onClick={() => onAdd({ type: 'shape', shape: s.key, x: 50, y: 50, size: 20, color, opacity: 1 })}
                    className="flex flex-col items-center gap-1.5 p-3 border border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all group">
                    <div className="w-9 h-9"><ShapeSVG shape={s.key} color={color === '#FFFFFF' ? '#6366f1' : color} /></div>
                    <span className="text-[10px] text-gray-500 group-hover:text-primary-600">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 이모지 탭 ── */}
        {elemTab === 'emoji' && (
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-2 block">이모지 클릭 시 캔버스에 추가</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ELEM_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => onAdd({ type: 'emoji', emoji, x: 50, y: 50, size: 12, color: '', opacity: 1 })}
                  className="aspect-square text-xl flex items-center justify-center border border-gray-100 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-all">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const WEIGHT_MAP: Record<string, string> = { L: '300', N: '400', M: '500', SB: '600', B: '900' };
const WEIGHT_LABEL: Record<string, string> = { '300': 'L', '400': 'N', '500': 'M', '600': 'SB', '900': 'B' };

const FONTS = [
  { label: 'Noto Sans KR', value: 'Noto Sans KR' },
  { label: '나눔고딕', value: 'Nanum Gothic' },
  { label: '검은고딕', value: 'Black Han Sans' },
  { label: 'Gothic A1', value: 'Gothic A1' },
  { label: '나눔명조', value: 'Nanum Myeongjo' },
  { label: 'Do Hyeon', value: 'Do Hyeon' },
  { label: 'Jua', value: 'Jua' },
  { label: '고운돋움', value: 'Gowun Dodum' },
] as const;

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;900' +
  '&family=Nanum+Gothic:wght@400;700;800' +
  '&family=Black+Han+Sans' +
  '&family=Gothic+A1:wght@300;400;500;600;700;900' +
  '&family=Nanum+Myeongjo:wght@400;700;800' +
  '&family=Do+Hyeon' +
  '&family=Jua' +
  '&family=Gowun+Dodum' +
  '&display=swap';

// ─── Text Panel ───────────────────────────────────────────────────────────────
function TextPanel({ layer, onDeselect, onUpdate, onApplyStyleAll, pageData, onUpdatePageData }: {
  layer: CanvasLayer;
  onDeselect: () => void;
  onUpdate: (content: string, style: TextStyle) => void;
  onApplyStyleAll?: (layerId: number, style: TextStyle) => void;
  pageData?: PageData;
  onUpdatePageData?: (pageId: string, changes: Partial<PageData>) => void;
}) {
  const [fontSize, setFontSize] = useState(layer.style?.fontSize ?? 38);
  const [fontWeight, setFontWeight] = useState(WEIGHT_LABEL[layer.style?.fontWeight ?? '900'] ?? 'B');
  const [fontFamily, setFontFamily] = useState(layer.style?.fontFamily ?? 'Noto Sans KR');
  const [letterSpacing, setLetterSpacing] = useState(layer.style?.letterSpacing ?? 0);
  const [lineHeight, setLineHeight] = useState(layer.style?.lineHeight ?? 1.2);
  const [selectedColor, setSelectedColor] = useState(layer.style?.color ?? '#FFFFFF');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(layer.style?.align ?? 'left');
  const [textContent, setTextContent] = useState(layer.content || '');
  const [viralHooks, setViralHooks] = useState<string[]>([]);
  const [loadingHookIndex, setLoadingHookIndex] = useState<number | null>(null);

  const handleHookClick = async (hook: string, index: number) => {
    if (loadingHookIndex !== null) return;

    // 1. 즉시 텍스트 버퍼 교체 및 캔버스 제목 변경 (사용성 향상)
    setTextContent(hook);
    if (pageData && onUpdatePageData) {
      onUpdatePageData(pageData.id, { title: hook });
    }

    setLoadingHookIndex(index);
    try {
      const draft = typeof window !== 'undefined' ? localStorage.getItem('cardNewsDraft') : null;
      const topic = draft || pageData?.title || undefined;

      const res = await fetch('/api/generate/hook-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook, topic }),
      });
      const data = await res.json();

      if (data.error) {
        alert(`본문 생성 실패: ${data.error}`);
      } else if (data.body && pageData && onUpdatePageData) {
        // 2. 표지 본문(subtitle)도 AI 생성 결과로 함께 교체
        onUpdatePageData(pageData.id, { subtitle: data.body });
      }
    } catch (err) {
      alert('본문 생성 중 오류가 발생했습니다.');
    } finally {
      setLoadingHookIndex(null);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('cardNewsHooks');
    if (saved) {
      try { setViralHooks(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const isCoverTitle = layer.id === 1;

  // 레이어가 바뀌면 전체 상태 초기화
  useEffect(() => {
    setTextContent(layer.content || '');
    setFontSize(layer.style?.fontSize ?? 38);
    setFontWeight(WEIGHT_LABEL[layer.style?.fontWeight ?? '900'] ?? 'B');
    setFontFamily(layer.style?.fontFamily ?? 'Noto Sans KR');
    setLetterSpacing(layer.style?.letterSpacing ?? 0);
    setLineHeight(layer.style?.lineHeight ?? 1.2);
    setSelectedColor(layer.style?.color ?? '#FFFFFF');
    setAlign(layer.style?.align ?? 'left');
  }, [layer.id, layer.content, layer.style]);

  const colors = ['#FFFFFF', '#000000', '#1a1a2e', '#ffd700', '#7c3aed', '#dc2626', '#2563eb', '#16a34a'];
  const weights = ['L', 'N', 'M', 'SB', 'B'];

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      {/* Layer header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="w-5 h-5 bg-green-100 rounded flex items-center justify-center shrink-0">
          <Type size={12} className="text-green-600" />
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{layer.label}</span>
        <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><Maximize2 size={13} /></button>
        <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><Copy size={13} /></button>
        <button className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={13} /></button>
        <button onClick={onDeselect} className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronDown size={14} /></button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">텍스트 내용</label>
          <textarea value={textContent} onChange={e => setTextContent(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none resize-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100" rows={3} />
        </div>

        {isCoverTitle && viralHooks.length > 0 && (
          <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Wand2 size={13} className="text-primary-600" />
              <span className="text-[11px] font-bold text-primary-700">추천 바이럴 훅 (클릭 시 교체)</span>
            </div>
            <div className="space-y-1.5">
              {viralHooks.map((hook, i) => {
                const isLoading = loadingHookIndex === i;
                return (
                  <button 
                    key={i}
                    onClick={() => handleHookClick(hook, i)}
                    disabled={loadingHookIndex !== null}
                    className={`w-full text-left text-[11px] bg-white border p-2 rounded-lg hover:border-primary-400 hover:text-primary-700 transition-all leading-snug shadow-sm flex items-center justify-between gap-2 ${
                      isLoading ? 'border-primary-400 text-primary-700 bg-primary-50/50' : 'border-primary-100 text-gray-600'
                    } disabled:opacity-75`}
                  >
                    <span className="flex-1">{hook}</span>
                    {isLoading && (
                      <span className="flex items-center gap-1 text-[10px] text-primary-600 font-bold shrink-0">
                        <svg className="animate-spin h-3.5 w-3.5 text-primary-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        생성 중...
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">폰트 선택</label>
          <div className="grid grid-cols-2 gap-1.5">
            {FONTS.map(f => (
              <button
                key={f.value}
                onClick={() => setFontFamily(f.value)}
                style={{ fontFamily: f.value }}
                className={`py-2 px-2 rounded-lg text-xs transition-all truncate text-left ${fontFamily === f.value ? 'bg-primary-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">폰트 굵기</label>
          <div className="flex gap-1.5">
            {weights.map(w => (
              <button key={w} onClick={() => setFontWeight(w)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${fontWeight === w ? 'bg-primary-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'}`}>{w}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">크기</label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setFontSize(s => Math.max(8, s - 2))} className="px-2.5 hover:bg-gray-50 text-gray-500 text-sm font-bold border-r border-gray-200">−</button>
              <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full text-center text-sm outline-none py-2" />
              <button onClick={() => setFontSize(s => s + 2)} className="px-2.5 hover:bg-gray-50 text-gray-500 text-sm font-bold border-l border-gray-200">+</button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">정렬</label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden h-9">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                <button key={a} onClick={() => setAlign(a)} className={`flex-1 flex items-center justify-center transition-colors ${align === a ? 'bg-primary-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}><Icon size={14} /></button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">색상</label>
          <div className="flex gap-2 flex-wrap">
            {colors.map(c => (
              <button key={c} onClick={() => setSelectedColor(c)} style={{ background: c }} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${selectedColor === c ? 'border-primary-600 scale-110 ring-2 ring-primary-200' : 'border-gray-200 hover:scale-105'}`} />
            ))}
            <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary-400 bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 opacity-60 hover:opacity-80">
              <input type="color" className="sr-only" onChange={e => setSelectedColor(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">자간</label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setLetterSpacing(s => Math.max(-10, s - 1))} className="px-2 hover:bg-gray-50 text-gray-500 text-sm font-bold border-r border-gray-200">−</button>
              <span className="flex-1 text-center text-sm py-2">{letterSpacing}</span>
              <button onClick={() => setLetterSpacing(s => s + 1)} className="px-2 hover:bg-gray-50 text-gray-500 text-sm font-bold border-l border-gray-200">+</button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">행간</label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setLineHeight(s => Math.max(0.8, Math.round((s - 0.1) * 10) / 10))} className="px-2 hover:bg-gray-50 text-gray-500 text-sm font-bold border-r border-gray-200">−</button>
              <span className="flex-1 text-center text-sm py-2">{lineHeight.toFixed(1)}</span>
              <button onClick={() => setLineHeight(s => Math.round((s + 0.1) * 10) / 10)} className="px-2 hover:bg-gray-50 text-gray-500 text-sm font-bold border-l border-gray-200">+</button>
            </div>
          </div>
        </div>

        {/* 적용 버튼 영역 */}
        <div className="space-y-2">
          <button
            onClick={() => onUpdate(textContent, {
              fontSize,
              fontWeight: WEIGHT_MAP[fontWeight] ?? '900',
              fontFamily,
              color: selectedColor,
              letterSpacing,
              lineHeight,
              align,
            })}
            className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"
          >
            변경 적용
          </button>
          {onApplyStyleAll && (
            <button
              onClick={() => onApplyStyleAll(layer.id, {
                fontSize,
                fontWeight: WEIGHT_MAP[fontWeight] ?? '900',
                fontFamily,
                color: selectedColor,
                letterSpacing,
                lineHeight,
                align,
              })}
              className="w-full py-2.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              모든 슬라이드에 스타일 적용
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-[11px] font-semibold text-gray-500 mb-2">요소 추가</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { icon: <Type size={14} />, label: '텍스트' },
              { icon: <ImageIcon size={14} />, label: '이미지' },
              { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2"/></svg>, label: '로고' },
              { icon: <Film size={14} />, label: '영상' },
            ].map(item => (
              <button key={item.label} className="flex flex-col items-center gap-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600 transition-colors">
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Default Panel ────────────────────────────────────────────────────────────
function DefaultPanel({ layers, onSelectLayer }: { layers: CanvasLayerWithSrc[]; onSelectLayer: (l: CanvasLayerWithSrc) => void }) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">레이어</h3>
        <div className="space-y-1.5">
          {layers.map(layer => (
            <div key={layer.id} onClick={() => onSelectLayer(layer)} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50/40 group cursor-pointer transition-colors">
              <GripVertical size={13} className="text-gray-300 shrink-0" />
              <span className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${layer.type === 'image' ? 'bg-blue-100' : 'bg-green-100'}`}>
                {layer.type === 'image' ? <ImageIcon size={12} className="text-blue-600" /> : <Type size={12} className="text-green-600" />}
              </span>
              <span className="flex-1 text-sm text-gray-700 truncate">{layer.label}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-0.5 text-gray-400 hover:text-gray-700" onClick={e => e.stopPropagation()}><Copy size={12} /></button>
                <button className="p-0.5 text-red-400 hover:text-red-600" onClick={e => e.stopPropagation()}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-[11px] font-semibold text-gray-500 mb-2">요소 추가</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[{ icon: <Type size={14} />, label: '텍스트' }, { icon: <ImageIcon size={14} />, label: '이미지' }, { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2"/></svg>, label: '로고' }, { icon: <Film size={14} />, label: '영상' }].map(item => (
            <button key={item.label} className="flex flex-col items-center gap-1 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-600 transition-colors">
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
interface AIChatMessage {
  role: 'user' | 'ai';
  content: string;
}

function AIPanel({ pageData, onApplyChanges, messages, setMessages }: {
  pageData: PageData;
  onApplyChanges: (changes: Partial<PageData>) => void;
  messages: AIChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AIChatMessage[]>>;
}) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const quickActions = ['더 밝게', '더 어둡게', '따뜻한 톤', '차가운 톤', '폰트 크게', '폰트 작게'];
  const suggestions = ['배경을 더 밝게 해줘', '제목을 더 크고 굵게 해줘', '따뜻한 분위기로 바꿔줘', '텍스트 색상을 흰색으로 통일해줘'];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai-designer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageData, message: msg }),
      });
      const data = await res.json();
      if (data.changes) {
        onApplyChanges(data.changes);
        setMessages(prev => [...prev, { role: 'ai', content: data.message || '수정을 완료했습니다.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: data.error ?? '수정에 실패했습니다.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: '오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border-b border-primary-100 shrink-0">
        <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center shrink-0"><Wand2 size={14} className="text-primary-600" /></div>
        <div><p className="text-sm font-bold text-gray-800">AI 디자이너</p><p className="text-[11px] text-gray-500">자연어로 수정 요청 → 즉시 반영</p></div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-primary-200 flex items-center justify-center mb-3 bg-primary-50">
              <Wand2 size={20} className="text-primary-500" />
            </div>
            <p className="text-sm font-bold text-gray-700 mb-1">무엇을 수정할까요?</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">배경, 폰트, 색상, 텍스트 내용 등<br />원하는 수정을 말해주세요.</p>
            <div className="mt-4 space-y-1.5 w-full text-left">
              <p className="text-[10px] font-bold text-gray-400 mb-2">💡 예시</p>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="w-full text-left px-3 py-2 text-[12px] text-gray-600 bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors border border-gray-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                <Wand2 size={11} className="text-primary-600" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-sm'
                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2 shrink-0">
              <Wand2 size={11} className="text-primary-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-3 space-y-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap shrink-0">빠른:</span>
          {quickActions.map(a => (
            <button key={a} onClick={() => sendMessage(a)} disabled={isLoading}
              className="whitespace-nowrap px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-600 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 disabled:opacity-40 shrink-0 transition-colors">
              {a}
            </button>
          ))}
        </div>
        <div className="relative border border-primary-300 rounded-xl bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            disabled={isLoading}
            rows={2}
            className="w-full p-3 pr-10 text-sm outline-none resize-none placeholder:text-gray-400 rounded-xl disabled:opacity-50"
            placeholder="수정사항을 입력하세요..."
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="absolute bottom-2.5 right-2.5 w-7 h-7 bg-primary-600 text-white rounded-lg flex items-center justify-center hover:bg-primary-700 active:scale-95 disabled:opacity-40 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400">Enter로 전송 · Shift+Enter로 줄바꿈</p>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function EditorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'edit' | 'ai' | 'element'>('edit');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLayer, setSelectedLayer] = useState<CanvasLayerWithSrc | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draggingElemId, setDraggingElemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [editingElemId, setEditingElemId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number; cw: number; ch: number } | null>(null);
  const canvasElemRef = useRef<HTMLDivElement>(null);
  const [pageImages, setPageImages] = useState<Record<string, string>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(420);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveLocalModal, setShowSaveLocalModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [lastCaption, setLastCaption] = useState('');
  const [lastHashtags, setLastHashtags] = useState<string[]>([]);
  const [isFullscreenEdit, setIsFullscreenEdit] = useState(false);
  const captureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingDrop, setIsUploadingDrop] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<'copied' | 'error' | null>(null);
  const [showSnsModal, setShowSnsModal] = useState(false);
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'edit' | 'element' | 'ai'>('edit');
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([]);

  // ── 자동 저장 ──
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 자동저장 복구 배너
  const [restoreBanner, setRestoreBanner] = useState<{ savedAt: number; pages: PageData[] } | null>(null);

  // ── 슬라이드 드래그 순서 변경 ──
  const [dragThumbId, setDragThumbId] = useState<string | null>(null);
  const [dragOverThumbId, setDragOverThumbId] = useState<string | null>(null);

  // ── 요소 복사·붙여넣기 ──
  const copiedElementRef = useRef<CanvasElement | null>(null);
  const [clipboardToast, setClipboardToast] = useState(false);

  // ── 전체 보기 모드 ──
  const [showGridView, setShowGridView] = useState(false);

  // ── 정렬 가이드 ──
  const [guideLines, setGuideLines] = useState<{ x?: number; y?: number }[]>([]);

  // ── Mutable page data state ──
  const [pagesData, setPagesData] = useState<PageData[]>(PAGES_DATA);
  const historyRef = useRef<PageData[][]>([PAGES_DATA]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [brandKit, setBrandKit] = useState<{ logo: string; color: string; name: string } | null>(null);

  useEffect(() => {
    // 로컬스토리지 우선, 없으면 API에서 로드
    const saved = localStorage.getItem('brand_kit');
    if (saved) {
      try { setBrandKit(JSON.parse(saved)); return; } catch {}
    }
    fetch('/api/brand-kit').then(r => r.json()).then(({ kit }) => {
      if (kit) {
        const loaded = { logo: kit.description || '', color: kit.primary_color || '#6366f1', secondary_color: kit.accent_color || '', font_family: kit.font_style || '', name: kit.layout_style || '' };
        setBrandKit(loaded);
        localStorage.setItem('brand_kit', JSON.stringify(loaded));
      }
    }).catch(() => {});
  }, []);

  // Google Fonts 로드
  useEffect(() => {
    if (document.getElementById('gf-cardnews')) return;
    const link = document.createElement('link');
    link.id = 'gf-cardnews';
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);

  // 마운트 시 데이터 로드 및 URL 동기화 (우선순위: URL id > editingDesign > cardnews_import_templates > cardNewsData > autosave > PAGES_DATA)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlId = searchParams.get('id');
    const urlPage = searchParams.get('page');

    const updateUrlParams = (id: string | null, page: number) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      if (id) {
        params.set('id', id);
      } else {
        params.delete('id');
      }
      params.set('page', String(page));
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    };

    const initializeEditor = async () => {
      try {
        // ── 자동저장 복구 확인 (항상 먼저 체크 및 배너 세팅) ──────────────────────
        const autosaveRaw = localStorage.getItem('cardnews_autosave');
        if (autosaveRaw) {
          try {
            const autosave = JSON.parse(autosaveRaw);
            if (Array.isArray(autosave.pages) && autosave.pages.length > 0 && autosave.savedAt) {
              const ageMs = Date.now() - autosave.savedAt;
              if (ageMs < 24 * 60 * 60 * 1000) {
                setRestoreBanner({ savedAt: autosave.savedAt, pages: normalizePages(autosave.pages) });
              } else {
                localStorage.removeItem('cardnews_autosave');
              }
            }
          } catch {}
        }

        // 1. URL에 id가 있는 경우 -> Supabase API에서 디자인 로드 시도
        if (urlId) {
          const res = await fetch(`/api/designs/${urlId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.design && Array.isArray(data.design.pages_data)) {
              const pages = normalizePages(data.design.pages_data);
              setPagesData(pages);
              historyRef.current = [pages];
              historyIdxRef.current = 0;

              // 로드 완료 후 임시 스토리지 키 정리
              localStorage.removeItem('editingDesign');
              localStorage.removeItem('editingDesignId');
              localStorage.removeItem('cardnews_import_templates');
              localStorage.removeItem('cardNewsData');

              let targetPage = 1;
              if (urlPage) {
                const pNum = Number(urlPage);
                if (pNum >= 1 && pNum <= pages.length) {
                  targetPage = pNum;
                }
              }
              setCurrentPage(targetPage);
              updateUrlParams(urlId, targetPage);
              return;
            }
          }
        }

        // 2. localStorage에 기존 편집 디자인이 있는 경우 (빠른 로딩 및 URL 동기화)
        const editingRaw = localStorage.getItem('editingDesign');
        const editingId = localStorage.getItem('editingDesignId') || urlId;
        if (editingRaw) {
          const parsed = JSON.parse(editingRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const pages = normalizePages(parsed);
            setPagesData(pages);
            historyRef.current = [pages];
            historyIdxRef.current = 0;

            localStorage.removeItem('editingDesign');
            localStorage.removeItem('editingDesignId');

            let targetPage = 1;
            if (urlPage) {
              const pNum = Number(urlPage);
              if (pNum >= 1 && pNum <= parsed.length) {
                targetPage = pNum;
              }
            }
            setCurrentPage(targetPage);
            updateUrlParams(editingId, targetPage);
            return;
          }
        }

        // 3. localStorage에 템플릿 신규 생성이 있는 경우
        const importRaw = localStorage.getItem('cardnews_import_templates');
        if (importRaw) {
          const parsed = JSON.parse(importRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const pages = normalizePages(parsed);
            setPagesData(pages);
            historyRef.current = [pages];
            historyIdxRef.current = 0;

            localStorage.removeItem('cardnews_import_templates');
            localStorage.removeItem('editingDesign');
            localStorage.removeItem('editingDesignId');

            let targetPage = 1;
            if (urlPage) {
              const pNum = Number(urlPage);
              if (pNum >= 1 && pNum <= parsed.length) {
                targetPage = pNum;
              }
            }
            setCurrentPage(targetPage);
            updateUrlParams(null, targetPage);
            return;
          }
        }

        // 4. localStorage에 AI 생성 데이터가 있는 경우
        const raw = localStorage.getItem('cardNewsData');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let theme = BUSINESS_THEME_DATA;
            const selectedTpl = localStorage.getItem('selectedTemplate');
            if (selectedTpl) {
              try {
                const tpl = JSON.parse(selectedTpl);
                const cat = (tpl.category || '').toLowerCase();
                const title = (tpl.title || '').toLowerCase();
                if (cat.includes('카페') || cat.includes('커피') || title.includes('카페')) {
                  theme = CAFE_THEME_DATA;
                } else if (cat.includes('라이프스타일') || cat.includes('wellness') || title.includes('라이프')) {
                  theme = LIFESTYLE_THEME_DATA;
                } else if (cat.includes('여행') || cat.includes('travel') || title.includes('여행') || title.includes('핫플')) {
                  theme = TRAVEL_THEME_DATA;
                } else if (cat.includes('패션') || cat.includes('뷰티') || cat.includes('fashion') || title.includes('패션') || title.includes('뷰티')) {
                  theme = FASHION_THEME_DATA;
                } else if (cat.includes('음식') || cat.includes('맛집') || cat.includes('food') || title.includes('맛집') || title.includes('레시피') || title.includes('음식')) {
                  theme = FOOD_THEME_DATA;
                } else if (cat.includes('교육') || cat.includes('자기계발') || cat.includes('학습') || title.includes('공부') || title.includes('배우')) {
                  theme = EDUCATION_THEME_DATA;
                }
              } catch {}
            }

            const converted = normalizePages(cardNewsToPages(parsed, theme));
            setPagesData(converted);
            historyRef.current = [converted];
            historyIdxRef.current = 0;

            localStorage.removeItem('cardNewsData');

            let targetPage = 1;
            if (urlPage) {
              const pNum = Number(urlPage);
              if (pNum >= 1 && pNum <= converted.length) {
                targetPage = pNum;
              }
            }
            setCurrentPage(targetPage);
            updateUrlParams(null, targetPage);
            return;
          }
        }

        // 5. 새로고침 폴백 우선순위: 자동저장본(autosave) 우선 사용
        if (autosaveRaw) {
          const autosave = JSON.parse(autosaveRaw);
          if (Array.isArray(autosave.pages) && autosave.pages.length > 0) {
            const pages = normalizePages(autosave.pages);
            setPagesData(pages);
            historyRef.current = [pages];
            historyIdxRef.current = 0;

            let targetPage = 1;
            if (urlPage) {
              const pNum = Number(urlPage);
              if (pNum >= 1 && pNum <= autosave.pages.length) {
                targetPage = pNum;
              }
            }
            setCurrentPage(targetPage);
            updateUrlParams(urlId, targetPage);
            return;
          }
        }

        // 6. 최종 폴백: 기본 PAGES_DATA ("business title" 테마)
        const fallbackPages = normalizePages(PAGES_DATA);
        setPagesData(fallbackPages);
        historyRef.current = [fallbackPages];
        historyIdxRef.current = 0;

        let targetPage = 1;
        if (urlPage) {
          const pNum = Number(urlPage);
          if (pNum >= 1 && pNum <= PAGES_DATA.length) {
            targetPage = pNum;
          }
        }
        setCurrentPage(targetPage);
        updateUrlParams(null, targetPage);
      } catch (err) {
        console.error('Failed to load cardnews editor data:', err);
        const fallbackPages = normalizePages(PAGES_DATA);
        setPagesData(fallbackPages);
        setCurrentPage(1);
        updateUrlParams(null, 1);
      }
    };

    initializeEditor();
  }, []);

  // 페이지 번호 변경 시 URL Query 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const urlId = searchParams.get('id');
    const params = new URLSearchParams(window.location.search);
    if (urlId) {
      params.set('id', urlId);
    } else {
      params.delete('id');
    }
    params.set('page', String(currentPage));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [currentPage]);

  const syncUndoRedo = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback((next: PageData[]) => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(next);
    if (historyRef.current.length > 50) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - 50);
    }
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // ── 블록 상하 드래그 Y축 위치 조작 ──
  const [isDraggingBlocks, setIsDraggingBlocks] = useState(false);

  useEffect(() => {
    if (!isDraggingBlocks) return;
    
    let currentVal = pagesData[currentPage - 1]?.blocksOffsetY ?? 70;

    const handlePointerMove = (e: PointerEvent) => {
      if (!canvasElemRef.current) return;
      const rect = canvasElemRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      let percent = Math.round((relativeY / rect.height) * 100);
      percent = Math.max(10, Math.min(90, percent));
      currentVal = percent;
      
      setPagesData(prev => prev.map((p, idx) => idx + 1 !== currentPage ? p : { ...p, blocksOffsetY: percent }));
    };

    const handlePointerUp = () => {
      setIsDraggingBlocks(false);
      setPagesData(prev => {
        const next = prev.map((p, idx) => idx + 1 !== currentPage ? p : { ...p, blocksOffsetY: currentVal });
        pushHistory(next);
        return next;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingBlocks, currentPage, pushHistory, pagesData]);

  // layerId 1=title, 2=subtitle, 3+=bullets[layerId-3] / style은 선택 적용
  const updatePageField = useCallback((pageId: string, layerId: number, content: string, style?: TextStyle) => {
    setPagesData(prev => {
      const next = prev.map(p => {
        if (String(p.id) !== String(pageId)) return p;
        if (layerId === 1) return { ...p, title: content, ...(style ? { titleStyle: style } : {}) };
        if (layerId === 2) return { ...p, subtitle: content, ...(style ? { subtitleStyle: style } : {}) };
        if (layerId >= 3) {
          const bullets = [...(p.bullets || [])];
          bullets[layerId - 3] = content;
          return { ...p, bullets, ...(style ? { bulletStyle: style } : {}) };
        }
        return p;
      });
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--;
      setPagesData(historyRef.current[historyIdxRef.current]);
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(true);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      setPagesData(historyRef.current[historyIdxRef.current]);
      setCanUndo(true);
      setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
    }
  }, []);

  // AI 디자이너: 현재 페이지 전체 변경 적용
  const updatePageData = useCallback((pageId: string, changes: Partial<PageData>) => {
    setPagesData(prev => {
      const next = prev.map(p => String(p.id) !== String(pageId) ? p : { ...p, ...changes });
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // ── Canvas Element Helpers ───────────────────────────────────────────────────
  const addElement = useCallback((elem: Omit<CanvasElement, 'id'>) => {
    const newElem: CanvasElement = { ...elem, id: `el_${Date.now()}` };
    setPagesData(prev => {
      const next = prev.map((p, idx) => idx + 1 !== currentPage ? p : { ...p, elements: [...(p.elements || []), newElem] });
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newElem.id);
    setActiveTab('element');
  }, [currentPage, pushHistory]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setPagesData(prev => {
      const next = prev.map((p, idx) => idx + 1 !== currentPage ? p : {
        ...p, elements: (p.elements || []).map(e => e.id === id ? { ...e, ...updates } : e),
      });
      pushHistory(next);
      return next;
    });
  }, [currentPage, pushHistory]);

  // ── 일괄 편집 ───────────────────────────────────────────────────────────────
  // 텍스트 스타일을 모든 페이지의 동일 레이어에 적용 (내용은 유지)
  const applyStyleToAllPages = useCallback((layerId: number, style: TextStyle) => {
    setPagesData(prev => {
      const next = prev.map(p => {
        if (layerId === 1) return { ...p, titleStyle: { ...(p.titleStyle || {}), ...style } };
        if (layerId === 2) return { ...p, subtitleStyle: { ...(p.subtitleStyle || {}), ...style } };
        if (layerId >= 3) return { ...p, bulletStyle: { ...(p.bulletStyle || {}), ...style } };
        return p;
      });
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // 이미지 설정(밝기·오버레이)을 모든 페이지에 적용
  const applyImageSettingsToAllPages = useCallback((settings: { bgBrightness: number; bgBrightnessFilter: number; overlayOpacity: number }) => {
    setPagesData(prev => {
      const next = prev.map(p => ({ ...p, ...settings }));
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // ── 테마(디자인) 교체: 내용(제목·불릿·요소)은 유지, 시각 스타일만 교체 ────────
  const applyThemeToPages = useCallback((theme: PageData[]) => {
    setPagesData(prev => {
      const lastIdx = prev.length - 1;
      const next = prev.map((page, i) => {
        let base: PageData;
        if (i === 0) base = theme[0];
        else if (i === lastIdx) base = theme[theme.length - 1];
        else {
          const mc = Math.max(1, theme.length - 2);
          base = theme[1 + ((i - 1) % mc)];
        }
        return {
          ...base,
          id: page.id,
          title: page.title,
          subtitle: page.subtitle,
          bullets: page.bullets,
          elements: page.elements,
          imageKeyword: page.imageKeyword,
        };
      });
      pushHistory(next);
      return next;
    });
    setPageImages({});
    setShowThemeModal(false);
  }, [pushHistory]);

  // ── 슬라이드 관리 ───────────────────────────────────────────────────────────
  const duplicatePage = useCallback((pageId: string) => {
    setPagesData(prev => {
      const idx = prev.findIndex(p => String(p.id) === String(pageId));
      if (idx === -1) return prev;
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `page_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const clone = { ...prev[idx], id: newId };
      const next = [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const deletePage = useCallback((pageId: string) => {
    setPagesData(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(p => String(p.id) !== String(pageId));
      pushHistory(next);
      return next;
    });
    setCurrentPage(p => {
      const remaining = pagesData.filter(pg => String(pg.id) !== String(pageId));
      return Math.min(p, remaining.length || 1);
    });
  }, [pushHistory, pagesData]);

  // ── 슬라이드 드래그 순서 변경 ─────────────────────────────────────────────
  const handleThumbDragStart = useCallback((e: React.DragEvent, pageId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragThumbId(pageId);
  }, []);

  const handleThumbDragOver = useCallback((e: React.DragEvent, pageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverThumbId(pageId);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, pageId: string) => {
    setDragThumbId(pageId);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!elem) return;
    const thumbElem = elem.closest('[data-page-id]');
    if (thumbElem) {
      const targetId = String(thumbElem.getAttribute('data-page-id'));
      if (targetId && targetId !== dragThumbId) {
        setDragOverThumbId(targetId);
      }
    }
  }, [dragThumbId]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragThumbId !== null && dragOverThumbId !== null && dragThumbId !== dragOverThumbId) {
      setPagesData(prev => {
        const fromIdx = prev.findIndex(p => String(p.id) === String(dragThumbId));
        const toIdx = prev.findIndex(p => String(p.id) === String(dragOverThumbId));
        if (fromIdx === -1 || toIdx === -1) return prev;
        
        const currentSelectedPageId = prev[currentPage - 1]?.id;
        
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        pushHistory(next);
        
        if (currentSelectedPageId !== undefined) {
          const newSelectedIdx = next.findIndex(p => String(p.id) === String(currentSelectedPageId));
          if (newSelectedIdx !== -1) {
            setCurrentPage(newSelectedIdx + 1);
          }
        }
        return next;
      });
    }
    setDragThumbId(null);
    setDragOverThumbId(null);
  }, [dragThumbId, dragOverThumbId, currentPage, pushHistory]);

  const handleThumbDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (dragThumbId === null || dragThumbId === targetId) { setDragThumbId(null); setDragOverThumbId(null); return; }
    setPagesData(prev => {
      const fromIdx = prev.findIndex(p => String(p.id) === String(dragThumbId));
      const toIdx = prev.findIndex(p => String(p.id) === String(targetId));
      if (fromIdx === -1 || toIdx === -1) return prev;
      
      const currentSelectedPageId = prev[currentPage - 1]?.id;
      
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      pushHistory(next);
      
      if (currentSelectedPageId !== undefined) {
        const newSelectedIdx = next.findIndex(p => String(p.id) === String(currentSelectedPageId));
        if (newSelectedIdx !== -1) {
          setCurrentPage(newSelectedIdx + 1);
        }
      }
      return next;
    });
    setDragThumbId(null);
    setDragOverThumbId(null);
  }, [dragThumbId, currentPage, pushHistory]);

  const addBlankPage = useCallback(() => {
    setPagesData(prev => {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `page_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const last = prev[prev.length - 1];
      const blank: PageData = {
        id: newId,
        bgImage: last.bgImage,
        bgLabel: '새 페이지',
        overlay: last.overlay,
        title: '새 제목',
        subtitle: '',
        layout: 'center',
        titleStyle: last.titleStyle,
        subtitleStyle: last.subtitleStyle,
        elements: [],
      };
      const next = [...prev, blank];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const handleCanvasElemPointerDown = (e: React.PointerEvent, elem: CanvasElement) => {
    e.stopPropagation();
    setSelectedElementId(elem.id);
    setActiveTab('element');
    setSelectedLayer(null);
    if (!canvasElemRef.current) return;
    const rect = canvasElemRef.current.getBoundingClientRect();
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, origX: elem.x, origY: elem.y, cw: rect.width, ch: rect.height };
    setDraggingElemId(elem.id);
    setDragPos({ x: elem.x, y: elem.y });
  };

  // 정렬 가이드 스냅 포인트 (%, 3% 이내면 스냅)
  const SNAP_POINTS = [25, 33.33, 50, 66.67, 75];
  const SNAP_THRESHOLD = 3;
  const snapToGuide = (val: number): { snapped: number; guides: number[] } => {
    for (const pt of SNAP_POINTS) {
      if (Math.abs(val - pt) < SNAP_THRESHOLD) return { snapped: pt, guides: [pt] };
    }
    return { snapped: val, guides: [] };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!draggingElemId || !dragStartRef.current) return;
    const { startX, startY, origX, origY, cw, ch } = dragStartRef.current;
    const rawX = Math.max(5, Math.min(95, origX + ((e.clientX - startX) / cw) * 100));
    const rawY = Math.max(5, Math.min(95, origY + ((e.clientY - startY) / ch) * 100));
    const { snapped: newX, guides: xGuides } = snapToGuide(rawX);
    const { snapped: newY, guides: yGuides } = snapToGuide(rawY);
    setDragPos({ x: newX, y: newY });
    setGuideLines([...xGuides.map(g => ({ x: g })), ...yGuides.map(g => ({ y: g }))]);
  };

  const handleCanvasPointerUp = () => {
    if (draggingElemId && dragPos) {
      updateElement(draggingElemId, dragPos);
    }
    setDraggingElemId(null);
    setDragPos(null);
    setGuideLines([]);
    dragStartRef.current = null;
  };

  const deleteElement = useCallback((id: string) => {
    setPagesData(prev => {
      const next = prev.map((p, idx) => idx + 1 !== currentPage ? p : {
        ...p, elements: (p.elements || []).filter(e => e.id !== id),
      });
      pushHistory(next);
      return next;
    });
    setSelectedElementId(null);
  }, [currentPage, pushHistory]);

  const totalPages = pagesData.length;

  // Safe page index & data retrieval to prevent out of bounds/undefined crashes
  const safePageIndex = pagesData.length > 0 ? Math.max(0, Math.min(currentPage - 1, pagesData.length - 1)) : 0;
  const pageData = pagesData[safePageIndex] || PAGES_DATA[0];
  const currentBgImage = pageData ? (pageImages[pageData.id] ?? pageData.bgImage) : '';

  // 이미지 레이어의 imageSrc를 현재 선택된 이미지로 교체
  const rawLayers = getLayersForPage(pageData);
  const pageLayers: CanvasLayerWithSrc[] = [
    { ...(rawLayers[0] || {}), imageSrc: currentBgImage } as CanvasLayerWithSrc,
    ...rawLayers.slice(1),
  ];

  // 카드 전체 텍스트 (Claude 검색 쿼리 생성에 사용)
  const cardTextContent = pageData
    ? [
        pageData.title,
        pageData.subtitle,
        ...(pageData.bullets || []).map(b => b.replace(/<[^>]+>/g, '')),
      ].filter(Boolean).join('\n')
    : '';

  const handleSelectLayer = (layer: CanvasLayerWithSrc) => { setSelectedLayer(layer); setActiveTab('edit'); setIsPanelOpen(true); };
  const handleDeselect = () => { setSelectedLayer(null); setEditingElemId(null); };

  const handleSelectImage = (url: string) => {
    if (pageData) {
      setPageImages(prev => ({ ...prev, [pageData.id]: url }));
    }
  };

  const [isSavingClose, setIsSavingClose] = useState(false);
  const handleSaveAndClose = async () => {
    setIsSavingClose(true);
    try {
      const merged = pagesData.map(pg => ({ ...pg, bgImage: pageImages[pg.id] ?? pg.bgImage }));
      await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `카드뉴스 ${new Date().toLocaleDateString('ko-KR')}`, pagesData: merged }),
      });
    } catch {
      // 저장 실패해도 닫기는 진행
    } finally {
      setIsSavingClose(false);
      localStorage.removeItem('cardNewsData');
      localStorage.removeItem('editingDesign');
      router.push('/cardnews');
    }
  };

  // 페이지 변경 시 선택 레이어 초기화
  const handlePageChange = (num: number) => {
    setCurrentPage(num);
    setSelectedLayer(null);
    setEditingElemId(null);
    setSelectedElementId(null);
  };

  const handleConvertToBlog = () => {
    const contentText = pagesData.map((p, idx) => {
      const parts = [`[${idx + 1}장 ${idx === 0 ? '표지' : '본문'}]`];
      if (p.title) parts.push(`제목: ${p.title}`);
      if (p.subtitle) parts.push(`소제목: ${p.subtitle}`);
      if (p.bullets && p.bullets.length > 0)
        parts.push(`상세:\n${p.bullets.map(b => `- ${b}`).join('\n')}`);
      return parts.join('\n');
    }).join('\n\n');

    if (!contentText.trim()) {
      alert('전환할 카드뉴스 내용이 없습니다.');
      return;
    }
    const images = pagesData
      .map(p => (typeof pageImages !== 'undefined' ? (pageImages[p.id] ?? p.bgImage) : p.bgImage))
      .filter(url => url && url.trim() !== '');

    localStorage.setItem('convertSourceBlog', JSON.stringify({
      content: contentText,
      images: images,
    }));
    router.push('/blog-generator?from=cardnews');
  };

  // 공유 링크 생성 (저장 → /view/[id] URL 복사)
  const handleShare = async () => {
    setIsSharing(true);
    try {
      const merged = pagesData.map(pg => ({ ...pg, bgImage: pageImages[pg.id] ?? pg.bgImage }));
      const title = `카드뉴스 ${new Date().toLocaleDateString('ko-KR')}`;
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages_data: merged, title }),
      });
      const data = await res.json();
      if (data.token) {
        const shareUrl = `${window.location.origin}/share?t=${data.token}`;
        await navigator.clipboard.writeText(shareUrl);
        setShareToast('copied');
      } else {
        setShareToast('error');
      }
    } catch {
      setShareToast('error');
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  // 파일 → 업로드 → URL 반환 (Supabase Storage, 실패 시 data URL fallback)
  const uploadImageFile = useCallback(async (file: File): Promise<string> => {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) return data.url;
    } catch { /* fallback */ }
    // Supabase 실패 시 data URL
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }, []);

  // 캔버스 드래그앤드롭
  const handleCanvasDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingFile(true);
    }
  };
  const handleCanvasDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
    }
  };
  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploadingDrop(true);
    try {
      const url = await uploadImageFile(file);
      if (pageData) {
        setPageImages(prev => ({ ...prev, [pageData.id]: url }));
      }
    } finally {
      setIsUploadingDrop(false);
    }
  };

  // 키보드 단축키: Ctrl+Z / Cmd+Z (실행취소), Ctrl+Y / Cmd+Shift+Z (다시실행)
  // textarea/input 포커스 시에는 브라우저 기본 동작 허용
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── 자동 저장 (10초마다) ────────────────────────────────────────────────────
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      try {
        const merged = pagesData.map(pg => ({ ...pg, bgImage: pageImages[pg.id] ?? pg.bgImage }));
        localStorage.setItem('cardnews_autosave', JSON.stringify({ pages: merged, savedAt: Date.now() }));
        const t = new Date();
        setAutoSaveTime(`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`);
      } catch { /* ignore */ }
    }, 10000);
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current); };
  }, [pagesData, pageImages]);

  // ── 요소 복사(Ctrl+C) / 붙여넣기(Ctrl+V) ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'c' && selectedElementId) {
        const elem = (pageData?.elements || []).find(el => el.id === selectedElementId);
        if (elem) { copiedElementRef.current = elem; setClipboardToast(true); setTimeout(() => setClipboardToast(false), 1500); }
      }
      if (e.key === 'v' && copiedElementRef.current) {
        e.preventDefault();
        const src = copiedElementRef.current;
        const newElem: CanvasElement = { ...src, id: `el_${Date.now()}`, x: Math.min(95, src.x + 5), y: Math.min(95, src.y + 5) };
        setPagesData(prev => {
          const next = prev.map((p, idx) => idx + 1 !== currentPage ? p : { ...p, elements: [...(p.elements || []), newElem] });
          pushHistory(next);
          return next;
        });
        setSelectedElementId(newElem.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElementId, currentPage, pagesData, pushHistory]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 64; // p-8 both sides
      const thumbH = 112; // h-28
      const availH = el.clientHeight - thumbH - pad;
      const availW = el.clientWidth - pad;
      const w = Math.max(280, Math.min(availW, availH * (4 / 5)));
      setCanvasW(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white" onClick={handleDeselect}>
      {/* 클립보드 토스트 */}
      {clipboardToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 pointer-events-none">
          <Copy size={12} /> 요소 복사됨 — Ctrl+V로 붙여넣기
        </div>
      )}

      {/* 전체 보기 모달 */}
      {showGridView && (
        <div className="fixed inset-0 z-[9998] bg-black/80 flex flex-col" onClick={() => setShowGridView(false)}>
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900/80 border-b border-white/10">
            <h2 className="text-white font-bold text-sm">전체 슬라이드 보기</h2>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">클릭하면 해당 슬라이드로 이동</span>
              <button onClick={() => setShowGridView(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"><X size={16} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
              {pagesData.map((pg, idx) => (
                <div
                  key={pg.id}
                  onClick={() => { setCurrentPage(idx + 1); setShowGridView(false); }}
                  className={`relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-2xl ${currentPage === idx + 1 ? 'ring-3 ring-primary-400 scale-105' : 'ring-1 ring-white/20'}`}
                  style={{ aspectRatio: '4/5' }}
                >
                  <img src={(pageImages[pg.id] ?? pg.bgImage).replace('w=800', 'w=300')} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: pg.overlay }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                    {pg.title && <p className="text-white text-[10px] font-bold leading-tight drop-shadow line-clamp-3">{pg.title}</p>}
                  </div>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{idx + 1}</div>
                  {currentPage === idx + 1 && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {/* 슬라이드 추가 */}
              <div
                onClick={() => { addBlankPage(); setShowGridView(false); }}
                className="relative rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-white/5 transition-all"
                style={{ aspectRatio: '4/5' }}
              >
                <div className="text-center">
                  <Plus size={24} className="text-white/40 mx-auto mb-1" />
                  <span className="text-white/40 text-[10px]">슬라이드 추가</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전체화면 편집 모드 */}
      {isFullscreenEdit && (
        <FullscreenEditor
          pagesData={pagesData}
          initialPage={currentPage}
          pageImages={pageImages}
          onSelectImage={(url, pageId) => setPageImages(prev => ({ ...prev, [pageId]: url }))}
          onUpdatePage={updatePageField}
          onApplyPageChanges={updatePageData}
          onClose={() => setIsFullscreenEdit(false)}
          brandLogo={brandKit?.logo}
        />
      )}

      {/* 디자인(테마) 변경 모달 */}
      {showThemeModal && (
        <ThemeChangeModal
          onApply={applyThemeToPages}
          onClose={() => setShowThemeModal(false)}
        />
      )}

      {/* 내 템플릿 저장 모달 */}
      {showSaveTemplateModal && (
        <SaveTemplateModal
          pagesData={pagesData}
          onClose={() => setShowSaveTemplateModal(false)}
        />
      )}
      {/* 내 카드뉴스 로컬 저장 모달 */}
      {showSaveLocalModal && (
        <SaveLocalModal
          pagesData={pagesData}
          onClose={() => setShowSaveLocalModal(false)}
        />
      )}

      {/* 디자인 저장 모달 */}
      {showSaveModal && (
        <SaveDesignModal
          pagesData={pagesData}
          pageImages={pageImages}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* 다운로드 모달 */}
      {showDownloadMenu && (
        <DownloadModal
          pagesData={pagesData}
          pageImages={pageImages}
          currentPage={currentPage}
          captureRefs={captureRefs}
          brandLogo={brandKit?.logo}
          onClose={() => setShowDownloadMenu(false)}
        />
      )}
      {/* SNS 업로드 모달 */}
      {showSnsModal && (
        <SnsUploadModal
          pagesData={pagesData}
          captureRefs={captureRefs}
          initialCaption={lastCaption ? `${lastCaption}${lastHashtags.length ? '\n\n' + lastHashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ') : ''}` : ''}
          onClose={() => setShowSnsModal(false)}
        />
      )}
      {/* AI 캡션 생성 모달 */}
      {showCaptionModal && (
        <CaptionModal
          pagesData={pagesData}
          brandKit={brandKit}
          onCaptionGenerated={(cap, tags) => { setLastCaption(cap); setLastHashtags(tags); }}
          onClose={() => setShowCaptionModal(false)}
        />
      )}

      {/* 오프스크린 캡처 영역 (다운로드용) */}
      <div style={{ position: 'fixed', left: '-99999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        {pagesData.map(pg => (
          <div
            key={pg.id}
            ref={el => { captureRefs.current[pg.id] = el; }}
            style={{ width: 420, height: 525, position: 'relative', overflow: 'hidden' }}
          >
            <CardView page={pg} bgImage={pageImages[pg.id] ?? pg.bgImage} logo={brandKit?.logo} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="border-b border-gray-200 bg-white z-20 shrink-0">
        {/* 메인 헤더 행 */}
        <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
          {/* Left */}
          <div className="flex items-center gap-2">
            <Link href="/cardnews" className="flex items-center gap-1 text-gray-700 font-bold text-sm hover:text-primary-600">
              <ChevronLeft size={16} className="md:hidden" />
              <span className="hidden md:inline">{currentPage}페이지 편집</span>
            </Link>
            <div className="flex items-center gap-0.5 text-gray-500 text-sm">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={14} /></button>
              <span className="font-semibold px-1 text-xs tabular-nums">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={14} /></button>
            </div>
            {/* 전체 보기 버튼 */}
            <button
              onClick={() => setShowGridView(true)}
              title="전체 슬라이드 보기"
              className="hidden md:flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <span className="hidden lg:inline">전체 보기</span>
            </button>
            {/* 자동 저장 표시 */}
            {autoSaveTime && (
              <span className="hidden md:flex items-center gap-1 text-[10px] text-gray-400">
                <Check size={10} className="text-emerald-400" /> {autoSaveTime} 자동저장됨
              </span>
            )}
            {/* 자동저장 복구 배너 */}
            {restoreBanner && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] font-medium text-amber-800 animate-pulse">
                <span>⏱ 미저장 작업 발견</span>
                <span className="text-amber-500">{new Date(restoreBanner.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                <button
                  onClick={() => {
                    setPagesData(restoreBanner.pages);
                    historyRef.current = [restoreBanner.pages];
                    historyIdxRef.current = 0;
                    setRestoreBanner(null);
                  }}
                  className="px-2 py-0.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
                >
                  복구하기
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('cardnews_autosave');
                    setRestoreBanner(null);
                  }}
                  className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 transition-colors"
                >
                  무시
                </button>
              </div>
            )}
            <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="되돌리기 (Ctrl+Z)"
                className={`p-1.5 rounded transition-colors ${canUndo ? 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <Undo size={14} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="다시실행 (Ctrl+Y)"
                className={`p-1.5 rounded transition-colors ${canRedo ? 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <Redo size={14} />
              </button>
            </div>
          </div>
          {/* Right */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {/* 데스크탑 전용 */}
            <div className="hidden md:flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
              <button className="text-gray-400 hover:text-gray-700"><ZoomOut size={14} /></button>
              <div className="relative w-20 h-1.5 bg-gray-300 rounded-full mx-1">
                <div className="absolute left-0 top-0 h-full bg-primary-500 rounded-full" style={{ width: '60%' }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-600 rounded-full shadow-sm" style={{ left: 'calc(60% - 6px)' }} />
              </div>
              <button className="text-gray-400 hover:text-gray-700"><ZoomIn size={14} /></button>
              <span className="text-xs font-semibold text-gray-600 ml-1 w-9 text-right">100%</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button onClick={() => setIsPanelOpen(v => !v)} className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-primary-600 transition-colors">
                {isPanelOpen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="19 9 15 12 19 15"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="11 9 15 12 11 15"/></svg>
                )}
              </button>
              <div className="w-px h-5 bg-gray-200" />
              <button onClick={handleShare} disabled={isSharing} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${shareToast === 'copied' ? 'bg-green-50 text-green-600 border border-green-200' : shareToast === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-primary-400 hover:text-primary-600'} disabled:opacity-60`}>
                {isSharing ? <Loader2 size={14} className="animate-spin" /> : shareToast === 'copied' ? <Check size={14} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
                {shareToast === 'copied' ? '링크 복사됨!' : shareToast === 'error' ? '실패' : '공유 링크'}
              </button>
              <button onClick={() => setShowSaveLocalModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"><FolderOpen size={14} /> 내 카드뉴스 저장</button>
              <button onClick={() => setShowThemeModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 116.93 19.07"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/></svg>
                디자인 변경
              </button>
              <button onClick={() => setShowSaveTemplateModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">⭐ 템플릿 저장</button>
              <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Save size={14} /> 디자인 저장</button>
              <button onClick={() => setIsFullscreenEdit(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-400 hover:text-primary-600 transition-colors"><Maximize2 size={14} /> 전체화면 편집</button>
              <button onClick={() => setShowCaptionModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] transition-all shadow-sm"><Wand2 size={14} /> 캡션 생성</button>
              <button onClick={() => setShowSnsModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:from-purple-600 hover:to-pink-600 active:scale-[0.98] transition-all shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> SNS 업로드
              </button>
              <button onClick={handleConvertToBlog} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                블로그로 전환 →
              </button>
              <button onClick={() => setShowDownloadMenu(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 다운로드
              </button>
            </div>
            {/* 모바일 저장 버튼 */}
            <button onClick={handleSaveAndClose} disabled={isSavingClose} className="flex items-center gap-1.5 px-3 md:px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 shadow-sm">
              {isSavingClose ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>저장</span>
            </button>
          </div>
        </div>

        {/* 모바일 전용 액션 툴바 */}
        <div className="md:hidden flex items-center gap-2 px-3 pb-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setIsFullscreenEdit(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-100">
            <Maximize2 size={15} /> 전체편집
          </button>
          <button onClick={() => setShowCaptionModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0 active:bg-emerald-100">
            <Wand2 size={15} /> AI 캡션
          </button>
          <button onClick={() => setShowSnsModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 active:opacity-90">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> SNS 업로드
          </button>
          <button onClick={() => setShowDownloadMenu(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 다운로드
          </button>
          <button onClick={handleShare} disabled={isSharing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            {shareToast === 'copied' ? '복사됨!' : '공유링크'}
          </button>
          <button onClick={() => setShowSaveLocalModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0 active:bg-emerald-100">
            <FolderOpen size={13} /> 내저장
          </button>
          <button onClick={() => setShowSaveTemplateModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-xs font-semibold text-violet-700 whitespace-nowrap shrink-0 active:bg-violet-100">
            ⭐ 템플릿저장
          </button>
          <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-100">
            <Save size={13} /> 디자인저장
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar - 데스크탑 전용 */}
        <div className="hidden md:flex w-14 border-r border-gray-200 bg-white flex-col items-center py-4 gap-3 shrink-0 z-10">
          {[{ icon: <span className="font-serif text-base font-bold">T</span>, label: '텍스트' }, { icon: <ImagePlusIcon size={18} />, label: '이미지' }, { icon: <ShapesIcon size={18} />, label: '도형' }, { icon: <LayoutTemplateIcon size={18} />, label: '레이아웃' }, { icon: <Film size={18} />, label: '영상' }].map(item => (
            <button key={item.label} title={item.label} className="w-10 h-10 rounded-xl hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center text-gray-500 transition-colors">{item.icon}</button>
          ))}
        </div>

        {/* Canvas */}
        <div
          ref={canvasWrapRef}
          className="flex-1 bg-[#F4F4F6] flex flex-col overflow-hidden relative"
          onClick={handleDeselect}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          {/* 드래그 오버레이 */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary-600/20 border-4 border-dashed border-primary-500 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-center">
                <ImageIcon size={32} className="text-primary-500 mx-auto mb-2" />
                <p className="text-base font-bold text-primary-700">여기에 이미지를 놓으세요</p>
                <p className="text-sm text-primary-500 mt-1">PNG, JPG, WebP 지원</p>
              </div>
            </div>
          )}
          {/* 업로드 중 오버레이 */}
          {isUploadingDrop && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 pointer-events-none">
              <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-center border border-primary-100">
                <Loader2 size={28} className="text-primary-500 mx-auto mb-2 animate-spin" />
                <p className="text-sm font-semibold text-gray-700">이미지 업로드 중...</p>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto flex items-center justify-center p-2 md:p-8">
            <div
              ref={canvasElemRef}
              className="relative bg-white shadow-2xl flex-shrink-0 overflow-hidden"
              style={{ width: `${canvasW}px`, aspectRatio: '4/5' }}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
            >
              {/* 블록 위치 드래그 중 표시되는 상단 고정 반투명 배지 */}
              {isDraggingBlocks && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-violet-600/85 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none z-50">
                  블록 위치 조절: {pageData.blocksOffsetY ?? 70}%
                </div>
              )}
              {/* 정렬 가이드 라인 */}
              {guideLines.map((g, i) => (
                g.x !== undefined
                  ? <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-50" style={{ left: `${g.x}%`, width: 1, background: 'rgba(99,102,241,0.8)' }} />
                  : <div key={i} className="absolute left-0 right-0 pointer-events-none z-50" style={{ top: `${g.y}%`, height: 1, background: 'rgba(99,102,241,0.8)' }} />
              ))}
              {/* Canvas layers */}
              {(() => {
                const eyebrowBlock = pageData.blocks?.find(b => b.type === 'eyebrow');
                const eyebrowText = eyebrowBlock && 'text' in eyebrowBlock ? eyebrowBlock.text : undefined;

                const innerLayers = (
                  <>
                    {/* Background image layer */}
                    <div
                      onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[0]); }}
                      className={`absolute inset-0 cursor-pointer transition-all overflow-hidden ${selectedLayer?.id === 0 ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-primary-300/60'}`}
                    >
                      <img src={currentBgImage} alt="배경" className="w-full h-full object-cover"
                        style={{
                          transform: `scale(${pageData.bgScale ?? 1})`,
                          transformOrigin: `${pageData.bgPosition?.x ?? 50}% ${pageData.bgPosition?.y ?? 50}%`,
                          filter: `brightness(${(pageData.bgBrightnessFilter ?? 100) / 100})`,
                          transition: 'transform 0.1s ease',
                        }}
                      />
                      <div className="absolute inset-0" style={{ background: pageData.overlay, opacity: (pageData.overlayOpacity ?? 100) / 100 }} />
                      {(pageData.bgBrightness ?? 0) > 0 && (
                        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(pageData.bgBrightness ?? 0) / 100})` }} />
                      )}
                      {brandKit?.logo && !pageData.showFrame && (
                        <div className="absolute top-[4%] right-[4%] z-10 opacity-80 pointer-events-none">
                          <img src={brandKit.logo} className="h-4 object-contain" style={{ height: `${(16 * canvasW) / 420}px` }} />
                        </div>
                      )}
                      {selectedLayer?.id === 0 && (
                        <span className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                          🖼 {pageData.bgLabel}
                        </span>
                      )}
                    </div>

                    {/* Text layers — layout varies per page */}
                    <div className="absolute inset-0 pointer-events-none">
                      {(pageData.blocks?.length ?? 0) > 0 ? (
                        <>
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: `${100 - (pageData.blocksOffsetY ?? 70)}%`,
                              left: 28,
                              right: 28,
                              display: 'flex',
                              flexDirection: 'column',
                              paddingBottom: 40,
                              pointerEvents: 'none',
                            }}
                          >
                            <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
                              <BlockRenderer
                                blocks={pageData.blocks!}
                                brandTone={pageData.brandTone}
                                editable={true}
                                availableHeight={Math.floor(canvasW * 1.25 * (pageData.blocksOffsetY ?? 70) / 100 - 40)}
                                isDraggingParent={isDraggingBlocks}
                                onBlockOffsetChange={(index, offsetY) => {
                                  const updatedBlocks = [...(pageData.blocks || [])];
                                  if (updatedBlocks[index]) {
                                    updatedBlocks[index] = {
                                      ...updatedBlocks[index],
                                      offsetY,
                                    };
                                    updatePageData(pageData.id, { blocks: updatedBlocks });
                                  }
                                }}
                                titleStyle={pageData.titleStyle}
                                subtitleStyle={pageData.subtitleStyle}
                                bulletStyle={pageData.bulletStyle}
                              />
                            </div>
                          </div>
                          {/* Y-axis drag line */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 28,
                              right: 28,
                              top: `${pageData.blocksOffsetY ?? 70}%`,
                              borderTop: '1px dashed rgba(139, 92, 246, 0.4)',
                              pointerEvents: 'none',
                              zIndex: 30,
                            }}
                          />
                          {/* Y-axis drag handlebar ⠿ 블록 위치 조절 (좌측 모서리로 이동 및 투명도 조절) */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 6,
                              top: `${pageData.blocksOffsetY ?? 70}%`,
                              transform: 'translateY(-50%)',
                              zIndex: 40,
                              pointerEvents: 'auto',
                            }}
                          >
                            <div
                              onPointerDown={e => {
                                e.stopPropagation();
                                e.preventDefault();
                                setIsDraggingBlocks(true);
                              }}
                              className="w-6 h-6 rounded-full bg-violet-600/70 hover:bg-violet-700 text-white text-xs flex items-center justify-center shadow-md cursor-ns-resize active:scale-95 transition-all select-none border border-violet-500/50"
                              style={{ touchAction: 'none' }}
                              title="드래그하여 블록 위치 조절"
                            >
                              <span className="font-mono text-[10px]">⠿</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {pageData.layout === 'center' && (
                            <div className="flex flex-col items-center justify-center h-full px-10 text-center">
                              <div
                                onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[1]); }}
                                className={`pointer-events-auto cursor-pointer mb-4 rounded px-2 py-1 transition-all ${selectedLayer?.id === 1 ? 'ring-1 ring-white/60 bg-white/10' : 'hover:bg-white/10'}`}
                              >
                                <h1
                                  className="drop-shadow-lg whitespace-pre-line"
                                  style={{
                                    fontSize: `${((pageData.titleStyle?.fontSize ?? 38) * canvasW) / 420}px`,
                                    fontWeight: pageData.titleStyle?.fontWeight ?? '900',
                                    fontFamily: pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                    color: pageData.titleStyle?.color ?? '#FFFFFF',
                                    letterSpacing: pageData.titleStyle?.letterSpacing ? `${pageData.titleStyle.letterSpacing}px` : undefined,
                                    lineHeight: pageData.titleStyle?.lineHeight ?? 1.2,
                                    textAlign: pageData.titleStyle?.align ?? 'center',
                                  }}
                                >
                                  {pageData.title}
                                </h1>
                              </div>
                              <div className="w-16 h-0.5 bg-white/50 mb-4" />
                              {pageData.subtitle && (
                                <div
                                  onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[2]); }}
                                  className={`pointer-events-auto cursor-pointer rounded px-2 py-1 transition-all ${selectedLayer?.id === 2 ? 'ring-1 ring-white/60 bg-white/10' : 'hover:bg-white/10'}`}
                                >
                                  <p
                                    className="whitespace-pre-line drop-shadow"
                                    style={{
                                      fontSize: `${((pageData.subtitleStyle?.fontSize ?? 14) * canvasW) / 420}px`,
                                      fontWeight: pageData.subtitleStyle?.fontWeight ?? '400',
                                      fontFamily: pageData.subtitleStyle?.fontFamily ?? pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                      color: pageData.subtitleStyle?.color ?? '#E5E7EB',
                                      lineHeight: pageData.subtitleStyle?.lineHeight ?? 1.6,
                                      textAlign: pageData.subtitleStyle?.align ?? 'center',
                                    }}
                                  >
                                    {pageData.subtitle}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {(pageData.layout === 'bottom-left' || pageData.layout === 'bottom-left-list') && (
                            <div className="flex flex-col justify-end h-full px-8 pb-10 gap-5">
                              <div
                                onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[1]); }}
                                className={`pointer-events-auto cursor-pointer flex items-start gap-3 rounded px-1 py-1 transition-all ${selectedLayer?.id === 1 ? 'ring-1 ring-white/50 bg-white/10' : 'hover:bg-white/10'}`}
                              >
                                <span className="mt-0.5 shrink-0" style={{ color: pageData.accent || '#ffd700', fontSize: `${((pageData.titleStyle?.fontSize ?? 24) * canvasW) / 420}px` }}>●</span>
                                <h2
                                  className="leading-tight drop-shadow"
                                  style={{
                                    fontSize: `${((pageData.titleStyle?.fontSize ?? 24) * canvasW) / 420}px`,
                                    fontWeight: pageData.titleStyle?.fontWeight ?? '900',
                                    fontFamily: pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                    color: pageData.titleStyle?.color ?? (pageData.accent || '#ffd700'),
                                    lineHeight: pageData.titleStyle?.lineHeight ?? 1.2,
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(255,215,0,0.5)',
                                  }}
                                >
                                  {pageData.title}
                                </h2>
                              </div>

                              {pageData.bullets && (
                                <div className="space-y-2.5 pl-2">
                                  {pageData.bullets.map((bullet, i) => (
                                    <div
                                      key={i}
                                      onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[2 + i]); }}
                                      className={`pointer-events-auto cursor-pointer flex items-start gap-2 rounded px-1 py-0.5 transition-all ${selectedLayer?.id === 2 + i ? 'ring-1 ring-white/50 bg-white/10' : 'hover:bg-white/10'}`}
                                    >
                                      <span className="text-white/60 shrink-0 mt-0.5" style={{ fontSize: `${((pageData.bulletStyle?.fontSize ?? 14) * canvasW) / 420}px` }}>•</span>
                                      <p
                                        className="drop-shadow"
                                        style={{
                                          fontSize: `${((pageData.bulletStyle?.fontSize ?? 14) * canvasW) / 420}px`,
                                          fontWeight: pageData.bulletStyle?.fontWeight ?? '400',
                                          fontFamily: pageData.bulletStyle?.fontFamily ?? pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                          color: pageData.bulletStyle?.color ?? '#FFFFFF',
                                          lineHeight: pageData.bulletStyle?.lineHeight ?? 1.6,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: bullet.replace(/<b>(.*?)<\/b>/g, `<b style="color:${pageData.accent || '#ffd700'}">$1</b>`) }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Canvas Elements Layer */}
                    {(pageData.elements || []).map(elem => {
                      const isSelected = selectedElementId === elem.id;
                      const isEditing = editingElemId === elem.id;
                      const displayX = draggingElemId === elem.id && dragPos ? dragPos.x : elem.x;
                      const displayY = draggingElemId === elem.id && dragPos ? dragPos.y : elem.y;
                      const pxSize = (elem.size / 100) * canvasW;
                      const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * canvasW : pxSize;
                      const scaledFs = ((elem.fontSize ?? 16) * canvasW) / 420;
                      return (
                        <div
                          key={elem.id}
                          className={`absolute select-none ${isEditing ? 'cursor-text' : 'cursor-move'} transition-shadow ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 rounded-sm' : 'hover:ring-1 hover:ring-blue-300 rounded-sm'}`}
                          style={{
                            left: `${displayX}%`, top: `${displayY}%`,
                            width: elem.type === 'text' ? `${textW}px` : `${pxSize}px`,
                            height: elem.type === 'text' ? 'auto' : `${pxSize}px`,
                            opacity: elem.opacity, zIndex: 15,
                            transform: 'translate(-50%, -50%)',
                            touchAction: 'none',
                          }}
                          onPointerDown={e => { if (!isEditing) handleCanvasElemPointerDown(e, elem); }}
                          onDoubleClick={e => { if (elem.type === 'text') { e.stopPropagation(); setEditingElemId(elem.id); } }}
                        >
                          {elem.type === 'shape' && elem.shape && <ShapeSVG shape={elem.shape} color={elem.color} />}
                          {elem.type === 'emoji' && (
                            <span style={{ fontSize: `${pxSize}px`, lineHeight: 1, userSelect: 'none' }}>{elem.emoji}</span>
                          )}
                          {elem.type === 'text' && (
                            isEditing ? (
                              <textarea
                                autoFocus
                                defaultValue={elem.text ?? ''}
                                onBlur={e => { updateElement(elem.id, { text: e.target.value }); setEditingElemId(null); }}
                                onMouseDown={e => e.stopPropagation()}
                                rows={3}
                                style={{
                                  width: '100%', background: 'transparent', border: 'none', outline: '2px solid rgba(59,130,246,0.6)',
                                  resize: 'none', padding: '2px 4px', borderRadius: 2,
                                  fontSize: `${scaledFs}px`, fontWeight: elem.fontWeight ?? '400',
                                  fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                                  textAlign: elem.textAlign ?? 'left', color: elem.color, lineHeight: 1.4,
                                }}
                              />
                            ) : (
                              <p style={{
                                fontSize: `${scaledFs}px`, fontWeight: elem.fontWeight ?? '400',
                                fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                                textAlign: elem.textAlign ?? 'left', color: elem.color,
                                lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                margin: 0, padding: '2px 4px', userSelect: 'none',
                              }}>
                                {elem.text || <span style={{ opacity: 0.4 }}>텍스트 입력...</span>}
                              </p>
                            )
                          )}
                          {isSelected && !isEditing && (
                            <button
                              className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-lg z-20 cursor-pointer hover:bg-red-600"
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); deleteElement(elem.id); }}
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </>
                );

                if (pageData.showFrame) {
                  return (
                    <SlideFrame
                      page={currentPage}
                      total={pagesData.length}
                      brandTone={pageData.brandTone}
                      eyebrow={undefined}
                      handle={pageData.handle ?? '@aptshowhome'}
                    >
                      {innerLayers}
                    </SlideFrame>
                  );
                }
                return innerLayers;
              })()}

              {/* Floating toolbar */}
              {selectedLayer && (
                <div
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-xl shadow-xl px-2 py-1.5 border border-gray-100 z-20"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200">
                    <div className="w-2 h-2 rounded-full bg-primary-600" />
                    <span className="text-xs font-bold text-primary-700 whitespace-nowrap">
                      {selectedLayer.type === 'image' ? '이미지 편집 중' : '텍스트 편집 중'}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsFullscreenEdit(true)}
                    className="p-1.5 hover:bg-primary-50 rounded-lg text-primary-600 hover:text-primary-700 transition-colors"
                    title="전체화면으로 편집"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><LayersIcon size={14} /></button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Copy size={14} /></button>
                  <button className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" onClick={handleDeselect}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails — 드래그로 순서 변경 가능 */}
          <div className="h-20 md:h-28 bg-white border-t border-gray-200 flex items-center gap-2 md:gap-3 shrink-0 px-3 md:px-4 z-10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {pagesData.map((pg, idx) => (
              <div
                key={pg.id}
                data-page-id={pg.id}
                className="relative shrink-0 group"
                draggable
                onDragStart={e => handleThumbDragStart(e, pg.id)}
                onDragOver={e => handleThumbDragOver(e, pg.id)}
                onDrop={e => handleThumbDrop(e, pg.id)}
                onDragEnd={() => { setDragThumbId(null); setDragOverThumbId(null); }}
                onTouchStart={e => handleTouchStart(e, pg.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'none' }}
              >
                <div
                  onClick={e => { e.stopPropagation(); handlePageChange(idx + 1); }}
                  className={`relative w-10 h-[52px] md:w-14 md:h-[72px] rounded-lg border-2 overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                    dragOverThumbId === pg.id ? 'border-primary-400 scale-105 ring-2 ring-primary-200' :
                    dragThumbId === pg.id ? 'opacity-40 border-gray-300' :
                    currentPage === idx + 1 ? 'border-primary-600 shadow-md ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img src={(pageImages[pg.id] ?? pg.bgImage).replace('w=800', 'w=120')} alt={`${pg.id}p`} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: pg.overlay }} />
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-[9px] text-white font-bold">{idx + 1}</div>
                  
                  {/* 복제 및 삭제 오버레이 버튼 (스트립 잘림 방지, 썸네일 내부 우상단/좌상단 고정) */}
                  <div 
                    className={`absolute inset-x-0 top-0 p-1 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-150 ${
                      currentPage === idx + 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={e => e.stopPropagation()}
                  >
                    <button 
                      onClick={e => { e.stopPropagation(); duplicatePage(pg.id); }} 
                      title="슬라이드 복제" 
                      className="w-4 h-4 bg-gray-800/80 hover:bg-gray-900 rounded flex items-center justify-center text-white"
                    >
                      <Copy size={9} />
                    </button>
                    {pagesData.length > 1 && (
                      <button 
                        onClick={e => { e.stopPropagation(); deletePage(pg.id); }} 
                        title="슬라이드 삭제" 
                        className="w-4 h-4 bg-red-600/80 hover:bg-red-700 rounded flex items-center justify-center text-white"
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={e => { e.stopPropagation(); addBlankPage(); }}
              title="슬라이드 추가"
              className="shrink-0 w-10 h-[52px] md:w-14 md:h-[72px] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Right Panel - 데스크탑 전용 */}
        <div
          className="hidden md:flex border-l border-gray-200 bg-white flex-col shrink-0 overflow-hidden"
          style={{ width: isPanelOpen ? 380 : 0, transition: 'width 0.25s ease' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex border-b border-gray-200 shrink-0">
            <button onClick={() => setActiveTab('edit')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'edit' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> 편집
            </button>
            <button onClick={() => { setActiveTab('element'); setSelectedLayer(null); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'element' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <ShapesIcon size={13} /> 요소
            </button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'ai' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Wand2 size={13} /> AI
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'ai' && <AIPanel pageData={pageData} onApplyChanges={(changes) => updatePageData(pageData.id, changes)} messages={aiMessages} setMessages={setAiMessages} />}
            {activeTab === 'element' && (
              <div className="flex-1 overflow-hidden">
                <ElementPanel
                  onAdd={addElement}
                  selectedElement={selectedElementId ? (pageData.elements || []).find(e => e.id === selectedElementId) ?? null : null}
                  onUpdateElement={updateElement}
                  onDeleteElement={deleteElement}
                />
              </div>
            )}
            {activeTab === 'edit' && !selectedLayer && <div className="flex-1 overflow-y-auto"><DefaultPanel layers={pageLayers} onSelectLayer={handleSelectLayer} /></div>}
            {activeTab === 'edit' && selectedLayer?.type === 'image' && (
              <div className="flex-1 overflow-hidden">
                <ImagePanel
                  key={`${pageData.id}-${selectedLayer.id}`}
                  layer={selectedLayer}
                  currentImageUrl={currentBgImage}
                  cardContent={cardTextContent}
                  imageKeyword={pageData.imageKeyword}
                  initialScale={pageData.bgScale}
                  initialPosition={pageData.bgPosition}
                  initialBrightness={pageData.bgBrightness}
                  initialBrightnessFilter={pageData.bgBrightnessFilter}
                  initialOverlayOpacity={pageData.overlayOpacity}
                  initialBlocksOffsetY={(pageData.blocks?.length ?? 0) > 0 ? (pageData.blocksOffsetY ?? 70) : undefined}
                  onSelectImage={handleSelectImage}
                  onDeselect={handleDeselect}
                  onUpdateBgTransform={(scale, pos) => updatePageData(pageData.id, { bgScale: scale, bgPosition: pos })}
                  onUpdateBrightness={b => updatePageData(pageData.id, { bgBrightness: b })}
                  onUpdateBrightnessFilter={v => updatePageData(pageData.id, { bgBrightnessFilter: v })}
                  onUpdateOverlayOpacity={v => updatePageData(pageData.id, { overlayOpacity: v })}
                  onUpdateBlocksOffsetY={v => updatePageData(pageData.id, { blocksOffsetY: v })}
                  onApplySettingsAll={applyImageSettingsToAllPages}
                />
              </div>
            )}
            {activeTab === 'edit' && selectedLayer?.type === 'text' && (
              <div className="flex-1 overflow-hidden">
                <TextPanel
                  layer={selectedLayer}
                  onDeselect={handleDeselect}
                  onUpdate={(content, style) => updatePageField(pageData.id, selectedLayer.id, content, style)}
                  onApplyStyleAll={applyStyleToAllPages}
                  pageData={pageData}
                  onUpdatePageData={updatePageData}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 하단 패널 */}
      <div className="md:hidden shrink-0 bg-white border-t border-gray-200 z-30" onClick={e => e.stopPropagation()}>
        {/* 탭 바 */}
        <div className="flex border-b border-gray-100">
          {/* 되돌리기 / 다시실행 */}
          <button
            onClick={undo}
            disabled={!canUndo}
            title="되돌리기"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 border-b-2 border-transparent text-[10px] font-bold transition-colors ${canUndo ? 'text-gray-600 active:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <Undo size={15} />
            <span>되돌리기</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="다시실행"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 border-b-2 border-transparent text-[10px] font-bold transition-colors ${canRedo ? 'text-gray-600 active:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <Redo size={15} />
            <span>다시실행</span>
          </button>
          <div className="w-px bg-gray-100 my-1.5" />
          {([
            { key: 'edit', label: '편집', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> },
            { key: 'element', label: '요소', icon: <ShapesIcon size={14} /> },
            { key: 'ai', label: 'AI', icon: <Wand2 size={14} /> },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (mobileActiveTab === tab.key && mobilePanelOpen) {
                  setMobilePanelOpen(false);
                } else {
                  setMobileActiveTab(tab.key);
                  setMobilePanelOpen(true);
                  if (tab.key === 'element') setSelectedLayer(null);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-colors ${mobileActiveTab === tab.key && mobilePanelOpen ? (tab.key === 'ai' ? 'border-primary-600 text-primary-600' : tab.key === 'element' ? 'border-purple-600 text-purple-600' : 'border-gray-900 text-gray-900') : 'border-transparent text-gray-400'}`}
            >
              {tab.icon} {tab.label}
              {mobileActiveTab === tab.key && mobilePanelOpen && <ChevronDown size={12} />}
            </button>
          ))}
        </div>

        {/* 슬라이드업 패널 콘텐츠 */}
        <div style={{ height: mobilePanelOpen ? (mobilePanelExpanded ? '85vh' : '55vh') : 0, overflow: 'hidden', transition: 'height 0.3s ease' }}>
          {mobilePanelOpen && (
            <div className="flex justify-center py-1 border-b border-gray-100">
              <button
                onClick={() => setMobilePanelExpanded(v => !v)}
                className="flex items-center gap-1 text-[10px] text-gray-400 px-3 py-0.5 hover:text-gray-600"
              >
                {mobilePanelExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {mobilePanelExpanded ? '축소' : '확장'}
              </button>
            </div>
          )}
          <div className="h-full overflow-y-auto">
            {mobileActiveTab === 'ai' && <AIPanel pageData={pageData} onApplyChanges={(changes) => updatePageData(pageData.id, changes)} messages={aiMessages} setMessages={setAiMessages} />}
            {mobileActiveTab === 'element' && (
              <ElementPanel
                onAdd={addElement}
                selectedElement={selectedElementId ? (pageData.elements || []).find(e => e.id === selectedElementId) ?? null : null}
                onUpdateElement={updateElement}
                onDeleteElement={deleteElement}
              />
            )}
            {mobileActiveTab === 'edit' && !selectedLayer && <DefaultPanel layers={pageLayers} onSelectLayer={(layer) => { handleSelectLayer(layer); setMobilePanelOpen(true); }} />}
            {mobileActiveTab === 'edit' && selectedLayer?.type === 'image' && (
              <ImagePanel
                key={`m-${pageData.id}-${selectedLayer.id}`}
                layer={selectedLayer}
                currentImageUrl={currentBgImage}
                cardContent={cardTextContent}
                imageKeyword={pageData.imageKeyword}
                initialScale={pageData.bgScale}
                initialPosition={pageData.bgPosition}
                initialBrightness={pageData.bgBrightness}
                initialBrightnessFilter={pageData.bgBrightnessFilter}
                initialOverlayOpacity={pageData.overlayOpacity}
                initialBlocksOffsetY={(pageData.blocks?.length ?? 0) > 0 ? (pageData.blocksOffsetY ?? 70) : undefined}
                onSelectImage={handleSelectImage}
                onDeselect={handleDeselect}
                onUpdateBgTransform={(scale, pos) => updatePageData(pageData.id, { bgScale: scale, bgPosition: pos })}
                onUpdateBrightness={b => updatePageData(pageData.id, { bgBrightness: b })}
                onUpdateBrightnessFilter={v => updatePageData(pageData.id, { bgBrightnessFilter: v })}
                onUpdateOverlayOpacity={v => updatePageData(pageData.id, { overlayOpacity: v })}
                onUpdateBlocksOffsetY={v => updatePageData(pageData.id, { blocksOffsetY: v })}
                onApplySettingsAll={applyImageSettingsToAllPages}
              />
            )}
            {mobileActiveTab === 'edit' && selectedLayer?.type === 'text' && (
              <TextPanel
                layer={selectedLayer}
                onDeselect={handleDeselect}
                onUpdate={(content, style) => updatePageField(pageData.id, selectedLayer.id, content, style)}
                onApplyStyleAll={applyStyleToAllPages}
                pageData={pageData}
                onUpdatePageData={updatePageData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const ImagePlusIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /><line x1="16" y1="5" x2="22" y2="5" /><line x1="19" y1="2" x2="19" y2="8" />
  </svg>
);
const ShapesIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="16" r="4" /><rect x="11" y="2" width="10" height="10" rx="1" /><path d="M17 22l-5-8 5 0z" />
  </svg>
);
const LayoutTemplateIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const LayersIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);

// ─── CardView (시각 전용, 캡처/썸네일용 — 420px 기준) ───────────────────────
function CardView({ page, bgImage, logo }: { page: PageData; bgImage: string; logo?: string }) {
  return (
    <>
      <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
      <div className="absolute inset-0" style={{ background: page.overlay }} />
      {logo && (
        <div className="absolute top-[4%] right-[4%] z-10 opacity-80 pointer-events-none">
          <img src={logo} className="h-4 object-contain" crossOrigin="anonymous" />
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none">
        {page.blocks && page.blocks.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: `${100 - (page.blocksOffsetY ?? 70)}%`,
              left: 28,
              right: 28,
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 40,
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
              <BlockRenderer
                blocks={page.blocks}
                brandTone={page.brandTone}
                availableHeight={Math.floor(525 * (page.blocksOffsetY ?? 70) / 100 - 40)}
                titleStyle={page.titleStyle}
                subtitleStyle={page.subtitleStyle}
                bulletStyle={page.bulletStyle}
              />
            </div>
          </div>
        ) : (
          <>
            {page.layout === 'center' && (
          <div className="flex flex-col items-center justify-center h-full px-10 text-center">
            <h1
              className="drop-shadow-lg whitespace-pre-line"
              style={{
                fontSize: `${page.titleStyle?.fontSize ?? 38}px`,
                fontWeight: page.titleStyle?.fontWeight ?? '900',
                fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                color: page.titleStyle?.color ?? '#FFFFFF',
                lineHeight: page.titleStyle?.lineHeight ?? 1.2,
                letterSpacing: page.titleStyle?.letterSpacing ? `${page.titleStyle.letterSpacing}px` : undefined,
                textAlign: page.titleStyle?.align ?? 'center',
              }}
            >
              {page.title}
            </h1>
            <div className="w-16 h-0.5 bg-white/50 my-4" />
            {page.subtitle && (
              <p
                className="whitespace-pre-line drop-shadow"
                style={{
                  fontSize: `${page.subtitleStyle?.fontSize ?? 14}px`,
                  fontWeight: page.subtitleStyle?.fontWeight ?? '400',
                  fontFamily: page.subtitleStyle?.fontFamily ?? page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                  color: page.subtitleStyle?.color ?? '#E5E7EB',
                  lineHeight: page.subtitleStyle?.lineHeight ?? 1.6,
                  textAlign: page.subtitleStyle?.align ?? 'center',
                }}
              >
                {page.subtitle}
              </p>
            )}
          </div>
        )}
        {(page.layout === 'bottom-left' || page.layout === 'bottom-left-list') && (
          <div className="flex flex-col justify-end h-full px-8 pb-10 gap-5">
            <div className="flex items-start gap-3">
              <span style={{ color: page.accent || '#ffd700', fontSize: `${page.titleStyle?.fontSize ?? 24}px` }} className="mt-0.5 shrink-0">●</span>
              <h2
                className="leading-tight drop-shadow"
                style={{
                  fontSize: `${page.titleStyle?.fontSize ?? 24}px`,
                  fontWeight: page.titleStyle?.fontWeight ?? '900',
                  fontFamily: page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                  color: page.titleStyle?.color ?? (page.accent || '#ffd700'),
                  lineHeight: page.titleStyle?.lineHeight ?? 1.2,
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,215,0,0.5)',
                }}
              >
                {page.title}
              </h2>
            </div>
            {page.bullets && (
              <div className="space-y-2.5 pl-2">
                {page.bullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-white/60 shrink-0 mt-0.5" style={{ fontSize: `${page.bulletStyle?.fontSize ?? 14}px` }}>•</span>
                    <p
                      className="drop-shadow"
                      style={{
                        fontSize: `${page.bulletStyle?.fontSize ?? 14}px`,
                        fontWeight: page.bulletStyle?.fontWeight ?? '400',
                        fontFamily: page.bulletStyle?.fontFamily ?? page.titleStyle?.fontFamily ?? 'Noto Sans KR',
                        color: page.bulletStyle?.color ?? '#FFFFFF',
                        lineHeight: page.bulletStyle?.lineHeight ?? 1.6,
                      }}
                      dangerouslySetInnerHTML={{ __html: bullet.replace(/<b>(.*?)<\/b>/g, `<b style="color:${page.accent || '#ffd700'}">$1</b>`) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
      {/* Free-placement text/shape/emoji elements */}
      {(page.elements || []).map((elem: any) => {
        const W = 420;
        const pxSize = (elem.size / 100) * W;
        const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * W : pxSize;
        const scaledFs = elem.fontSize ?? 16;
        return (
          <div
            key={elem.id}
            style={{
              position: 'absolute', left: `${elem.x}%`, top: `${elem.y}%`,
              width: elem.type === 'text' ? `${textW}px` : `${pxSize}px`,
              height: elem.type === 'text' ? 'auto' : `${pxSize}px`,
              opacity: elem.opacity, zIndex: 15, transform: 'translate(-50%,-50%)',
              pointerEvents: 'none',
            }}
          >
            {elem.type === 'shape' && elem.shape && <ShapeSVG shape={elem.shape} color={elem.color} />}
            {elem.type === 'emoji' && <span style={{ fontSize: `${pxSize}px`, lineHeight: 1, userSelect: 'none' }}>{elem.emoji}</span>}
            {elem.type === 'text' && elem.text && (
              <p style={{
                fontSize: `${scaledFs}px`, fontWeight: elem.fontWeight ?? '400',
                fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                textAlign: elem.textAlign ?? 'left', color: elem.color,
                lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: '2px 4px',
              }}>{elem.text}</p>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── FullscreenEditor ────────────────────────────────────────────────────────
function FullscreenEditor({
  pagesData, initialPage, pageImages, onSelectImage, onUpdatePage, onApplyPageChanges, onClose, brandLogo,
}: {
  pagesData: PageData[];
  initialPage: number;
  pageImages: Record<string, string>;
  onSelectImage: (url: string, pageId: string) => void;
  onUpdatePage: (pageId: string, layerId: number, content: string, style?: TextStyle) => void;
  onApplyPageChanges: (pageId: string, changes: Partial<PageData>) => void;
  onClose: () => void;
  brandLogo?: string;
}) {
  const [fsPage, setFsPage] = useState(initialPage);
  const [selectedLayer, setSelectedLayer] = useState<CanvasLayerWithSrc | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'ai' | 'element'>('edit');
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draggingElemId, setDraggingElemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [editingElemId, setEditingElemId] = useState<string | null>(null);
  const [fsGuideLines, setFsGuideLines] = useState<{ x?: number; y?: number }[]>([]);
  const fsDragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number; cw: number; ch: number } | null>(null);
  const fsCanvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(500);

  const fsSnapToGuide = (val: number): { snapped: number; guides: number[] } => {
    const SNAP_POINTS = [25, 33.33, 50, 66.67, 75];
    for (const pt of SNAP_POINTS) { if (Math.abs(val - pt) < 3) return { snapped: pt, guides: [pt] }; }
    return { snapped: val, guides: [] };
  };

  const safeFsPageIndex = pagesData.length > 0 ? Math.max(0, Math.min(fsPage - 1, pagesData.length - 1)) : 0;
  const pageData = pagesData[safeFsPageIndex] || PAGES_DATA[0];
  const currentBgImage = pageData ? (pageImages[pageData.id] ?? pageData.bgImage) : '';
  const rawLayers = getLayersForPage(pageData);
  const pageLayers: CanvasLayerWithSrc[] = [
    { ...(rawLayers[0] || {}), imageSrc: currentBgImage } as CanvasLayerWithSrc,
    ...rawLayers.slice(1),
  ];
  const cardTextContent = pageData
    ? [
        pageData.title,
        pageData.subtitle,
        ...(pageData.bullets || []).map(b => b.replace(/<[^>]+>/g, '')),
      ].filter(Boolean).join('\n')
    : '';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsPanelOpen(false); // Close panel by default on mobile to show the canvas first
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 48;
      const thumbH = 88;
      const isMobile = el.clientWidth < 768;
      const panelW = (isPanelOpen && !isMobile) ? 360 : 0;
      const availH = el.clientHeight - thumbH - pad;
      const availW = el.clientWidth - 48 - panelW - pad;
      setCanvasW(Math.max(280, Math.floor(Math.min(availW, availH * (4 / 5)))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPanelOpen]);

  const handleSelectLayer = (layer: CanvasLayerWithSrc) => {
    setSelectedLayer(layer); setActiveTab('edit'); setIsPanelOpen(true);
  };
  const handleDeselect = () => { setSelectedLayer(null); setEditingElemId(null); };
  const handlePageChange = (id: number) => { setFsPage(id); setSelectedLayer(null); setSelectedElementId(null); setEditingElemId(null); };

  const fsAddElement = (elem: Omit<CanvasElement, 'id'>) => {
    if (!pageData) return;
    const newElem: CanvasElement = { ...elem, id: `el_${Date.now()}` };
    const pd = pageData;
    onApplyPageChanges(pageData.id, { elements: [...(pd.elements || []), newElem] });
    setSelectedElementId(newElem.id);
    setActiveTab('element');
  };
  const fsUpdateElement = (id: string, updates: Partial<CanvasElement>) => {
    if (!pageData) return;
    const pd = pageData;
    onApplyPageChanges(pageData.id, { elements: (pd.elements || []).map(e => e.id === id ? { ...e, ...updates } : e) });
  };
  const fsDeleteElement = (id: string) => {
    if (!pageData) return;
    const pd = pageData;
    onApplyPageChanges(pageData.id, { elements: (pd.elements || []).filter(e => e.id !== id) });
    setSelectedElementId(null);
  };
  const handleFSElemPointerDown = (e: React.PointerEvent, elem: CanvasElement) => {
    e.stopPropagation();
    setSelectedElementId(elem.id);
    setActiveTab('element');
    setSelectedLayer(null);
    if (!fsCanvasRef.current) return;
    const rect = fsCanvasRef.current.getBoundingClientRect();
    fsDragStartRef.current = { startX: e.clientX, startY: e.clientY, origX: elem.x, origY: elem.y, cw: rect.width, ch: rect.height };
    setDraggingElemId(elem.id);
    setDragPos({ x: elem.x, y: elem.y });
  };
  const handleFSCanvasPointerMove = (e: React.PointerEvent) => {
    if (!draggingElemId || !fsDragStartRef.current) return;
    const { startX, startY, origX, origY, cw, ch } = fsDragStartRef.current;
    const rawX = Math.max(5, Math.min(95, origX + ((e.clientX - startX) / cw) * 100));
    const rawY = Math.max(5, Math.min(95, origY + ((e.clientY - startY) / ch) * 100));
    const { snapped: newX, guides: xGuides } = fsSnapToGuide(rawX);
    const { snapped: newY, guides: yGuides } = fsSnapToGuide(rawY);
    setDragPos({ x: newX, y: newY });
    setFsGuideLines([...xGuides.map((g: number) => ({ x: g })), ...yGuides.map((g: number) => ({ y: g }))]);
  };
  const handleFSCanvasPointerUp = () => {
    if (draggingElemId && dragPos) fsUpdateElement(draggingElemId, dragPos);
    setDraggingElemId(null);
    setDragPos(null);
    setFsGuideLines([]);
    fsDragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0d0d1a] flex flex-col" onClick={handleDeselect}>
      {/* Top bar */}
      <div className="h-12 bg-[#13132a] border-b border-white/10 flex items-center justify-between px-4 shrink-0 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span className="text-white font-bold text-sm">{fsPage}페이지 전체화면 편집</span>
          </div>
          <div className="flex items-center gap-0.5 text-white/50 text-xs">
            <button onClick={() => handlePageChange(Math.max(1, fsPage - 1))} className="p-1 hover:bg-white/10 rounded text-white/60"><ChevronLeft size={13} /></button>
            <span className="px-1 font-medium">{fsPage} / {pagesData.length}</span>
            <button onClick={() => handlePageChange(Math.min(pagesData.length, fsPage + 1))} className="p-1 hover:bg-white/10 rounded text-white/60"><ChevronRight size={13} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPanelOpen(v => !v)}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-medium"
            title="패널 토글"
          >
            {isPanelOpen
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="19 9 15 12 19 15"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="11 9 15 12 11 15"/></svg>
            }
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Minimize2 size={12} /> 편집 종료
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={wrapRef} className="flex flex-1 overflow-hidden">
        {/* Left tools */}
        <div className="w-12 bg-[#13132a] border-r border-white/10 flex flex-col items-center py-3 gap-1.5 shrink-0">
          {[
            { icon: <span className="font-serif text-sm font-black text-white/60">T</span>, label: '텍스트' },
            { icon: <ImagePlusIcon size={15} />, label: '이미지' },
            { icon: <ShapesIcon size={15} />, label: '도형' },
            { icon: <LayoutTemplateIcon size={15} />, label: '레이아웃' },
            { icon: <Film size={15} />, label: '영상' },
          ].map(item => (
            <button key={item.label} title={item.label} className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors">
              {item.icon}
            </button>
          ))}
        </div>

        {/* Canvas + thumbnails column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas scroll area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div
              ref={fsCanvasRef}
              className="relative bg-white shadow-2xl ring-1 ring-white/10 flex-shrink-0 overflow-hidden"
              style={{ width: `${canvasW}px`, aspectRatio: '4/5' }}
              onClick={e => e.stopPropagation()}
              onPointerMove={handleFSCanvasPointerMove}
              onPointerUp={handleFSCanvasPointerUp}
              onPointerLeave={handleFSCanvasPointerUp}
            >
              {/* 정렬 가이드 라인 */}
              {fsGuideLines.map((g, i) => (
                g.x !== undefined
                  ? <div key={i} className="absolute top-0 bottom-0 pointer-events-none z-50" style={{ left: `${g.x}%`, width: 1, background: 'rgba(99,102,241,0.8)' }} />
                  : <div key={i} className="absolute left-0 right-0 pointer-events-none z-50" style={{ top: `${g.y}%`, height: 1, background: 'rgba(99,102,241,0.8)' }} />
              ))}
              {/* Canvas layers */}
              {(() => {
                const eyebrowBlock = pageData.blocks?.find(b => b.type === 'eyebrow');
                const eyebrowText = eyebrowBlock && 'text' in eyebrowBlock ? eyebrowBlock.text : undefined;

                const innerLayers = (
                  <>
                    {/* Background image */}
                    <div
                      onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[0]); }}
                      className={`absolute inset-0 cursor-pointer transition-all overflow-hidden ${selectedLayer?.id === 0 ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-primary-300/60'}`}
                    >
                      <img src={currentBgImage} alt="배경" className="w-full h-full object-cover"
                        style={{
                          transform: `scale(${pageData.bgScale ?? 1})`,
                          transformOrigin: `${pageData.bgPosition?.x ?? 50}% ${pageData.bgPosition?.y ?? 50}%`,
                          filter: `brightness(${(pageData.bgBrightnessFilter ?? 100) / 100})`,
                          transition: 'transform 0.1s ease',
                        }}
                      />
                      <div className="absolute inset-0" style={{ background: pageData.overlay, opacity: (pageData.overlayOpacity ?? 100) / 100 }} />
                      {(pageData.bgBrightness ?? 0) > 0 && (
                        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${(pageData.bgBrightness ?? 0) / 100})` }} />
                      )}
                      {brandLogo && !pageData.showFrame && (
                        <div className="absolute top-[4%] right-[4%] z-10 opacity-80 pointer-events-none">
                          <img src={brandLogo} className="h-4 object-contain" style={{ height: `${(16 * canvasW) / 420}px` }} />
                        </div>
                      )}
                      {selectedLayer?.id === 0 && (
                        <span className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                          🖼 {pageData.bgLabel}
                        </span>
                      )}
                    </div>

                    {/* Text layers */}
                    <div className="absolute inset-0 pointer-events-none">
                      {pageData.blocks && pageData.blocks.length > 0 ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: `${100 - (pageData.blocksOffsetY ?? 70)}%`,
                            left: 28,
                            right: 28,
                            display: 'flex',
                            flexDirection: 'column',
                            paddingBottom: 40,
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
                            <BlockRenderer
                              blocks={pageData.blocks}
                              brandTone={pageData.brandTone}
                              availableHeight={Math.floor(canvasW * 1.25 * (pageData.blocksOffsetY ?? 70) / 100 - 40)}
                              titleStyle={pageData.titleStyle}
                              subtitleStyle={pageData.subtitleStyle}
                              bulletStyle={pageData.bulletStyle}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {pageData.layout === 'center' && (
                            <div className="flex flex-col items-center justify-center h-full px-10 text-center">
                              <div onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[1]); }} className={`pointer-events-auto cursor-pointer mb-4 rounded px-2 py-1 transition-all ${selectedLayer?.id === 1 ? 'ring-1 ring-white/60 bg-white/10' : 'hover:bg-white/10'}`}>
                                <h1
                                  className="drop-shadow-lg whitespace-pre-line"
                                  style={{
                                    fontSize: `${((pageData.titleStyle?.fontSize ?? 38) * canvasW) / 420}px`,
                                    fontWeight: pageData.titleStyle?.fontWeight ?? '900',
                                    color: pageData.titleStyle?.color ?? '#FFFFFF',
                                    lineHeight: pageData.titleStyle?.lineHeight ?? 1.2,
                                    letterSpacing: pageData.titleStyle?.letterSpacing ? `${pageData.titleStyle.letterSpacing}px` : undefined,
                                    textAlign: pageData.titleStyle?.align ?? 'center',
                                  }}
                                >
                                  {pageData.title}
                                </h1>
                              </div>
                              <div className="w-16 h-0.5 bg-white/50 mb-4" />
                              {pageData.subtitle && (
                                <div onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[2]); }} className={`pointer-events-auto cursor-pointer rounded px-2 py-1 transition-all ${selectedLayer?.id === 2 ? 'ring-1 ring-white/60 bg-white/10' : 'hover:bg-white/10'}`}>
                                  <p
                                    className="whitespace-pre-line drop-shadow"
                                    style={{
                                      fontSize: `${((pageData.subtitleStyle?.fontSize ?? 14) * canvasW) / 420}px`,
                                      fontWeight: pageData.subtitleStyle?.fontWeight ?? '400',
                                      fontFamily: pageData.subtitleStyle?.fontFamily ?? pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                      color: pageData.subtitleStyle?.color ?? '#E5E7EB',
                                      lineHeight: pageData.subtitleStyle?.lineHeight ?? 1.6,
                                      textAlign: pageData.subtitleStyle?.align ?? 'center',
                                    }}
                                  >
                                    {pageData.subtitle}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {(pageData.layout === 'bottom-left' || pageData.layout === 'bottom-left-list') && (
                            <div className="flex flex-col justify-end h-full px-8 pb-10 gap-5">
                              <div onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[1]); }} className={`pointer-events-auto cursor-pointer flex items-start gap-3 rounded px-1 py-1 transition-all ${selectedLayer?.id === 1 ? 'ring-1 ring-white/50 bg-white/10' : 'hover:bg-white/10'}`}>
                                <span style={{ color: pageData.accent || '#ffd700', fontSize: `${((pageData.titleStyle?.fontSize ?? 24) * canvasW) / 420}px` }} className="mt-0.5 shrink-0">●</span>
                                <h2
                                  className="leading-tight drop-shadow"
                                  style={{
                                    fontSize: `${((pageData.titleStyle?.fontSize ?? 24) * canvasW) / 420}px`,
                                    fontWeight: pageData.titleStyle?.fontWeight ?? '900',
                                    color: pageData.titleStyle?.color ?? (pageData.accent || '#ffd700'),
                                    lineHeight: pageData.titleStyle?.lineHeight ?? 1.2,
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(255,215,0,0.4)',
                                  }}
                                >
                                  {pageData.title}
                                </h2>
                              </div>
                              {pageData.bullets && (
                                <div className="space-y-2.5 pl-2">
                                  {pageData.bullets.map((bullet, i) => (
                                    <div key={i} onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[2 + i]); }} className={`pointer-events-auto cursor-pointer flex items-start gap-2 rounded px-1 py-0.5 transition-all ${selectedLayer?.id === 2 + i ? 'ring-1 ring-white/50 bg-white/10' : 'hover:bg-white/10'}`}>
                                      <span className="text-white/60 shrink-0 mt-0.5" style={{ fontSize: `${((pageData.bulletStyle?.fontSize ?? 14) * canvasW) / 420}px` }}>•</span>
                                      <p
                                        className="drop-shadow"
                                        style={{
                                          fontSize: `${((pageData.bulletStyle?.fontSize ?? 14) * canvasW) / 420}px`,
                                          fontWeight: pageData.bulletStyle?.fontWeight ?? '400',
                                          fontFamily: pageData.bulletStyle?.fontFamily ?? pageData.titleStyle?.fontFamily ?? 'Noto Sans KR',
                                          color: pageData.bulletStyle?.color ?? '#FFFFFF',
                                          lineHeight: pageData.bulletStyle?.lineHeight ?? 1.6,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: bullet.replace(/<b>(.*?)<\/b>/g, `<b style="color:${pageData.accent || '#ffd700'}">$1</b>`) }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Canvas Elements Layer (FS) */}
                    {(pageData.elements || []).map(elem => {
                      const isSelected = selectedElementId === elem.id;
                      const isEditing = editingElemId === elem.id;
                      const displayX = draggingElemId === elem.id && dragPos ? dragPos.x : elem.x;
                      const displayY = draggingElemId === elem.id && dragPos ? dragPos.y : elem.y;
                      const pxSize = (elem.size / 100) * canvasW;
                      const textW = elem.type === 'text' ? ((elem.width ?? 80) / 100) * canvasW : pxSize;
                      const scaledFs = ((elem.fontSize ?? 16) * canvasW) / 420;
                      return (
                        <div key={elem.id}
                          className={`absolute select-none ${isEditing ? 'cursor-text' : 'cursor-move'} ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 rounded-sm' : 'hover:ring-1 hover:ring-blue-300 rounded-sm'}`}
                          style={{
                            left: `${displayX}%`, top: `${displayY}%`,
                            width: elem.type === 'text' ? `${textW}px` : `${pxSize}px`,
                            height: elem.type === 'text' ? 'auto' : `${pxSize}px`,
                            opacity: elem.opacity, zIndex: 15, transform: 'translate(-50%,-50%)',
                            touchAction: 'none',
                          }}
                          onPointerDown={e => { if (!isEditing) handleFSElemPointerDown(e, elem); }}
                          onDoubleClick={e => { if (elem.type === 'text') { e.stopPropagation(); setEditingElemId(elem.id); } }}
                        >
                          {elem.type === 'shape' && elem.shape && <ShapeSVG shape={elem.shape} color={elem.color} />}
                          {elem.type === 'emoji' && <span style={{ fontSize: `${pxSize}px`, lineHeight: 1, userSelect: 'none' }}>{elem.emoji}</span>}
                          {elem.type === 'text' && (
                            isEditing ? (
                              <textarea
                                autoFocus
                                defaultValue={elem.text ?? ''}
                                onBlur={e => { fsUpdateElement(elem.id, { text: e.target.value }); setEditingElemId(null); }}
                                onPointerDown={e => e.stopPropagation()}
                                rows={3}
                                style={{
                                  width: '100%', background: 'transparent', border: 'none', outline: '2px solid rgba(59,130,246,0.6)',
                                  resize: 'none', padding: '2px 4px', borderRadius: 2,
                                  fontSize: `${scaledFs}px`, fontWeight: elem.fontWeight ?? '400',
                                  fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                                  textAlign: elem.textAlign ?? 'left', color: elem.color, lineHeight: 1.4,
                                }}
                              />
                            ) : (
                              <p style={{
                                fontSize: `${scaledFs}px`, fontWeight: elem.fontWeight ?? '400',
                                fontFamily: elem.fontFamily ?? 'Noto Sans KR',
                                textAlign: elem.textAlign ?? 'left', color: elem.color,
                                lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                margin: 0, padding: '2px 4px', userSelect: 'none',
                              }}>
                                {elem.text || <span style={{ opacity: 0.4 }}>텍스트 입력...</span>}
                              </p>
                            )
                          )}
                          {isSelected && !isEditing && (
                            <button className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-lg z-20 cursor-pointer hover:bg-red-600"
                              onPointerDown={e => e.stopPropagation()}
                              onClick={e => { e.stopPropagation(); fsDeleteElement(elem.id); }}>×</button>
                          )}
                        </div>
                      );
                    })}
                  </>
                );

                if (pageData.showFrame) {
                  return (
                    <SlideFrame
                      page={fsPage}
                      total={pagesData.length}
                      brandTone={pageData.brandTone}
                      eyebrow={undefined}
                      handle={pageData.handle ?? '@aptshowhome'}
                    >
                      {innerLayers}
                    </SlideFrame>
                  );
                }
                return innerLayers;
              })()}

              {/* Floating toolbar */}
              {selectedLayer && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-xl shadow-xl px-2 py-1.5 border border-gray-100 z-20" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200">
                    <div className="w-2 h-2 rounded-full bg-primary-600" />
                    <span className="text-xs font-bold text-primary-700 whitespace-nowrap">
                      {selectedLayer.type === 'image' ? '이미지 편집 중' : '텍스트 편집 중'}
                    </span>
                  </div>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><LayersIcon size={14} /></button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><Copy size={14} /></button>
                  <button className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" onClick={handleDeselect}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="h-[88px] bg-[#13132a] border-t border-white/10 flex items-center gap-2.5 px-4 overflow-x-auto shrink-0">
            {pagesData.map((pg, idx) => (
              <div key={pg.id} onClick={() => handlePageChange(idx + 1)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all ${fsPage === idx + 1 ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-[#13132a]' : 'opacity-60 hover:opacity-90'}`}
                style={{ width: 44, height: 55 }}
              >
                <img src={(pageImages[pg.id] ?? pg.bgImage).replace('w=800', 'w=80')} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: pg.overlay }} />
                <div className="absolute bottom-0.5 right-0.5 text-[7px] text-white font-bold bg-black/50 rounded px-0.5">{idx + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div
          className="absolute md:relative right-0 top-12 md:top-0 bottom-0 bg-white flex flex-col shrink-0 overflow-hidden border-l border-gray-200 z-40 md:z-auto shadow-2xl md:shadow-none max-w-[calc(100vw-48px)]"
          style={{ width: isPanelOpen ? 360 : 0, transition: 'width 0.25s ease' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex border-b border-gray-200 shrink-0">
            <button onClick={() => setActiveTab('edit')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'edit' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 편집
            </button>
            <button onClick={() => { setActiveTab('element'); setSelectedLayer(null); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'element' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <ShapesIcon size={13} /> 요소
            </button>
            <button onClick={() => setActiveTab('ai')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'ai' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Wand2 size={13} /> AI
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'ai' && pageData && <AIPanel pageData={pageData} onApplyChanges={(changes) => onApplyPageChanges(pageData.id, changes)} messages={aiMessages} setMessages={setAiMessages} />}
            {activeTab === 'element' && (
              <div className="flex-1 overflow-hidden">
                <ElementPanel
                  onAdd={fsAddElement}
                  selectedElement={selectedElementId ? (pageData.elements || []).find(e => e.id === selectedElementId) ?? null : null}
                  onUpdateElement={fsUpdateElement}
                  onDeleteElement={fsDeleteElement}
                />
              </div>
            )}
            {activeTab === 'edit' && !selectedLayer && <div className="flex-1 overflow-y-auto"><DefaultPanel layers={pageLayers} onSelectLayer={handleSelectLayer} /></div>}
            {activeTab === 'edit' && selectedLayer?.type === 'image' && pageData && (
              <div className="flex-1 overflow-hidden">
                <ImagePanel
                  key={`fs-${pageData.id}-${selectedLayer.id}`}
                  layer={selectedLayer}
                  currentImageUrl={currentBgImage}
                  cardContent={cardTextContent}
                  imageKeyword={pageData.imageKeyword}
                  initialScale={pageData.bgScale}
                  initialPosition={pageData.bgPosition}
                  initialBrightness={pageData.bgBrightness}
                  initialBrightnessFilter={pageData.bgBrightnessFilter}
                  initialOverlayOpacity={pageData.overlayOpacity}
                  initialBlocksOffsetY={(pageData.blocks?.length ?? 0) > 0 ? (pageData.blocksOffsetY ?? 70) : undefined}
                  onSelectImage={url => onSelectImage(url, pageData.id)}
                  onDeselect={handleDeselect}
                  onUpdateBgTransform={(scale, pos) => onApplyPageChanges(pageData.id, { bgScale: scale, bgPosition: pos })}
                  onUpdateBrightness={b => onApplyPageChanges(pageData.id, { bgBrightness: b })}
                  onUpdateBrightnessFilter={v => onApplyPageChanges(pageData.id, { bgBrightnessFilter: v })}
                  onUpdateOverlayOpacity={v => onApplyPageChanges(pageData.id, { overlayOpacity: v })}
                  onUpdateBlocksOffsetY={v => onApplyPageChanges(pageData.id, { blocksOffsetY: v })}
                />
              </div>
            )}
            {activeTab === 'edit' && selectedLayer?.type === 'text' && pageData && (
              <div className="flex-1 overflow-hidden">
                <TextPanel
                  layer={selectedLayer}
                  onDeselect={handleDeselect}
                  onUpdate={(content, style) => onUpdatePage(pageData.id, selectedLayer.id, content, style)}
                  pageData={pageData}
                  onUpdatePageData={onApplyPageChanges}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SaveTemplateModal ────────────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = ['내 템플릿', '비즈니스', '라이프스타일', '음식/카페', '뷰티/패션', '부동산', '교육', '여행', '기타'];

function SaveTemplateModal({ pagesData, onClose }: { pagesData: PageData[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('내 템플릿');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('템플릿 이름을 입력해주세요'); return; }
    setSaving(true);
    setError('');
    try {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('로그인이 필요합니다'); setSaving(false); return; }

      const { error: dbError } = await supabase.from('user_templates').upsert(
        { user_id: user.id, name: name.trim(), category, pages: pagesData },
        { onConflict: 'user_id,name' }
      );
      if (dbError) { setError(dbError.message); setSaving(false); return; }
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center text-base">⭐</div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">내 템플릿으로 저장</h2>
              <p className="text-[11px] text-gray-400">카드뉴스 생성 탭에서 재사용 가능</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">템플릿 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="예: 피드 카드뉴스 기본형"
              autoFocus
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${error ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-100'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${category === cat ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-xl border border-violet-100 text-xs text-violet-700">
            <span>✨</span>
            <span>{pagesData.length}장 레이아웃 저장 · 카드뉴스 생성 탭 "내 템플릿"에서 불러올 수 있습니다</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">취소</button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm ${saved ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700 active:scale-[0.98]'} disabled:opacity-60`}
            >
              {saved ? <><Check size={14} /> 저장 완료!</> : saving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : <>⭐ 템플릿으로 저장</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SaveLocalModal ───────────────────────────────────────────────────────────
const MY_CARDNEWS_KEY = 'my_saved_cardnews';

interface SavedCardNews {
  id: string;
  name: string;
  createdAt: string;
  pages: PageData[];
}

function loadSavedCardNews(): SavedCardNews[] {
  try {
    const raw = localStorage.getItem(MY_CARDNEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCardNewsToLocal(name: string, pages: PageData[]): void {
  const list = loadSavedCardNews();
  const next: SavedCardNews = {
    id: `cn_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    pages,
  };
  const updated = [next, ...list].slice(0, 20);
  localStorage.setItem(MY_CARDNEWS_KEY, JSON.stringify(updated));
}

function SaveLocalModal({ pagesData, onClose }: { pagesData: PageData[]; onClose: () => void }) {
  const [name, setName] = useState(`카드뉴스 ${new Date().toLocaleDateString('ko-KR')}`);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setError('이름을 입력해주세요'); return; }
    try {
      saveCardNewsToLocal(name.trim(), pagesData);
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError('저장 중 오류가 발생했습니다: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FolderOpen size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">내 카드뉴스 저장</h2>
              <p className="text-[11px] text-gray-400">이 기기에 저장됩니다 (최대 20개)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="카드뉴스 이름"
              autoFocus
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${error ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{pagesData.length}장 저장 · 나중에 카드뉴스 생성 탭에서 불러올 수 있습니다</span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">취소</button>
            <button
              onClick={handleSave}
              disabled={saved}
              className={`flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm ${saved ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'}`}
            >
              {saved ? <><Check size={14} /> 저장 완료!</> : <><FolderOpen size={14} /> 저장하기</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SaveDesignModal ──────────────────────────────────────────────────────────
function SaveDesignModal({
  pagesData, pageImages, onClose,
}: {
  pagesData: PageData[];
  pageImages: Record<string, string>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const pageLabels = ['커버', '콘텐츠 1', '콘텐츠 2', '콘텐츠 3', '마무리'];

  const handleSave = async () => {
    if (!name.trim()) { setError('디자인 이름을 입력해주세요'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: desc.trim() || null,
        pagesData: pagesData.map(pg => ({
          ...pg,
          bgImage: pageImages[pg.id] ?? pg.bgImage,
        })),
      };
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">디자인 저장</h2>
            <p className="text-sm text-gray-500 mt-0.5">현재 카드뉴스의 디자인을 재사용 가능한 템플릿으로 저장합니다.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Template previews */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">추출된 템플릿</h3>
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-2 min-w-max">
                {pagesData.map((pg, idx) => (
                  <div key={pg.id} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-gray-500 text-center">{pageLabels[idx] || `페이지 ${pg.id}`}</span>
                    <div className="relative overflow-hidden rounded-lg shadow-md border border-gray-200" style={{ width: 140, height: 175 }}>
                      <CardView page={pg} bgImage={pageImages[pg.id] ?? pg.bgImage} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Design name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">디자인 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="디자인 이름을 입력하세요"
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${error ? 'border-red-400 ring-1 ring-red-200 placeholder:text-red-300' : 'border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-100'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">설명 <span className="font-normal text-gray-400">(선택)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="디자인에 대한 설명을 입력하세요"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100 transition-all"
            />
          </div>

          {/* Save destination info */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-blue-700 leading-relaxed">
              저장된 디자인은 <strong>Supabase &gt; card_designs</strong> 테이블에 보관됩니다.
              나중에 새 카드뉴스 생성 시 이 템플릿을 불러와 재사용할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm flex items-center gap-2 ${saved ? 'bg-green-500' : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'} disabled:opacity-60`}
          >
            {saved ? <><Check size={14} /> 저장 완료!</> : saving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : '디자인 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DownloadModal ─────────────────────────────────────────────────────────────
type DownloadRatio = '1:1' | '4:5' | '9:16';
type DownloadFormat = 'png' | 'zip' | 'pdf';

function DownloadModal({
  pagesData, pageImages, currentPage, captureRefs, brandLogo, onClose,
}: {
  pagesData: PageData[];
  pageImages: Record<string, string>;
  currentPage: number;
  captureRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  brandLogo?: string;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<DownloadRatio>('4:5');
  const [format, setFormat] = useState<DownloadFormat>('zip');
  const [transparentBg, setTransparentBg] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);

  const SCALE = 1080 / 420; // ≈ 2.571 → 출력 1080px 폭

  // 외부 이미지를 프록시를 통해 data URL로 변환 (CORS 우회)
  const preloadImagesViaProxy = async (el: HTMLDivElement): Promise<Map<HTMLImageElement, string>> => {
    const imgs = Array.from(el.querySelectorAll('img'));
    const origSrcs = new Map<HTMLImageElement, string>();
    await Promise.all(imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || src.startsWith('/') || src.startsWith(window.location.origin)) return;
      origSrcs.set(img, src);
      try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
      } catch {
        origSrcs.delete(img);
      }
    }));
    return origSrcs;
  };

  const restoreImages = (origSrcs: Map<HTMLImageElement, string>) => {
    origSrcs.forEach((src, img) => { img.src = src; });
  };

  // html-to-image로 캡처 (외부 이미지 CORS 우회 포함)
  const captureEl = async (el: HTMLDivElement): Promise<HTMLCanvasElement> => {
    const { toCanvas } = await import('html-to-image');
    const origSrcs = await preloadImagesViaProxy(el);
    try {
      const opts: Parameters<typeof toCanvas>[1] = {
        pixelRatio: SCALE,
        cacheBust: false,
        skipFonts: false,
      };
      if (transparentBg) opts.backgroundColor = 'transparent';
      const canvas = await toCanvas(el, opts);
      return canvas;
    } finally {
      restoreImages(origSrcs);
    }
  };

  // 비율에 맞게 캔버스 변환
  const applyRatio = (src: HTMLCanvasElement, r: DownloadRatio): HTMLCanvasElement => {
    if (r === '4:5') return src;
    const sw = src.width;   // ~1080
    const sh = src.height;  // ~1350
    const tw = sw;
    const th = r === '1:1' ? sw : Math.round(sw * 16 / 9); // 1080 or 1920
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const ctx = out.getContext('2d')!;
    if (r === '1:1') {
      const cropY = (sh - tw) / 2;
      ctx.drawImage(src, 0, cropY, tw, tw, 0, 0, tw, tw);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, tw, th);
      const padY = (th - sh) / 2;
      ctx.drawImage(src, 0, 0, sw, sh, 0, padY, sw, sh);
    }
    return out;
  };

  const capturePages = async (ids: string[]): Promise<{ id: string; dataUrl: string; title: string }[]> => {
    const results: { id: string; dataUrl: string; title: string }[] = [];
    for (const id of ids) {
      const pg = pagesData.find(p => String(p.id) === String(id));
      if (!pg) continue;
      const el = captureRefs.current?.[id];
      if (!el) continue;
      setProgress(`${id}/${ids.length}장 캡처 중...`);
      const raw = await captureEl(el);
      const final = applyRatio(raw, ratio);
      results.push({ id, dataUrl: final.toDataURL('image/png'), title: pg.title.replace(/[\n/\\]/g, '_').slice(0, 20) });
    }
    return results;
  };

  const triggerDownload = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleDownload = async () => {
    if (progress) return;
    const suffix = ratio === '4:5' ? '' : `_${ratio.replace(':', 'x')}`;
    try {
      if (format === 'png') {
        setProgress('캡처 중...');
        const pageId = pagesData[currentPage - 1]?.id;
        if (pageId === undefined) return;
        const [cap] = await capturePages([pageId]);
        triggerDownload(cap.dataUrl, `카드뉴스_${currentPage}페이지${suffix}.png`);
        setDone(true);
        setTimeout(onClose, 800);
      } else if (format === 'zip') {
        setProgress('준비 중...');
        const [JSZip, { saveAs }] = await Promise.all([
          import('jszip').then(m => m.default),
          import('file-saver'),
        ]);
        const caps = await capturePages(pagesData.map(p => p.id));
        const zip = new JSZip();
        setProgress('ZIP 압축 중...');
        for (const c of caps) {
          const blob = await fetch(c.dataUrl).then(r => r.blob());
          zip.file(`page_${c.id}_${c.title}${suffix}.png`, blob);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `카드뉴스_전체${suffix}.zip`);
        setDone(true);
        setTimeout(onClose, 800);
      } else {
        setProgress('준비 중...');
        const { jsPDF } = await import('jspdf');
        const caps = await capturePages(pagesData.map(p => p.id));
        const [pw, ph] = ratio === '1:1' ? [170, 170] : ratio === '4:5' ? [170, 212.5] : [95.6, 170];
        const pdf = new jsPDF({ orientation: ratio === '9:16' ? 'portrait' : 'portrait', unit: 'mm', format: [pw, ph] });
        for (let i = 0; i < caps.length; i++) {
          if (i > 0) pdf.addPage([pw, ph]);
          pdf.addImage(caps[i].dataUrl, 'PNG', 0, 0, pw, ph);
          setProgress(`PDF ${i + 1}/${caps.length}장 추가 중...`);
        }
        pdf.save(`카드뉴스_전체${suffix}.pdf`);
        setDone(true);
        setTimeout(onClose, 800);
      }
    } catch (e: any) {
      setProgress('');
      alert('다운로드 실패: ' + friendlyError(e));
    }
  };

  const ratioOptions: { value: DownloadRatio; label: string; size: string; w: number; h: number }[] = [
    { value: '1:1', label: '1:1', size: '1080×1080', w: 10, h: 10 },
    { value: '4:5', label: '4:5', size: '1080×1350', w: 10, h: 12.5 },
    { value: '9:16', label: '9:16', size: '1080×1920', w: 10, h: 17.8 },
  ];

  const formatOptions: { value: DownloadFormat; label: string; sub: string }[] = [
    { value: 'png', label: 'PNG', sub: `현재 ${currentPage}페이지` },
    { value: 'zip', label: 'ZIP', sub: `전체 ${pagesData.length}장` },
    { value: 'pdf', label: 'PDF', sub: `전체 ${pagesData.length}장` },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-600"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">다운로드</h2>
              <p className="text-[11px] text-gray-400">비율과 형식을 선택하세요</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* 비율 선택 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-3">비율 선택</p>
            <div className="flex gap-3">
              {ratioOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRatio(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${ratio === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {/* 비율 박스 시각화 */}
                  <div className="flex items-end justify-center" style={{ height: 32 }}>
                    <div
                      className={`rounded border-2 ${ratio === opt.value ? 'border-primary-500 bg-primary-100' : 'border-gray-300 bg-gray-100'}`}
                      style={{ width: `${opt.w * 1.8}px`, height: `${Math.min(opt.h * 1.8, 32)}px` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${ratio === opt.value ? 'text-primary-600' : 'text-gray-600'}`}>{opt.label}</span>
                  <span className={`text-[10px] ${ratio === opt.value ? 'text-primary-400' : 'text-gray-400'}`}>{opt.size}</span>
                </button>
              ))}
            </div>
            {ratio === '1:1' && <p className="text-[11px] text-amber-600 mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">슬라이드 중앙을 기준으로 정방형 크롭됩니다.</p>}
            {ratio === '9:16' && <p className="text-[11px] text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-lg">인스타그램 스토리 비율. 상하에 검은색 여백이 추가됩니다.</p>}
          </div>

          {/* 형식 선택 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-3">형식</p>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all ${format === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <span className={`text-sm font-bold ${format === opt.value ? 'text-primary-600' : 'text-gray-600'}`}>{opt.label}</span>
                  <span className={`text-[10px] ${format === opt.value ? 'text-primary-400' : 'text-gray-400'}`}>{opt.sub}</span>
                </button>
              ))}
            </div>
            {/* 투명 배경 옵션 (PNG 전용) */}
            {format === 'png' && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${transparentBg ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`} onClick={() => setTransparentBg(v => !v)}>
                  {transparentBg && <Check size={10} className="text-white" />}
                </div>
                <span className="text-xs text-gray-600 font-medium">투명 배경 PNG (배경이미지 제외)</span>
              </label>
            )}
          </div>

          {/* 다운로드 버튼 */}
          {progress ? (
            <div className="w-full py-3 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center gap-2">
              <Loader2 size={15} className="text-primary-600 animate-spin" />
              <span className="text-sm text-primary-700 font-medium">{progress}</span>
            </div>
          ) : done ? (
            <div className="w-full py-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center gap-2">
              <Check size={15} className="text-green-600" />
              <span className="text-sm text-green-700 font-semibold">다운로드 완료!</span>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              다운로드 시작
            </button>
          )}

          <p className="text-center text-[10px] text-gray-400">1080px 고해상도로 저장됩니다</p>
        </div>
      </div>
    </div>
  );
}

// ─── SnsUploadModal ─────────────────────────────────────────────────────────
type SnsStatus = 'idle' | 'uploading' | 'done' | 'error';
type SnsResult = { success: boolean; url?: string; error?: string };

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', note: '' },
  { id: 'threads', label: 'Threads', icon: '🧵', note: '' },
  { id: 'youtube', label: 'YouTube', icon: '▶️', note: '동영상 전용' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', note: '영상 전용 (준비 중)' },
  { id: 'x', label: 'X', icon: '✕', note: '준비 중' },
] as const;

function SnsUploadModal({
  pagesData, captureRefs, onClose, initialCaption = '',
}: {
  pagesData: PageData[];
  captureRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onClose: () => void;
  initialCaption?: string;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(['instagram', 'threads']));
  const [caption, setCaption] = React.useState(initialCaption);
  const [status, setStatus] = React.useState<SnsStatus>('idle');
  const [progress, setProgress] = React.useState('');
  const [results, setResults] = React.useState<Record<string, SnsResult>>({});

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canvasToJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob 변환 실패')), 'image/jpeg', 0.85);
    });

  const handleUpload = async () => {
    if (selected.size === 0) { alert('플랫폼을 하나 이상 선택하세요'); return; }
    setStatus('uploading');
    setResults({});

    try {
      const { toCanvas } = await import('html-to-image');
      const SCALE = 1080 / 420;
      const imageUrls: string[] = [];

      const preloadProxy = async (el: HTMLDivElement) => {
        const imgs = Array.from(el.querySelectorAll('img'));
        const origSrcs = new Map<HTMLImageElement, string>();
        await Promise.all(imgs.map(async (img) => {
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:') || src.startsWith('/') || src.startsWith(window.location.origin)) return;
          origSrcs.set(img, src);
          try {
            const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = dataUrl;
            });
          } catch { origSrcs.delete(img); }
        }));
        return origSrcs;
      };

      for (let i = 0; i < pagesData.length; i++) {
        const pg = pagesData[i];
        const el = captureRefs.current?.[pg.id];
        if (!el) continue;
        setProgress(`캡처 중 ${i + 1}/${pagesData.length}...`);
        const origSrcs = await preloadProxy(el);
        const canvas = await toCanvas(el, { pixelRatio: SCALE, cacheBust: false });
        origSrcs.forEach((src, img) => { img.src = src; });
        const blob = await canvasToJpegBlob(canvas);

        setProgress(`CDN 업로드 중 ${i + 1}/${pagesData.length}...`);
        const form = new FormData();
        form.append('file', blob, `slide_${i + 1}.jpg`);
        const cdnRes = await fetch('/api/upload-to-cdn', { method: 'POST', body: form });
        const cdnData = await cdnRes.json();
        if (!cdnData.url) throw new Error(`CDN 업로드 실패 (${i + 1}번째): ${cdnData.error}`);
        imageUrls.push(cdnData.url);
      }

      setProgress('SNS 전송 중...');
      const snsRes = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, caption, platforms: Array.from(selected) }),
      });
      const snsData = await snsRes.json();
      if (snsData.error) throw new Error(snsData.error);
      setResults(snsData.results || {});
      setStatus('done');
      setProgress('');
    } catch (e: any) {
      setProgress('');
      setStatus('error');
      setResults({ _error: { success: false, error: friendlyError(e) } });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={status === 'uploading' ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 업로드 중 안내 배너 */}
        {status === 'uploading' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-xs font-semibold text-amber-700">업로드 진행 중입니다. 창을 닫거나 다른 곳을 클릭하지 마세요.</p>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">SNS 자동 업로드</h2>
              <p className="text-[11px] text-gray-400">전체 {pagesData.length}장 → Threads·TikTok 업로드</p>
            </div>
          </div>
          <button
            onClick={status === 'uploading' ? undefined : onClose}
            disabled={status === 'uploading'}
            className={`p-1.5 rounded-lg ${status === 'uploading' ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 플랫폼 선택 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-3">업로드할 플랫폼</p>
            <div className="grid grid-cols-5 gap-2">
              {PLATFORMS.map(p => {
                const isOn = selected.has(p.id);
                const disabled = !!p.note;
                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && toggle(p.id)}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all ${
                      disabled ? 'opacity-40 cursor-not-allowed border-gray-200' :
                      isOn ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className={`text-[10px] font-bold leading-tight text-center ${isOn && !disabled ? 'text-purple-600' : 'text-gray-500'}`}>
                      {p.label}
                    </span>
                    {disabled && <span className="text-[9px] text-gray-400 text-center leading-tight">{p.note}</span>}
                    {isOn && !disabled && (
                      <div className="w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check size={8} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 캡션 입력 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">캡션 (선택)</p>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="캡션을 입력하세요. 비워두면 빈 캡션으로 업로드됩니다."
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder:text-gray-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">Threads 최대 500자 · TikTok 최대 150자</p>
          </div>

          {/* 완료 배너 */}
          {status === 'done' && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <Check size={13} className="text-white" />
              </div>
              <p className="text-sm font-bold text-green-700">업로드 완료! 각 플랫폼에서 확인하세요.</p>
            </div>
          )}

          {/* 결과 표시 */}
          {(status === 'done' || status === 'error') && Object.keys(results).length > 0 && (
            <div className="space-y-2">
              {Object.entries(results).map(([platform, result]) => {
                if (platform === '_error') return null;
                const pInfo = PLATFORMS.find(p => p.id === platform);
                return (
                  <div key={platform} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className="text-base">{pInfo?.icon || '🌐'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                        {pInfo?.label || platform} — {result.success ? '업로드 완료!' : '실패'}
                      </p>
                      {result.success && result.url && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-green-600 underline truncate block">{result.url}</a>
                      )}
                      {!result.success && result.error && (
                        <p className="text-[11px] text-red-500">{result.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {results._error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-red-700">오류</p>
                  <p className="text-[11px] text-red-500">{results._error.error}</p>
                </div>
              )}
            </div>
          )}

          {/* 업로드 버튼 */}
          {status === 'uploading' ? (
            <div className="w-full py-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-center gap-2">
              <Loader2 size={15} className="text-purple-600 animate-spin" />
              <span className="text-sm text-purple-700 font-medium">{progress}</span>
            </div>
          ) : status === 'done' ? (
            <button
              onClick={() => { setStatus('idle'); setResults({}); setProgress(''); }}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all"
            >
              다시 업로드
            </button>
          ) : status === 'error' ? (
            <button
              onClick={() => { setStatus('idle'); setResults({}); setProgress(''); }}
              className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} />
              다시 시도하기
            </button>
          ) : (
            <button
              onClick={handleUpload}
              disabled={selected.size === 0}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
              {selected.size > 0 ? `${selected.size}개 플랫폼에 업로드` : '플랫폼 선택하세요'}
            </button>
          )}

          <p className="text-center text-[10px] text-gray-400">이미지 캡처 → CDN 업로드 → SNS 전송 순으로 진행됩니다</p>
        </div>
      </div>
    </div>
  );
}

// ─── CaptionModal ─────────────────────────────────────────────────────────────
function CaptionModal({
  pagesData,
  brandKit,
  onCaptionGenerated,
  onClose,
}: {
  pagesData: PageData[];
  brandKit: { logo: string; color: string; name?: string; font_family?: string } | null;
  onCaptionGenerated?: (caption: string, hashtags: string[]) => void;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const cards = pagesData.map(p => ({
        title: p.title,
        body: [p.subtitle, ...(p.bullets || [])].filter(Boolean).join(' '),
      }));
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, brand_name: brandKit?.name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCaption(data.caption || '');
      setHashtags(data.hashtags || []);
      onCaptionGenerated?.(data.caption || '', data.hashtags || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? friendlyError(e) : '생성 실패');
    }
    setLoading(false);
  };

  useEffect(() => { generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fullText = caption + (hashtags.length ? '\n\n' + hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ') : '');

  const copyAll = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Wand2 size={15} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">AI 캡션 생성</h2>
              <p className="text-[11px] text-gray-400">인스타그램용 캡션과 해시태그를 자동으로 만들어 드립니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-sm text-gray-400">AI가 캡션을 작성하는 중...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <button onClick={generate} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200">다시 시도</button>
            </div>
          ) : (
            <>
              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-600">캡션</p>
                  <span className="text-[10px] text-gray-400">{caption.length}자</span>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              {/* Hashtags */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">해시태그 ({hashtags.length}개)</p>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-100 cursor-pointer hover:bg-emerald-100"
                      onClick={() => setHashtags(h => h.filter((_, j) => j !== i))}
                      title="클릭하여 삭제"
                    >
                      #{tag.replace(/^#/, '')} <X size={10} />
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] text-gray-400 mb-2 font-medium">미리보기</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{fullText}</p>
              </div>
            </>
          )}
        </div>

        {!loading && !error && (
          <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
            <button
              onClick={generate}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw size={13} /> 재생성
            </button>
            <button
              onClick={copyAll}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
            >
              {copied ? <><Check size={14} /> 복사됨!</> : <><Copy size={14} /> 전체 복사</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
