import type { SlideBlock, BrandTone } from '@/lib/cardnews/blocks';

export interface SeedPage {
  id: number;
  bgImage: string;
  bgLabel: string;
  overlay: string;
  title: string;
  subtitle: string;
  layout: 'center' | 'bottom-left' | 'bottom-left-list';
  brandTone: BrandTone;
  showFrame: boolean;
  blocks: SlideBlock[];
}

export interface SeedTemplate {
  id: string;
  title: string;
  category: string;
  ratio: string;
  isFavorite: boolean;
  image: string;
  pages: SeedPage[];
}

export const REAL_ESTATE_SEEDS: SeedTemplate[] = [
  // 1. 신규 분양 청약 가이드
  {
    id: 're_1',
    title: '신규 분양 청약 가이드',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '신규 분양 청약 가이드 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '신규 분양 청약 가이드',
        subtitle: '3기 신도시 핵심 정보 요약',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'HOT PLACE' },
          { type: 'headline', text: '신규 분양 청약', accentText: '완벽 가이드' },
          { type: 'badgeRow', badges: [{ text: '3기 신도시', tone: 'gold' }, { text: '분양 꿀팁', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '분양가 상세 안내',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '타입별 분양가',
        subtitle: '평형별 상세 분양가 안내',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'PRICE' },
          { type: 'headline', text: '평형별 예상 분양가', accentText: '비교' },
          { type: 'compareTable', rows: [
            { label: '59㎡ (25평형)', value: '4억 5,000만' },
            { label: '84㎡ (34평형)', value: '6억 2,000만', highlight: true },
            { label: '102㎡ (40평형)', value: '7억 8,000만' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '주요 청약 일정',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '청약 일정',
        subtitle: '놓치지 말아야 할 청약 타임라인',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'SCHEDULE' },
          { type: 'headline', text: '특별 및 일반공급', accentText: '일정' },
          { type: 'timeline', items: [
            { date: '06.12', title: '특별공급 청약 접수', state: 'done' },
            { date: '06.13', title: '일반공급 1순위 접수', state: 'active' },
            { date: '06.20', title: '당첨자 발표일', state: 'todo' }
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '1순위 자격 요건',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '자격 확인',
        subtitle: '1순위 요건 확인',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'ELIGIBILITY' },
          { type: 'headline', text: '1순위 청약 신청', accentText: '자격요건' },
          { type: 'checklist', items: [
            '수도권 거주 만 19세 이상 세대주',
            '청약통장 가입 기간 24개월 이상 경과',
            '지역별/면적별 예치 기준 금액 충족'
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '입지 분석',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '입지 분석',
        subtitle: '교통 및 주변 환경',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'LOCATION' },
          { type: 'headline', text: '최고의 주거 만족도를 선사할', accentText: '교통망' },
          { type: 'checklist', items: [
            '도보 5분 초역세권 대중교통 이용 편리',
            '단지 도보권에 초·중·고 학군 안심 통학',
            '대형 상업 시설 및 생태 공원 인접'
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '시세 차익 통계',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '시세 차익',
        subtitle: '시세 비교를 통한 안전마진 분석',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'STATISTICS' },
          { type: 'headline', text: '안전마진 및 시세', accentText: '분석' },
          { type: 'statGrid', cols: 3, items: [
            { value: '30%', label: '인근 대비 저렴' },
            { value: '2억 이상', label: '안전마진 확보' },
            { value: '25:1', label: '예상 청약경쟁률' }
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '청약 마케팅 유도',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '청약 안내',
        subtitle: '실시간 분양 알림 받기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CHECK OUT' },
          { type: 'headline', text: '청약에 대해 더 자세히 알아보려면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '더 유익하고 빠른 실시간 분양 알림을 제공합니다.' },
          { type: 'sourceNote', text: '출처: 한국부동산원 청약홈 공식 발표 자료' }
        ]
      }
    ]
  },
  // 2. 아파트 시세 동향 분석
  {
    id: 're_2',
    title: '아파트 시세 동향 분석',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '시세 동향 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '아파트 시세 동향 분석',
        subtitle: '수도권 주요 단지 가격 흐름 진단',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'MARKET TREND' },
          { type: 'headline', text: '아파트 시세 동향', accentText: '심층 분석' },
          { type: 'badgeRow', badges: [{ text: '수도권 가격', tone: 'gold' }, { text: '시장 흐름 진단', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '전월 대비 변동률',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '시세 변동',
        subtitle: '전월 대비 주요 지표 변동 현황',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'STATISTICS' },
          { type: 'headline', text: '전월 대비 시세', accentText: '주요 변화' },
          { type: 'statGrid', cols: 3, items: [
            { value: '+0.12%', label: '서울 매매가 변동' },
            { value: '+0.25%', label: '전세가 상승 지속' },
            { value: '-0.05%', label: '경기 외곽 조정' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '지역별 비교표',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '지역별 비교',
        subtitle: '수도권 주요 지역 아파트 평균가',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'COMPARE' },
          { type: 'headline', text: '주요 지역별 아파트', accentText: '평균 매매가' },
          { type: 'compareTable', rows: [
            { label: '서울 강남 3구', value: '23.4억', highlight: true },
            { label: '마용성 지역', value: '15.8억' },
            { label: '경기 판교/분당', value: '14.2억' }
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '주목할 지역',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '주목 지역',
        subtitle: '상승세가 두드러지는 주요 거점',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'HOT SPOTS' },
          { type: 'headline', text: '최근 상승 거래량', accentText: '급증 지역' },
          { type: 'checklist', items: [
            '정비사업 추진이 활발한 노후 계획 단지',
            '신설 철도 개통이 임박한 경기 남부 주요 거점',
            '직주근접 수요가 탄탄한 도심권 역세권 대단지'
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자 포인트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '투자 분석',
        subtitle: '단기 및 장기 투자 핵심 고려사항',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'INVESTMENT' },
          { type: 'headline', text: '변동 장세 속에서', accentText: '주목할 투자 포인트' },
          { type: 'badgeRow', badges: [{ text: '똘똘한 한채', tone: 'gold' }, { text: '실거주 매수', tone: 'green' }] },
          { type: 'sub', text: '불확실성이 높을 때일수록 선호도가 검증된 대단지 중심의 똘똘한 한 채 전략이 안정적입니다.' }
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자시 주의사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '주의 사항',
        subtitle: '추가 금리 및 대출 규제 체크',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'WARNING' },
          { type: 'headline', text: '매수 전 반드시', accentText: '체크해야 할 리스크' },
          { type: 'checklist', items: [
            '스트레스 DSR 규제 강화에 따른 대출 한도 축소 여부',
            '연간 신규 입주 물량 증가에 따른 역전세 리스크 우려',
            '단기 급등 단지의 호가 추격 매수 자제'
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '시세 동향 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '부동산 동향 소식 구독하기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'NEWSLETTER' },
          { type: 'headline', text: '실시간 시장 브리핑을 원하신다면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '매주 최신 부동산 가격 통계 브리핑을 전달해 드립니다.' },
          { type: 'sourceNote', text: '출처: 한국부동산원 전국주택가격동향조사 보고서' }
        ]
      }
    ]
  },
  // 3. 재건축·재개발 투자 가이드
  {
    id: 're_3',
    title: '재건축·재개발 투자 가이드',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/224924/pexels-photo-224924.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/224924/pexels-photo-224924.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '재건축 투자 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '재건축·재개발 투자 가이드',
        subtitle: '정비사업 주요 절차와 전략 진단',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'REBUILD' },
          { type: 'headline', text: '재건축·재개발 투자', accentText: '핵심 공략집' },
          { type: 'badgeRow', badges: [{ text: '정비사업 가이드', tone: 'gold' }, { text: '재테크 전략', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/224924/pexels-photo-224924.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '사업 5단계 타임라인',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '진행 단계',
        subtitle: '정비사업의 대표적인 5대 핵심 절차',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'TIMELINE' },
          { type: 'headline', text: '재건축/재개발 주요', accentText: '5단계 절차' },
          { type: 'timeline', items: [
            { date: '1단계', title: '조합설립 인가', state: 'done' },
            { date: '2단계', title: '사업시행 인가', state: 'active' },
            { date: '3단계', title: '관리처분 계획인가 / 이주·철거', state: 'todo' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자성 체크 리스트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '투자성 체크',
        subtitle: '성공률을 높이는 단지 선정 기준',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CHECKLIST' },
          { type: 'headline', text: '사업성 및 가치분석', accentText: '자가 진단' },
          { type: 'checklist', items: [
            '평균 대지지분이 넓어 일반 분양 기여도가 높은 단지',
            '용적률이 낮아 추가 건축 여력이 충분한 곳',
            '인근 신축 아파트와의 높은 시세 갭(안전마진)'
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '수익 시뮬레이션',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '수익 예측',
        subtitle: '일반 분양가 및 조합원 분담금 산정 시뮬레이션',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'FINANCE' },
          { type: 'headline', text: '대략적인 추가', accentText: '분담금 산정' },
          { type: 'compareTable', rows: [
            { label: '조합원 평균 입주권가', value: '8.5억' },
            { label: '예상 일반 분양가', value: '11억', highlight: true },
            { label: '기대 시세차익(마진)', value: '2.5억' }
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/224924/pexels-photo-224924.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '주요 리스크 분석',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '리스크 관리',
        subtitle: '정비사업의 대표적인 리스크 요소',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'RISK' },
          { type: 'headline', text: '주의해야 할 정비사업', accentText: '지연 요소' },
          { type: 'checklist', items: [
            '공사비 증액 갈등으로 인한 입주 및 착공 지연',
            '조합원 간의 소송 또는 조합장 해임 갈등',
            '초과이익환수제(재건축) 대상 여부 및 세부담금'
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '정비사업 절세 팁',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '세금 전략',
        subtitle: '보유 기간 및 조합원 지위 승계에 따른 양도세 전략',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'TAX INFO' },
          { type: 'headline', text: '취득세 및 양도세', accentText: '세무 꿀팁' },
          { type: 'badgeRow', badges: [{ text: '도정법 조합원 지위승계', tone: 'gold' }, { text: '1주택 비과세', tone: 'green' }] }
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/224924/pexels-photo-224924.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '재건축 가이드 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '투자 전문가 상담 받기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'GET CONSULT' },
          { type: 'headline', text: '재건축 사업성 보고서가 필요하면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '성공적인 재건축·재개발 재테크 솔루션을 제공해 드립니다.' },
          { type: 'sourceNote', text: '출처: 도시 및 주거환경정비법(도정법) 및 서울시 정비사업 정보 포털' }
        ]
      }
    ]
  },
  // 4. 전세 vs 매매 비교 분석
  {
    id: 're_4',
    title: '전세 vs 매매 비교 분석',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '전세 매매 비교 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '전세 vs 매매 비교 분석',
        subtitle: '내 집 마련과 전세 거주 중 최적의 선택 전략',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'DECISION GUIDE' },
          { type: 'headline', text: '전세 vs 매매', accentText: '어떤 것이 유리할까?' },
          { type: 'badgeRow', badges: [{ text: '내집마련 전략', tone: 'gold' }, { text: '금융비용 계산', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '금융 비용 비교표',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '비용 비교',
        subtitle: '전세자금대출 이자와 매매 주담대 이자 비교',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'FINANCE' },
          { type: 'headline', text: '매월 나가는 고정', accentText: '금융 비용 비교' },
          { type: 'compareTable', rows: [
            { label: '전세 (전세대출 금리 4%)', value: '월 133만원' },
            { label: '매매 (주담대 금리 4.5% + 원리금)', value: '월 215만원', highlight: true },
            { label: '장기 시세차익 잠재 마진', value: '매매가 상향 시 유리' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '전세의 장단점',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '전세 장단점',
        subtitle: '안정적인 주거비용과 역전세 리스크',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'JEONSE ADVANTAGES' },
          { type: 'headline', text: '전세 제도의 장점과', accentText: '현실적 리스크' },
          { type: 'checklist', items: [
            '초기 주택 자금 부담이 매매 대비 상대적으로 낮음',
            '집값 하락기에 주택 가치 보전 및 재산세 부담 무관',
            '만기 시 전세보증금 반환 지연(역전세) 리스크 우려'
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '매매의 장단점',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '매매 장단점',
        subtitle: '인플레이션 방어와 원리금 납부 부담',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'BUYING ADVANTAGES' },
          { type: 'headline', text: '주택 매매의 장점과', accentText: '재무적 부담' },
          { type: 'checklist', items: [
            '인플레이션에 대응하는 가장 확실한 자산 보존 수단',
            '이사 걱정 없이 원하는 기간 장기 거주 가능 및 자유로운 리모델링',
            '원리금 동시 상환 부담 및 취득세/재산세 세금 가중'
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '결론 추천',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '추천 기준',
        subtitle: '자산 현황 및 시기별 최적 추천',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CONCLUSION' },
          { type: 'headline', text: '나에게 어울리는', accentText: '최적의 판단 기준' },
          { type: 'statGrid', cols: 2, items: [
            { value: '전세 추천', label: '자금 여력 3억 이하, 단기 이동 필요' },
            { value: '매매 추천', label: '자금 여력 4억 이상, 실거주 장기 안정' }
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '안전성 체크리스트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '안전 장치',
        subtitle: '전세 사기 예방 및 대출 상품 사전 진단',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'SAFETY CHK' },
          { type: 'headline', text: '매도/전세 계약 전', accentText: '필수 안전 장치' },
          { type: 'checklist', items: [
            '등기부등본상의 근저당권 설정 금액 및 선순위 채권 확인',
            '전세 계약 시 반드시 주택도시보증공사(HUG) 보증보험 가입',
            '매매 시 디딤돌/보금자리론 등 정책 저금리 상품 사전 대조'
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '전세 매매 비교 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '개인 맞춤 재무 포트폴리오 상담',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'REACH OUT' },
          { type: 'headline', text: '나만을 위한 주택 재무 계산이 필요하면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '대출 한도 및 월 상환 원리금 시뮬레이션을 분석해 드립니다.' },
          { type: 'sourceNote', text: '출처: 국토교통부 실거래가 공개시스템 기준' }
        ]
      }
    ]
  },
  // 5. 부동산 정책 변화 요약
  {
    id: 're_5',
    title: '부동산 정책 변화 요약',
    category: '부동산',
    ratio: '4:5',
    isFavorite: false,
    image: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '정책 요약 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '부동산 정책 변화 요약',
        subtitle: '새롭게 개편되는 취득세·양도세·대출 기준 브리핑',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'POLICY' },
          { type: 'headline', text: '최신 부동산 정책', accentText: '핵심 총정리' },
          { type: 'badgeRow', badges: [{ text: '세법 및 규제개편', tone: 'gold' }, { text: '부동산 뉴스', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '핵심 변경 사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '주요 변경',
        subtitle: '세제 및 주택 대출 한도 규제 완화 세부 내용',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'KEY CHANGES' },
          { type: 'headline', text: '이번 대책 발표의', accentText: '3대 핵심 골자' },
          { type: 'checklist', items: [
            '일시적 2주택자의 처분 기한 규제 완전 폐지',
            '부부 합산 소득 제한 디딤돌 대출 연 1억 원까지 상향',
            '재건축 초과이익환수 면제 기준 대폭 완화'
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '수혜 대상자 분석',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '수혜 분석',
        subtitle: '무주택자 및 1주택자 맞춤 수혜 분석',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'WHO BENEFITS' },
          { type: 'headline', text: '정책 개편에 따른', accentText: '가장 큰 수혜층' },
          { type: 'badgeRow', badges: [{ text: '신혼부부/생애최초', tone: 'gold' }, { text: '일시적 2주택자', tone: 'green' }] }
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '실투자 주의사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '투자 리스크',
        subtitle: '규제 완화 이면의 DSR 및 취득세 가중 주의',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CAUTION' },
          { type: 'headline', text: '세부 조항 해석 시', accentText: '반드시 주의할 점' },
          { type: 'checklist', items: [
            '여전히 적용되는 가계대출 총량 제한(스트레스 DSR 2단계)',
            '다주택자 취득세 중과 세율은 유지되므로 매수 순서 조절 필수',
            '분양가 상한제 단지의 실거주 의무 예외 규정 세부 점검'
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '시행 시기 일정',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '적용 시기',
        subtitle: '법안 의결 및 구체적 시행 시점 일정표',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'IMPLEMENTATION' },
          { type: 'headline', text: '법안 시행 및 정책', accentText: '적용 타임라인' },
          { type: 'timeline', items: [
            { date: '법안 의결', title: '정부 시행령 공표 완료', state: 'done' },
            { date: '대출 상향', title: '정책 주담대 요건 완화 적용', state: 'active' },
            { date: '세법 개정', title: '취득세법 정식 개정안 발효', state: 'todo' }
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: 'Q&A 정리',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '자주 묻는 질문',
        subtitle: '가장 많이 묻는 소득 기준 및 양도세 소급 적용 여부',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'FAQ SUMMARY' },
          { type: 'headline', text: '가장 자주 묻는', accentText: '정책 Q&A 요약' },
          { type: 'compareTable', rows: [
            { label: '양도세 처분 완화 소급 적용 여부', value: '기존 계약도 전원 소급 허용' },
            { label: '부부 합산 소득 한도 연동 가능 여부', value: '디딤돌에 한해 1.2억까지 인정', highlight: true },
            { label: 'DSR 예외 인정 범위', value: '생애 최초 신축 등 특정 보증' }
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '정책 요약 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '최신 정책 브리핑 카드뉴스 알림 받기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'GET UPDATES' },
          { type: 'headline', text: '매번 바뀌는 부동산 정책을 한눈에?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '빠르고 명쾌한 최신 국토부 보도자료 요약을 전달합니다.' },
          { type: 'sourceNote', text: '출처: 국토교통부 및 기획재정부 주택세제 개편 공동 발표문' }
        ]
      }
    ]
  },
  // 6. GTX 노선별 수혜 단지
  {
    id: 're_6',
    title: 'GTX 노선별 수혜 단지',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/157811/pexels-photo-157811.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/157811/pexels-photo-157811.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: 'GTX 수혜 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: 'GTX 노선별 수혜 단지',
        subtitle: '수도권 광역급행철도 개통 호재 및 시세 영향 분석',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'GTX EXPRESS' },
          { type: 'headline', text: 'GTX 노선별 가장', accentText: '주목할 수혜 아파트' },
          { type: 'badgeRow', badges: [{ text: '초고속 교통 호재', tone: 'gold' }, { text: '역세권 분석', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/157811/pexels-photo-157811.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '노선별 핵심 정차역',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '정차역 분석',
        subtitle: 'GTX A/B/C 주요 개통 구간 비교',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'COMPARE' },
          { type: 'headline', text: '노선별 가장 가치가 높은', accentText: '핵심 정차역' },
          { type: 'compareTable', rows: [
            { label: 'GTX-A 동탄 - 수서', value: '20분 주파 개통 완료' },
            { label: 'GTX-C 덕정 - 수원', value: '2028년 정식 개통 예정', highlight: true },
            { label: 'GTX-B 송도 - 마석', value: '일부 구간 우선 착공' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '예상 시세 상승 통계',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '상승폭 분석',
        subtitle: '개통 발표 이전 대비 평균 시세 변화율',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'STATISTICS' },
          { type: 'headline', text: '철도망 신설에 따른', accentText: '인근 단지 시세 변동률' },
          { type: 'statGrid', cols: 3, items: [
            { value: '+45%', label: '동탄역 역세권 상승' },
            { value: '+20%', label: '의왕/수원역 기대감 반영' },
            { value: '+15%', label: '인천 송도 역세권 유입' }
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자 유망 단지 리스트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '추천 단지',
        subtitle: '역세권 도보 10분 이내 알짜 수혜 단지',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'HOT COMPLEXES' },
          { type: 'headline', text: '실거주와 투자가 유망한', accentText: '대표 아파트 단지' },
          { type: 'checklist', items: [
            'GTX-A 동탄역 롯데캐슬 (동탄 대장주 단지)',
            'GTX-C 수원역 푸르지오 자이 (교통의 핵심 요충지)',
            'GTX-B 송도 더샵 센트럴파크 (인천 미래가치 거점)'
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/157811/pexels-photo-157811.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '노선별 청약 일정',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '청약 타임라인',
        subtitle: '정차역 근처 신규 분양 예정 단지 일정',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'COMING SOON' },
          { type: 'headline', text: '정차역 인접 신규', accentText: '분양 예정 일정' },
          { type: 'timeline', items: [
            { date: '하반기', title: 'GTX-C 금정 인근 주상복합 공급', state: 'done' },
            { date: '내년 초', title: 'GTX-A 파주 운정지구 막바지 분양', state: 'active' },
            { date: '내년 말', title: 'GTX-B 남양주 왕숙 공공 청약', state: 'todo' }
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자 유의사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '주의사항',
        subtitle: '개발 호재 반영 완료 및 지연 리스크 유의',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CAUTIONS' },
          { type: 'headline', text: '호재만 믿고 투자 전', accentText: '반드시 진단할 항목' },
          { type: 'checklist', items: [
            '노선 개통 계획 시점의 지연 리스크 (수년 이상 지연 잦음)',
            '이미 호재 시세가 선반영되어 고점 대비 상승 마진이 부족한 곳',
            '실제 역 입구까지의 도보 체감 거리가 너무 먼 단지'
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/157811/pexels-photo-157811.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: 'GTX 수혜 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: 'GTX 심층 지도 다운로드 받기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'GET REPORT' },
          { type: 'headline', text: 'GTX 노선도 및 역세권 지도가 필요하면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '자세한 단지별 수혜 분석 리포트를 무료 제공합니다.' },
          { type: 'sourceNote', text: '출처: 국토교통부 광역교통 기본 계획 고시자료' }
        ]
      }
    ]
  },
  // 7. 1인 가구 소형 아파트 투자
  {
    id: 're_7',
    title: '1인 가구 소형 아파트 투자',
    category: '부동산',
    ratio: '4:5',
    isFavorite: false,
    image: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '소형 아파트 투자 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '1인 가구 소형 아파트 투자',
        subtitle: '1인 가구 급증에 따른 초소형/소형 실거주 겸용 투자법',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'COMPACT APT' },
          { type: 'headline', text: '1인 가구 시대에 딱맞는', accentText: '소형 아파트 투자법' },
          { type: 'badgeRow', badges: [{ text: '초소형 틈새 시장', tone: 'gold' }, { text: '안정적 임대수익', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '소형 시세 동향',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '시장 변동',
        subtitle: '가구 구조 재편에 따른 전용 49㎡ 이하 거래량 추이',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'MARKET TREND' },
          { type: 'headline', text: '1~2인 가구용 소형', accentText: '시장 거래 분석' },
          { type: 'statGrid', cols: 3, items: [
            { value: '41.5%', label: '1인 가구 전국 비중' },
            { value: '+18%', label: '소형 전세 경쟁률 상승' },
            { value: '88% 돌파', label: '오피스텔 대비 환금성' }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '유망 입지 추천',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '추천 입지',
        subtitle: '젊은 고소득 근로자가 밀집한 직주근접 배후단지',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'BEST AREAS' },
          { type: 'headline', text: '수요가 탄탄한 유망', accentText: '입지 가이드' },
          { type: 'compareTable', rows: [
            { label: '서울 마포/여의도 배후', value: '전용 39㎡ 6.8억' },
            { label: '경기 판교 직주 근접선', value: '전용 49㎡ 7.5억', highlight: true },
            { label: '가산/구로 테크노벨리', value: '전용 39㎡ 4.2억' }
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '임대 수익 모델 시뮬레이션',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '수익률 분석',
        subtitle: '보증금 및 월세 전환률을 반영한 기대 월세 시뮬레이션',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'RENTAL YIELD' },
          { type: 'headline', text: '월 고정 월세 수익', accentText: '예상 시뮬레이션' },
          { type: 'compareTable', rows: [
            { label: '인수 소요 주택 실투자금', value: '갭 기준 약 1.5억' },
            { label: '보증금 3,000만원 기준 월세', value: '월 120만원 수령', highlight: true },
            { label: '대출 이자 제외 월 순수익', value: '월 55만원 현금 흐름' }
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '주택 선정 체크리스트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '아파트 선정',
        subtitle: '수요를 극대화할 수 있는 필수 부대 조건',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CHECKLIST' },
          { type: 'headline', text: '공실률 제로를 위한', accentText: '단지 요건 분석' },
          { type: 'checklist', items: [
            '지하철 출구에서 실 도보 7분 이내 초밀착 역세권',
            '최소 500세대 이상의 커뮤니티가 활성화된 대단지 식별',
            '보안 및 편의성 극대화(주변 생활 편의 인프라 구축 여부)'
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '투자 주의사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '주의사항',
        subtitle: '오피스텔 대비 환금성과 취득세 판단',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'CAUTIONS' },
          { type: 'headline', text: '오피스텔과 절대 혼동', accentText: '금지할 필수 요건' },
          { type: 'checklist', items: [
            '아파트 주택법 적용 대상이므로 취득세 중과 세무 규정 유념',
            '일반 다세대 빌라나 주거용 오피스텔 대비 시세 하방 지지력 검증 필수',
            '향후 청약 가점제 지원 시 유주택자 분류에 따른 기회비용 고려'
          ]}
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '소형 투자 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '소형 아파트 추천 단지 명단 다운로드',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'DOWNLOAD LIST' },
          { type: 'headline', text: '갭 1억대 소형 아파트 리스트가 알고 싶다면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '유튜브 채널 구독하고 다양한 소액 갭투자 모델을 시청하세요.' },
          { type: 'sourceNote', text: '출처: 통계청 2026 인구주택총조사 보고서 가구 재편 지표' }
        ]
      }
    ]
  },
  // 8. 부동산 절세 전략 총정리
  {
    id: 're_8',
    title: '부동산 절세 전략 총정리',
    category: '부동산',
    ratio: '4:5',
    isFavorite: true,
    image: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
    pages: [
      {
        id: 1,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '절세 전략 표지',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '부동산 절세 전략 총정리',
        subtitle: '취득세·보유세·양도소득세를 줄이는 합법적 마법 공식',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'TAX STRATEGY' },
          { type: 'headline', text: '부동산 절세 핵심', accentText: '양도세/취득세 마스터' },
          { type: 'badgeRow', badges: [{ text: '합법적 세금 아끼기', tone: 'gold' }, { text: '세무 상담 길잡이', tone: 'neutral' }] }
        ]
      },
      {
        id: 2,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '세금 종류별 세율 비교표',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '세금 종류',
        subtitle: '취득·보유·양도 각 거래 주기별 세율 분석',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'TAX RATES' },
          { type: 'headline', text: '거래 주기별 핵심', accentText: '세금 정리' },
          { type: 'compareTable', rows: [
            { label: '취득세 (1주택 기준)', value: '1% ~ 3%' },
            { label: '종합부동산세 (공제액)', value: '1주택자 최대 12억 면제' },
            { label: '양도소득세 (기본 세율)', value: '6% ~ 45% 누진 세율', highlight: true }
          ]}
        ]
      },
      {
        id: 3,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '합법적 절세 방법론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '절세 실천',
        subtitle: '공동 명의 및 거주 요건 채우기 절세 스킬',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'SAVING METHODS' },
          { type: 'headline', text: '세금을 절반으로', accentText: '줄이는 3가지 원칙' },
          { type: 'checklist', items: [
            '계약 단계에서 반드시 공동 명의 활용하여 과세 표준 분산',
            '양도세 비과세를 위해 실거주 의무 기간 2년 준수',
            '오래 소유할 경우 장기보유특별공제(최대 80%) 전격 활용'
          ]}
        ]
      },
      {
        id: 4,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '필요경비 공제 항목 리스트',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '필요경비 공제',
        subtitle: '양도소득세 신고 시 공제 혜택을 주는 대표 항목',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'EXPENSE CLAIMS' },
          { type: 'headline', text: '양도세에서 차감되는', accentText: '필요경비 입증서류' },
          { type: 'statGrid', cols: 3, items: [
            { value: '샷시 교체', label: '자본적 지출 공제 인정' },
            { value: '수수료 공제', label: '중개/법무사 수수료' },
            { value: '보일러 교체', label: '확장/난방 공사 공제' }
          ]}
        ]
      },
      {
        id: 5,
        bgImage: 'https://images.pexels.com/photos/48195/document-agreement-documents-sign-48195.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '절세 실무상 주의사항',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '세무 유의사항',
        subtitle: '탈세로 의심받는 거래와 가산세 체크',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'WARNINGS' },
          { type: 'headline', text: '단순 비용 처리와', accentText: '세무 조사 리스크' },
          { type: 'checklist', items: [
            '도배, 장판, 페인트 같은 소모성 인테리어 비용은 공제 제외',
            '가족 간 거래 시 증여세를 회피하려는 편법 저가 양도 차단',
            '보유 기간 하루 차이로 1년 미만 단기 세율(70%) 적용 방지'
          ]}
        ]
      },
      {
        id: 6,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '전문 세무사 추천 팁',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '전문가 자문',
        subtitle: '세무 상담을 받기 전 반드시 챙길 필수 자가 진단 리스트',
        layout: 'bottom-left-list',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'EXPERT CONSULT' },
          { type: 'headline', text: '세무사와 상담 전', accentText: '스스로 체크할 기본자료' },
          { type: 'badgeRow', badges: [{ text: '취득/매도 계약서', tone: 'gold' }, { text: '비용 영수증 합계', tone: 'green' }] }
        ]
      },
      {
        id: 7,
        bgImage: 'https://images.pexels.com/photos/6863178/pexels-photo-6863178.jpeg?auto=compress&cs=tinysrgb&w=800',
        bgLabel: '절세 전략 결론',
        overlay: 'linear-gradient(to top, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 100%)',
        title: '마무리',
        subtitle: '양도세 무료 모의 계산기 받기',
        layout: 'center',
        brandTone: 'gold',
        showFrame: true,
        blocks: [
          { type: 'eyebrow', text: 'FREE CALCULATOR' },
          { type: 'headline', text: '합법적 세금 감면 계산기가 필요하면?', accentText: '프로필 링크 클릭!' },
          { type: 'sub', text: '단 3분 만에 내 주택 양도세를 자가 계산하는 도구를 공유합니다.' },
          { type: 'sourceNote', text: '출처: 국세청 홈택스 정식 소득세법 시행령 세무 기준' }
        ]
      }
    ]
  }
];
