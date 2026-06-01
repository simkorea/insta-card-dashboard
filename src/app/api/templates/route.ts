import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { REAL_ESTATE_SEEDS } from './real_estate_seeds';

export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), 'public', 'templates');
    
    // 폴더가 없으면 생성
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    const files = fs.readdirSync(templatesDir);
    const validImageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    
    const customTemplates: any[] = [];

    files.forEach((file, idx) => {
      const ext = path.extname(file).toLowerCase();
      const filePath = path.join(templatesDir, file);

      if (validImageExtensions.includes(ext)) {
        // 일반 이미지 템플릿 처리
        customTemplates.push({
          id: `custom_img_${idx}`,
          title: path.parse(file).name,
          category: '내 템플릿',
          ratio: '4:5', // 기본값
          isFavorite: false,
          image: `/templates/${file}`
        });
      } else if (ext === '.mirratpl') {
        // .mirratpl (base64 JSON) 템플릿 처리
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          // 두 번째 줄이 base64 인코딩된 데이터
          if (lines.length >= 2 && lines[0].trim() === 'MIRRA-TPL-V1') {
            const base64Data = lines[1].trim();
            const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
            const data = JSON.parse(jsonStr);
            
            // 썸네일 이미지 추출 (ko의 첫 번째 이미지 우선, 없으면 en, 없으면 플레이스홀더)
            let thumbImage = '/placeholder.png';
            if (data.exampleImages) {
              if (data.exampleImages.ko && data.exampleImages.ko.length > 0) {
                thumbImage = data.exampleImages.ko[0];
              } else if (data.exampleImages.en && data.exampleImages.en.length > 0) {
                thumbImage = data.exampleImages.en[0];
              }
            }

            customTemplates.push({
              id: `mirra_tpl_${idx}`,
              title: data.name || path.parse(file).name,
              category: data.category || '커스텀',
              ratio: data.aspectRatio || '4:5',
              isFavorite: true,
              image: thumbImage
            });
          }
        } catch (err) {
          console.error(`Failed to parse ${file}:`, err);
        }
      }
    });

    // 기본 제공 목업 템플릿 (로컬 폴더에 이미지가 없을 때 보여주기 위함)
    const mockTemplates = [
      // 비즈니스/마케팅
      { id: 1, title: '매출 200% 올리는 마케팅 전략', category: '비즈니스/마케팅', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500&q=80' },
      { id: 2, title: '스타트업 브랜딩 A to Z', category: '비즈니스/마케팅', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=500&q=80' },
      { id: 3, title: '2026 소셜미디어 트렌드', category: '비즈니스/마케팅', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=500&q=80' },
      // 라이프스타일
      { id: 4, title: '하루 10분 마인드풀니스 루틴', category: '라이프스타일', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=500&q=80' },
      { id: 5, title: '번아웃 없는 생산성 높이는 법', category: '라이프스타일', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=500&q=80' },
      { id: 6, title: '건강한 아침 루틴 5가지', category: '라이프스타일', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=500&q=80' },
      // 카페/음식
      { id: 7, title: '망원동 감성 카페 추천', category: '카페', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=500&q=80' },
      { id: 8, title: '혼밥족을 위한 맛집 가이드', category: '음식', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80' },
      { id: 9, title: '초간단 홈카페 레시피 5선', category: '카페', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=500&q=80' },
      // 여행
      { id: 10, title: '제주도 동쪽 감성 스팟 BEST 5', category: '여행', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=500&q=80' },
      { id: 11, title: '도쿄 여행 완전 정복 가이드', category: '여행', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500&q=80' },
      { id: 12, title: '유럽 배낭여행 꿀팁 모음', category: '여행', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=500&q=80' },
      // 패션/뷰티
      { id: 13, title: '가을 겨울 레이어링 코디 가이드', category: '패션/뷰티', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80' },
      { id: 14, title: '데일리 메이크업 5분 완성', category: '패션/뷰티', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=500&q=80' },
      { id: 15, title: '올여름 트렌드 아이템 총정리', category: '패션/뷰티', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80' },
      // 교육/자기계발
      { id: 16, title: '시작의 아름다움을 포용하다', category: '교육/자기계발', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1593696140826-c58b021acf8b?w=500&q=80' },
      { id: 17, title: 'AI 시대 필수 스킬 TOP 5', category: '교육/자기계발', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80' },
      { id: 18, title: '책 한 권으로 배우는 독서법', category: '교육/자기계발', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&q=80' },
      // 음악/문화
      { id: 19, title: '비 오는 오후를 위한 인디 음악 5선', category: '음악', ratio: '4:5', isFavorite: true, image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80' },
      // 인테리어
      { id: 20, title: '자연을 담은 홈오피스 집중력 키우기', category: '인테리어', ratio: '4:5', isFavorite: false, image: 'https://images.unsplash.com/photo-1498409785966-ab341407de6e?w=500&q=80' },
    ];

    // 합쳐서 반환 (로컬 커스텀 및 부동산 시드 템플릿 포함)
    return NextResponse.json({ success: true, data: [...customTemplates, ...REAL_ESTATE_SEEDS, ...mockTemplates] });

  } catch (error: any) {
    console.error('Error reading templates:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
