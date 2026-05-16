// 이 파일은 사용자가 직접 템플릿을 추가/수정할 수 있는 데이터 저장소입니다.
// 실제 운영 환경에서는 데이터베이스나 API 서버에서 불러오도록 변경할 수 있습니다.

export const templates = [
  {
    id: 1,
    title: "미니멀 스튜디오 룸투어",
    description: "현대적인 미학과 일상적인 기능성의 균형을 맞춘 미니멀리즘 원룸 인테리어를 소개합니다.",
    ratio: "4:5",
    category: "라이프스타일",
    thumbnail: "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?w=500&q=80",
    isFavorite: true,
  },
  {
    id: 2,
    title: "미니멀 카페 BEST 3",
    description: "여유로운 주말을 완성하는 스페셜티 커피와 슬로우 라이프를 위한 공간",
    ratio: "4:5",
    category: "라이프스타일",
    thumbnail: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500&q=80",
    isFavorite: true,
  },
  {
    id: 3,
    title: "도심 속 숨겨진 오아시스",
    description: "도시의 분주함 속에서 찾는 평화로운 휴식처",
    ratio: "4:5",
    category: "라이프스타일",
    thumbnail: "https://images.unsplash.com/photo-1542728928-1413d1894ed1?w=500&q=80",
    isFavorite: true,
  },
  {
    id: 4,
    title: "공덕 자이르네 청약 가이드",
    description: "20~50대를 위한 필수 부동산 청약 핵심 정리",
    ratio: "4:5",
    category: "비즈니스",
    thumbnail: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=80",
    isFavorite: false,
  },
  {
    id: 5,
    title: "IT 비즈니스 카드",
    description: "혁신적인 IT 기업을 위한 전문적인 카드뉴스",
    ratio: "1:1",
    category: "기술",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80",
    isFavorite: false,
  }
];

export const categories = [
  "전체", "즐겨찾기", "내 템플릿", "비즈니스", "라이프스타일", "교육", "기술", "마케팅", "디자인", "기타"
];

export const ratios = ["전체", "1:1", "4:5", "16:9", "9:16", "3:4"];
