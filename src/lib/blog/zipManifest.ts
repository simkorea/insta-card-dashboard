// 블로그 원고 ZIP의 파일 이름·원고 형식. 외부 import 없는 순수 함수만 모았다.
//
// 원래 blog-generator 화면의 '전체 다운로드'(downloadZip)가 인라인으로 하던 일이다.
// 화면과 MCP 도구(cardnews_to_blog)가 같은 함수를 쓰게 해서, 바깥 스크립트가
// 다시 만든 ZIP이 화면이 만든 ZIP과 어긋나지 않게 한다.
//
// ZIP을 읽는 쪽: 네이버 블로그\publish.py → zip_importer.parse_manuscript
//   - ZIP 안에서 첫 .txt 를 원고로 읽는다 (원고 .txt 는 하나만 넣는다)
//   - 원고는 '줄 전체가 [제목] / [메타설명] / [태그] / [본문]' 인 섹션 머리로 나뉜다
//   - 이미지는 앞 숫자 순서대로 읽는다 ('1_image_1.jpg' → 1번)
//   - ZIP 파일명 앞 8자리(YYYYMMDD)가 글 날짜가 된다

/** 오늘 날짜 YYYYMMDD (한국 시간). 화면은 브라우저 현지 날짜를 쓰는데 같은 값이다. */
export function ymdKst(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 'YYYYMMDD_주제' — 확장자 없는 이름. 원고 .txt 와 .zip 이 같은 이름을 쓴다. */
export function buildZipBaseName(opts: { dateStr: string; topic?: string; title?: string }): string {
  const rawTopic = (opts.topic || '').trim() || (opts.title || '').trim() || 'blog';
  const cleanTopic = rawTopic
    .replace(/[\r\n]+/g, ' ')           // 줄바꿈을 공백으로
    .replace(/[\/\\:*?"<>|\[\]]/g, '_')  // 윈도우 금지문자 + 대괄호 제거
    .replace(/\s+/g, '_')                // 연속 공백을 _ 로
    .replace(/_+/g, '_')                 // 연속 _ 를 하나로
    .replace(/^_+|_+$/g, '')             // 앞뒤 _ 제거
    .substring(0, 30) || 'blog';         // 30자 제한, 비면 'blog'
  return `${opts.dateStr}_${cleanTopic}`;
}

/**
 * 이미지 파일 이름. slotIndex 는 0부터 — 이미지 슬롯 전체에서의 자리다.
 * 비어 있는 슬롯은 ZIP에 안 들어가므로 번호가 건너뛸 수 있다(1, 2, 4 …).
 * 확장자는 항상 .jpg 다(카드 그림은 실제로 PNG 인데 화면도 그렇게 붙인다).
 */
export function buildImageFileName(slotIndex: number, label: string): string {
  const trimmed = (label || '').trim();
  const cleanLabel = trimmed ? trimmed.replace(/[\/\\:*?"<>|]/g, '_') : `image_${slotIndex + 1}`;
  return `${slotIndex + 1}_${cleanLabel}.jpg`;
}

/**
 * 원고 .txt 의 내용. bodyWithTags 는 withTagLine(body, tags) 를 거친 본문이다
 * (본문 끝에 해시태그 줄이 붙은 것) — 호출하는 쪽이 만들어 넘긴다.
 * 끝에 줄바꿈 한 개가 붙는다.
 */
export function buildManuscriptText(opts: {
  title: string;
  metaDescription: string;
  tags: string[];
  bodyWithTags: string;
}): string {
  return `[제목]
${opts.title}

[메타설명]
${opts.metaDescription}

[태그]
${opts.tags.map(t => `#${t}`).join(', ')}

[본문]
${opts.bodyWithTags}
`;
}

export type ZipSlot = { id: string; url: string; label: string };

export type ZipManifest = {
  baseFileName: string;
  zipFileName: string;
  manuscriptFileName: string;
  manuscriptText: string;
  /** url 이 있는 슬롯만, 슬롯 순서대로. ZIP 안 파일 이름이 fileName 이다. */
  images: { slot: number; id: string; url: string; label: string; fileName: string }[];
};

export function buildZipManifest(opts: {
  dateStr: string;
  topic?: string;
  title: string;
  metaDescription: string;
  tags: string[];
  bodyWithTags: string;
  slots: ZipSlot[];
}): ZipManifest {
  const baseFileName = buildZipBaseName({ dateStr: opts.dateStr, topic: opts.topic, title: opts.title });
  const images = opts.slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.url !== '')
    .map(({ s, i }) => ({
      slot: i + 1,
      id: s.id,
      url: s.url,
      label: s.label,
      fileName: buildImageFileName(i, s.label),
    }));
  return {
    baseFileName,
    zipFileName: `${baseFileName}.zip`,
    manuscriptFileName: `${baseFileName}.txt`,
    manuscriptText: buildManuscriptText({
      title: opts.title,
      metaDescription: opts.metaDescription,
      tags: opts.tags,
      bodyWithTags: opts.bodyWithTags,
    }),
    images,
  };
}
