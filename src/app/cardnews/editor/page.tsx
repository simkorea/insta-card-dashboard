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
  id: number;
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
}

const BUSINESS_THEME_DATA: PageData[] = [
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

const CAFE_THEME_DATA: PageData[] = [
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

const LIFESTYLE_THEME_DATA: PageData[] = [
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

const TRAVEL_THEME_DATA: PageData[] = [
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

const FASHION_THEME_DATA: PageData[] = [
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

const FOOD_THEME_DATA: PageData[] = [
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

const EDUCATION_THEME_DATA: PageData[] = [
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
function cardNewsToPages(raw: { page: number; title: string; body: string; backgroundImage?: string; accent?: string; imageKeyword?: string }[], theme: PageData[] = PAGES_DATA): PageData[] {
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
    if (i === 0) {
      return { ...base, id: card.page, title: card.title, subtitle: card.body, bullets: undefined, bgImage, accent, imageKeyword };
    }
    const bodyLines = card.body.split('\n').map((l: string) => l.trim()).filter(Boolean);
    return {
      ...base,
      id: card.page,
      title: card.title,
      subtitle: '',
      bullets: bodyLines.length > 1 ? bodyLines : [card.body],
      bgImage,
      accent,
      imageKeyword,
    };
  });
}

// ─── Crop Modal ───────────────────────────────────────────────────────────────
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
  onSelectImage,
  onDeselect,
}: {
  layer: CanvasLayer;
  currentImageUrl?: string;
  cardContent?: string;
  imageKeyword?: string;
  onSelectImage?: (url: string) => void;
  onDeselect: () => void;
}) {
  const [focusDot, setFocusDot] = useState({ x: 50, y: 60 });
  const [zoom, setZoom] = useState(60);
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
    setFocusDot({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
    });
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
                  alt="focus"
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
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
                  <span className="text-[10px] text-gray-500 font-medium">확대/축소</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range" min={0} max={100} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="h-24 accent-primary-600"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '6px' }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded">cover</span>
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    onClick={() => setShowCropModal(true)}
                    className="p-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-white shadow-sm" title="자르기">
                    <Maximize2 size={11} />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="맞춤"><Minimize2 size={11} /></button>
                  <button onClick={() => setFocusDot({ x: 50, y: 50 })} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="초기화"><RotateCcw size={11} /></button>
                </div>
              </div>
            </div>
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
                  <button className="w-full py-3 bg-primary-600 rounded-xl text-sm font-bold text-white hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2">
                    <Wand2 size={15} />
                    생성하기 ({aiCount * 5} 크레딧)
                  </button>

                  {/* History */}
                  <button className="w-full flex items-center justify-between py-2 text-sm text-gray-500 hover:text-gray-700">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={13} />
                      <span className="text-[12px] font-medium">이전 AI 이미지</span>
                    </div>
                    <span className="text-[11px] text-primary-600 font-semibold">새로고침</span>
                  </button>
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
function TextPanel({ layer, onDeselect, onUpdate }: {
  layer: CanvasLayer;
  onDeselect: () => void;
  onUpdate: (content: string, style: TextStyle) => void;
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
              {viralHooks.map((hook, i) => (
                <button 
                  key={i}
                  onClick={() => setTextContent(hook)}
                  className="w-full text-left text-[11px] bg-white border border-primary-100 p-2 rounded-lg hover:border-primary-400 hover:text-primary-700 transition-all text-gray-600 leading-snug shadow-sm"
                >
                  {hook}
                </button>
              ))}
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

function AIPanel({ pageData, onApplyChanges }: {
  pageData: PageData;
  onApplyChanges: (changes: Partial<PageData>) => void;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
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
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(420);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isFullscreenEdit, setIsFullscreenEdit] = useState(false);
  const captureRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingDrop, setIsUploadingDrop] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<'copied' | 'error' | null>(null);
  const [showSnsModal, setShowSnsModal] = useState(false);
  const [showCaptionModal, setShowCaptionModal] = useState(false);

  // ── Mutable page data state ──
  const [pagesData, setPagesData] = useState<PageData[]>(PAGES_DATA);
  const historyRef = useRef<PageData[][]>([PAGES_DATA]);
  const historyIdxRef = useRef(0);
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

  // 마운트 시 데이터 로드 (우선순위: editingDesign > cardNewsData > 기본값)
  useEffect(() => {
    try {
      const editingRaw = localStorage.getItem('editingDesign');
      if (editingRaw) {
        const parsed = JSON.parse(editingRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPagesData(parsed);
          historyRef.current = [parsed];
          historyIdxRef.current = 0;
          return;
        }
      }
      const raw = localStorage.getItem('cardNewsData');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 템플릿에 따른 테마 선택
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
            } catch { /* 파싱 실패 시 기본 테마 유지 */ }
          }

          const converted = cardNewsToPages(parsed, theme);
          setPagesData(converted);
          historyRef.current = [converted];
          historyIdxRef.current = 0;
        }
      }
    } catch {
      // 파싱 실패 시 기본 PAGES_DATA 유지
    }
  }, []);

  const pushHistory = useCallback((next: PageData[]) => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(next);
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  // layerId 1=title, 2=subtitle, 3+=bullets[layerId-3] / style은 선택 적용
  const updatePageField = useCallback((pageId: number, layerId: number, content: string, style?: TextStyle) => {
    setPagesData(prev => {
      const next = prev.map(p => {
        if (p.id !== pageId) return p;
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
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      setPagesData(historyRef.current[historyIdxRef.current]);
    }
  }, []);

  // AI 디자이너: 현재 페이지 전체 변경 적용
  const updatePageData = useCallback((pageId: number, changes: Partial<PageData>) => {
    setPagesData(prev => {
      const next = prev.map(p => p.id !== pageId ? p : { ...p, ...changes });
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  // ── Canvas Element Helpers ───────────────────────────────────────────────────
  const addElement = useCallback((elem: Omit<CanvasElement, 'id'>) => {
    const newElem: CanvasElement = { ...elem, id: `el_${Date.now()}` };
    setPagesData(prev => {
      const next = prev.map(p => p.id !== currentPage ? p : { ...p, elements: [...(p.elements || []), newElem] });
      pushHistory(next);
      return next;
    });
    setSelectedElementId(newElem.id);
    setActiveTab('element');
  }, [currentPage, pushHistory]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setPagesData(prev => {
      const next = prev.map(p => p.id !== currentPage ? p : {
        ...p, elements: (p.elements || []).map(e => e.id === id ? { ...e, ...updates } : e),
      });
      pushHistory(next);
      return next;
    });
  }, [currentPage, pushHistory]);

  const deleteElement = useCallback((id: string) => {
    setPagesData(prev => {
      const next = prev.map(p => p.id !== currentPage ? p : {
        ...p, elements: (p.elements || []).filter(e => e.id !== id),
      });
      pushHistory(next);
      return next;
    });
    setSelectedElementId(null);
  }, [currentPage, pushHistory]);

  const handleCanvasElemMouseDown = (e: React.MouseEvent, elem: CanvasElement) => {
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

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingElemId || !dragStartRef.current) return;
    const { startX, startY, origX, origY, cw, ch } = dragStartRef.current;
    const newX = Math.max(5, Math.min(95, origX + ((e.clientX - startX) / cw) * 100));
    const newY = Math.max(5, Math.min(95, origY + ((e.clientY - startY) / ch) * 100));
    setDragPos({ x: newX, y: newY });
  };

  const handleCanvasMouseUp = () => {
    if (draggingElemId && dragPos) {
      updateElement(draggingElemId, dragPos);
    }
    setDraggingElemId(null);
    setDragPos(null);
    dragStartRef.current = null;
  };

  const totalPages = pagesData.length;

  const pageData = pagesData[currentPage - 1];
  const currentBgImage = pageImages[currentPage] ?? pageData.bgImage;

  // 이미지 레이어의 imageSrc를 현재 선택된 이미지로 교체
  const rawLayers = getLayersForPage(pageData);
  const pageLayers: CanvasLayerWithSrc[] = [
    { ...rawLayers[0], imageSrc: currentBgImage },
    ...rawLayers.slice(1),
  ];

  // 카드 전체 텍스트 (Claude 검색 쿼리 생성에 사용)
  const cardTextContent = [
    pageData.title,
    pageData.subtitle,
    ...(pageData.bullets || []).map(b => b.replace(/<[^>]+>/g, '')),
  ].filter(Boolean).join('\n');

  const handleSelectLayer = (layer: CanvasLayerWithSrc) => { setSelectedLayer(layer); setActiveTab('edit'); setIsPanelOpen(true); };
  const handleDeselect = () => { setSelectedLayer(null); setEditingElemId(null); };

  const handleSelectImage = (url: string) => {
    setPageImages(prev => ({ ...prev, [currentPage]: url }));
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
      setPageImages(prev => ({ ...prev, [currentPage]: url }));
    } finally {
      setIsUploadingDrop(false);
    }
  };

  // 키보드 단축키: Ctrl+Z / Cmd+Z (실행취소), Ctrl+Y / Cmd+Shift+Z (다시실행)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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
          onClose={() => setShowSnsModal(false)}
        />
      )}
      {/* AI 캡션 생성 모달 */}
      {showCaptionModal && (
        <CaptionModal
          pagesData={pagesData}
          brandKit={brandKit}
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
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/cardnews" className="text-gray-800 font-bold text-sm hover:text-primary-600">{currentPage}페이지 편집</Link>
          <div className="flex items-center gap-1 text-gray-500 text-sm">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={15} /></button>
            <span className="font-medium px-1">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-lg">
            <button onClick={undo} title="실행취소 (Ctrl+Z)" className="p-1.5 hover:bg-white rounded text-gray-400"><Undo size={15} /></button>
            <button onClick={redo} title="다시실행 (Ctrl+Y)" className="p-1.5 hover:bg-white rounded text-gray-400"><Redo size={15} /></button>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
            <button className="text-gray-400 hover:text-gray-700"><ZoomOut size={14} /></button>
            <div className="relative w-20 h-1.5 bg-gray-300 rounded-full mx-1">
              <div className="absolute left-0 top-0 h-full bg-primary-500 rounded-full" style={{ width: '60%' }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-600 rounded-full shadow-sm" style={{ left: 'calc(60% - 6px)' }} />
            </div>
            <button className="text-gray-400 hover:text-gray-700"><ZoomIn size={14} /></button>
            <span className="text-xs font-semibold text-gray-600 ml-1 w-9 text-right">100%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPanelOpen(v => !v)}
              className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-primary-600 transition-colors"
              title={isPanelOpen ? '패널 닫기' : '패널 열기'}
            >
              {isPanelOpen ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="19 9 15 12 19 15"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/><polyline points="11 9 15 12 11 15"/>
                </svg>
              )}
            </button>
            <div className="w-px h-5 bg-gray-200" />
            {/* 공유 링크 */}
            <button
              onClick={handleShare}
              disabled={isSharing}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                shareToast === 'copied'
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : shareToast === 'error'
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-primary-400 hover:text-primary-600'
              } disabled:opacity-60`}
            >
              {isSharing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : shareToast === 'copied' ? (
                <Check size={14} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              )}
              {shareToast === 'copied' ? '링크 복사됨!' : shareToast === 'error' ? '실패' : '공유 링크'}
            </button>
            {/* 디자인 저장 */}
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              <Save size={14} /> 디자인 저장
            </button>
            {/* 전체화면 편집 */}
            <button
              onClick={() => setIsFullscreenEdit(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-400 hover:text-primary-600 transition-colors"
              title="전체화면으로 편집"
            >
              <Maximize2 size={14} /> 전체화면 편집
            </button>
            {/* AI 캡션 생성 */}
            <button
              onClick={() => setShowCaptionModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] transition-all shadow-sm"
              title="AI가 인스타그램 캡션과 해시태그를 자동으로 생성합니다"
            >
              <Wand2 size={14} /> 캡션 생성
            </button>
            {/* SNS 업로드 */}
            <button
              onClick={() => setShowSnsModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:from-purple-600 hover:to-pink-600 active:scale-[0.98] transition-all shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
              SNS 업로드
            </button>
            {/* 다운로드 모달 */}
            <button
              onClick={() => setShowDownloadMenu(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              다운로드
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSavingClose}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 shadow-sm"
            >
              {isSavingClose ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              저장 후 닫기
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div className="w-14 border-r border-gray-200 bg-white flex flex-col items-center py-4 gap-3 shrink-0 z-10">
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
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            <div
              ref={canvasElemRef}
              className="relative bg-white shadow-2xl flex-shrink-0 overflow-hidden"
              style={{ width: `${canvasW}px`, aspectRatio: '4/5' }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              {/* Background image layer */}
              <div
                onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[0]); }}
                className={`absolute inset-0 cursor-pointer transition-all ${selectedLayer?.id === 0 ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-primary-300/60'}`}
              >
                <img src={currentBgImage} alt="배경" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: pageData.overlay }} />
                {brandKit?.logo && (
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
                    }}
                    onMouseDown={e => { if (!isEditing) handleCanvasElemMouseDown(e, elem); }}
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

          {/* Thumbnails — 페이지별 다른 이미지 */}
          <div className="h-28 bg-white border-t border-gray-200 flex items-center justify-center gap-3 shrink-0 px-4 z-10">
            {pagesData.map(pg => (
              <div
                key={pg.id}
                onClick={e => { e.stopPropagation(); handlePageChange(pg.id); }}
                className={`relative w-14 h-[72px] rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${currentPage === pg.id ? 'border-primary-600 shadow-md ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <img src={(pageImages[pg.id] ?? pg.bgImage).replace('w=800', 'w=120')} alt={`${pg.id}p`} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0" style={{ background: pg.overlay }} />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-[9px] text-white font-bold">{pg.id}</div>
              </div>
            ))}
            <button className="w-14 h-[72px] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div
          className="border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden"
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
            {activeTab === 'ai' && <AIPanel pageData={pageData} onApplyChanges={(changes) => updatePageData(currentPage, changes)} />}
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
                  key={`${currentPage}-${selectedLayer.id}`}
                  layer={selectedLayer}
                  currentImageUrl={currentBgImage}
                  cardContent={cardTextContent}
                  imageKeyword={pageData.imageKeyword}
                  onSelectImage={handleSelectImage}
                  onDeselect={handleDeselect}
                />
              </div>
            )}
            {activeTab === 'edit' && selectedLayer?.type === 'text' && (
              <div className="flex-1 overflow-hidden">
                <TextPanel
                  layer={selectedLayer}
                  onDeselect={handleDeselect}
                  onUpdate={(content, style) => updatePageField(currentPage, selectedLayer.id, content, style)}
                />
              </div>
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
  pageImages: Record<number, string>;
  onSelectImage: (url: string, pageId: number) => void;
  onUpdatePage: (pageId: number, layerId: number, content: string, style?: TextStyle) => void;
  onApplyPageChanges: (pageId: number, changes: Partial<PageData>) => void;
  onClose: () => void;
  brandLogo?: string;
}) {
  const [fsPage, setFsPage] = useState(initialPage);
  const [selectedLayer, setSelectedLayer] = useState<CanvasLayerWithSrc | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'ai' | 'element'>('edit');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [draggingElemId, setDraggingElemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [editingElemId, setEditingElemId] = useState<string | null>(null);
  const fsDragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number; cw: number; ch: number } | null>(null);
  const fsCanvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(500);

  const pageData = pagesData[fsPage - 1];
  const currentBgImage = pageImages[fsPage] ?? pageData.bgImage;
  const rawLayers = getLayersForPage(pageData);
  const pageLayers: CanvasLayerWithSrc[] = [
    { ...rawLayers[0], imageSrc: currentBgImage },
    ...rawLayers.slice(1),
  ];
  const cardTextContent = [
    pageData.title,
    pageData.subtitle,
    ...(pageData.bullets || []).map(b => b.replace(/<[^>]+>/g, '')),
  ].filter(Boolean).join('\n');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 48;
      const thumbH = 88;
      const panelW = isPanelOpen ? 360 : 0;
      const availH = el.clientHeight - thumbH - pad;
      const availW = el.clientWidth - 48 - panelW - pad;
      setCanvasW(Math.max(300, Math.floor(Math.min(availW, availH * (4 / 5)))));
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
    const newElem: CanvasElement = { ...elem, id: `el_${Date.now()}` };
    const pd = pagesData[fsPage - 1];
    onApplyPageChanges(fsPage, { elements: [...(pd.elements || []), newElem] });
    setSelectedElementId(newElem.id);
    setActiveTab('element');
  };
  const fsUpdateElement = (id: string, updates: Partial<CanvasElement>) => {
    const pd = pagesData[fsPage - 1];
    onApplyPageChanges(fsPage, { elements: (pd.elements || []).map(e => e.id === id ? { ...e, ...updates } : e) });
  };
  const fsDeleteElement = (id: string) => {
    const pd = pagesData[fsPage - 1];
    onApplyPageChanges(fsPage, { elements: (pd.elements || []).filter(e => e.id !== id) });
    setSelectedElementId(null);
  };
  const handleFSElemMouseDown = (e: React.MouseEvent, elem: CanvasElement) => {
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
  const handleFSCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingElemId || !fsDragStartRef.current) return;
    const { startX, startY, origX, origY, cw, ch } = fsDragStartRef.current;
    setDragPos({ x: Math.max(5, Math.min(95, origX + ((e.clientX - startX) / cw) * 100)), y: Math.max(5, Math.min(95, origY + ((e.clientY - startY) / ch) * 100)) });
  };
  const handleFSCanvasMouseUp = () => {
    if (draggingElemId && dragPos) fsUpdateElement(draggingElemId, dragPos);
    setDraggingElemId(null);
    setDragPos(null);
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
              onMouseMove={handleFSCanvasMouseMove}
              onMouseUp={handleFSCanvasMouseUp}
              onMouseLeave={handleFSCanvasMouseUp}
            >
              {/* Background image */}
              <div
                onClick={e => { e.stopPropagation(); handleSelectLayer(pageLayers[0]); }}
                className={`absolute inset-0 cursor-pointer transition-all ${selectedLayer?.id === 0 ? 'ring-2 ring-primary-500' : 'hover:ring-2 hover:ring-primary-300/60'}`}
              >
                <img src={currentBgImage} alt="배경" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: pageData.overlay }} />
                {brandLogo && (
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
                    }}
                    onMouseDown={e => { if (!isEditing) handleFSElemMouseDown(e, elem); }}
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
                      <button className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-lg z-20 hover:bg-red-600"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); fsDeleteElement(elem.id); }}>×</button>
                    )}
                  </div>
                );
              })}

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
            {pagesData.map(pg => (
              <div key={pg.id} onClick={() => handlePageChange(pg.id)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all ${fsPage === pg.id ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-[#13132a]' : 'opacity-60 hover:opacity-90'}`}
                style={{ width: 44, height: 55 }}
              >
                <img src={(pageImages[pg.id] ?? pg.bgImage).replace('w=800', 'w=80')} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: pg.overlay }} />
                <div className="absolute bottom-0.5 right-0.5 text-[7px] text-white font-bold bg-black/50 rounded px-0.5">{pg.id}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div
          className="bg-white flex flex-col shrink-0 overflow-hidden border-l border-gray-200"
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
            {activeTab === 'ai' && <AIPanel pageData={pagesData[fsPage - 1]} onApplyChanges={(changes) => onApplyPageChanges(fsPage, changes)} />}
            {activeTab === 'element' && (
              <div className="flex-1 overflow-hidden">
                <ElementPanel
                  onAdd={fsAddElement}
                  selectedElement={selectedElementId ? (pagesData[fsPage - 1]?.elements || []).find(e => e.id === selectedElementId) ?? null : null}
                  onUpdateElement={fsUpdateElement}
                  onDeleteElement={fsDeleteElement}
                />
              </div>
            )}
            {activeTab === 'edit' && !selectedLayer && <div className="flex-1 overflow-y-auto"><DefaultPanel layers={pageLayers} onSelectLayer={handleSelectLayer} /></div>}
            {activeTab === 'edit' && selectedLayer?.type === 'image' && (
              <div className="flex-1 overflow-hidden">
                <ImagePanel
                  key={`fs-${fsPage}-${selectedLayer.id}`}
                  layer={selectedLayer}
                  currentImageUrl={currentBgImage}
                  cardContent={cardTextContent}
                  imageKeyword={pagesData[fsPage - 1]?.imageKeyword}
                  onSelectImage={url => onSelectImage(url, fsPage)}
                  onDeselect={handleDeselect}
                />
              </div>
            )}
            {activeTab === 'edit' && selectedLayer?.type === 'text' && (
              <div className="flex-1 overflow-hidden">
                <TextPanel
                  layer={selectedLayer}
                  onDeselect={handleDeselect}
                  onUpdate={(content, style) => onUpdatePage(fsPage, selectedLayer.id, content, style)}
                />
              </div>
            )}
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
  pageImages: Record<number, string>;
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
  pageImages: Record<number, string>;
  currentPage: number;
  captureRefs: React.RefObject<Record<number, HTMLDivElement | null>>;
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

  const capturePages = async (ids: number[]): Promise<{ id: number; dataUrl: string; title: string }[]> => {
    const results: { id: number; dataUrl: string; title: string }[] = [];
    for (const id of ids) {
      const pg = pagesData.find(p => p.id === id);
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
        const [cap] = await capturePages([currentPage]);
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
      alert('다운로드 실패: ' + e.message);
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
  { id: 'tiktok', label: 'TikTok', icon: '🎵', note: '' },
  { id: 'x', label: 'X', icon: '✕', note: '준비 중' },
] as const;

function SnsUploadModal({
  pagesData, captureRefs, onClose,
}: {
  pagesData: PageData[];
  captureRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onClose: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(['threads']));
  const [caption, setCaption] = React.useState('');
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

      setProgress('SNS 업로드 중... (Threads 캐러셀은 약 30초 소요)');
      const snsRes = await fetch('/api/upload/sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, caption, platforms: Array.from(selected) }),
      });
      const snsData = await snsRes.json();
      setResults(snsData.results || {});
      setStatus('done');
      setProgress('');
    } catch (e: any) {
      setProgress('');
      setStatus('error');
      setResults({ _error: { success: false, error: e.message } });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">SNS 자동 업로드</h2>
              <p className="text-[11px] text-gray-400">전체 {pagesData.length}장 → 캐러셀로 업로드</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
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

          {/* 결과 표시 */}
          {status === 'done' && Object.keys(results).length > 0 && (
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
  onClose,
}: {
  pagesData: PageData[];
  brandKit: { logo: string; color: string; name?: string; font_family?: string } | null;
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 실패');
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
