// 블로그 글 후처리 — 순수 함수만 모았다(외부 import 없음).
//
// 원래 src/app/api/generate/blog/route.ts 의 POST 안에 있던 두 함수를 그대로
// 옮긴 것이다. 본문은 한 글자도 바꾸지 않았다. 옮긴 이유는 두 가지다.
//   1) 블로그 생성 본체가 lib/blog/generateBlogPost.ts 로 옮겨가 HTTP 경로와
//      MCP 도구가 같은 코드를 부르게 됐다.
//   2) 이 두 함수는 AI 없이 돌릴 수 있어서, 외부 호출 없이 테스트할 수 있다
//      (scripts/test-cardnews-blog.mjs).
//
export const parseStructuredBlog = (cleanText: string): { title: string; body: string; metaDescription: string; tags: string[] } => {
  const titleTag = '[TITLE]';
  const bodyTag = '[BODY]';
  const metaTag = '[META]';
  const tagsTag = '[TAGS]';

  const idxTitle = cleanText.indexOf(titleTag);
  const idxBody = cleanText.indexOf(bodyTag);
  const idxMeta = cleanText.indexOf(metaTag);
  const idxTags = cleanText.indexOf(tagsTag);

  const getSection = (currentTag: string, currentIdx: number): string => {
    if (currentIdx === -1) return '';
    const start = currentIdx + currentTag.length;
    const nextIndices = [idxTitle, idxBody, idxMeta, idxTags]
      .filter(idx => idx > currentIdx)
      .sort((a, b) => a - b);
    const end = nextIndices.length > 0 ? nextIndices[0] : cleanText.length;
    return cleanText.substring(start, end).trim();
  };

  let title = getSection(titleTag, idxTitle);
  let body = getSection(bodyTag, idxBody);
  let metaDescription = getSection(metaTag, idxMeta);
  const tagsText = getSection(tagsTag, idxTags);

  // 제목 복구
  if (!title && idxBody !== 0 && idxBody !== -1) {
    title = cleanText.substring(0, idxBody).replace(/^[#\s[\]\w]+/, '').split('\n')[0].trim();
  }

  // 본문 복구
  if (!body && idxTitle !== -1) {
    body = getSection(titleTag, idxTitle);
  } else if (!body && idxTitle === -1 && idxBody === -1) {
    body = cleanText;
  }

  // 메타 설명 복구 (잘렸거나 누락 시 본문 앞부분 발췌)
  if (!metaDescription) {
    const plainBody = body.replace(/[#*`_\-\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
    metaDescription = plainBody.substring(0, 120) + '...';
  }

  // 태그 복구
  let tags: string[] = [];
  if (tagsText) {
    tags = tagsText
      .split(/[,#\s]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.length < 15);
  }
  if (tags.length === 0) {
    tags = ['블로그', '정보', '포스팅'];
  }

  return {
    title: title || '블로그 포스팅',
    body: body || '본문을 생성하지 못했습니다. 다시 시도해 주세요.',
    metaDescription: metaDescription.substring(0, 150),
    tags: tags.slice(0, 8)
  };
};

export const cleanContent = (text: string, fmt: string, isTitle = false): string => {
  if (!text) return text;

  // 1. 공통: 장식용/강조용 이모지 제거 (정규식 기반)
  const decorativeEmojisRegex = /[✅📌🎉⭐👉✨🔥📢📍🔔💡🚀🔍👑✔️✔🔵🟢🔴⚫⚪🔸🔹🔺🔻]/g;
  let cleaned = text.replace(decorativeEmojisRegex, '');

  // 2. 네이버/인스타그램 마크다운 제거
  if (fmt === 'naver' || fmt === 'instagram') {
    if (!isTitle) {
      // 행의 시작에 위치한 ## ### 등만 매칭하여 공백과 함께 기호만 제거 (해시태그 #태그 오인 제거 완벽 차단)
      cleaned = cleaned.replace(/^(#{1,6})\s+(.+)$/gm, '$2');
    }
    // 짝이 맞는 볼드 기호만 변환하여 단순 아스테리스크(곱셈 5*5 등) 오인 제거 차단
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/__(.*?)__/g, '$1');
  }

  return cleaned;
};
