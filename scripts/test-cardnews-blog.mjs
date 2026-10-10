// cardnews_to_blog 용 테스트. 외부 호출(AI·DB·네트워크)을 하지 않는다.
//
// 이 저장소에는 테스트 러너가 없다(package.json 에 test 스크립트 없음). 그래서 패키지를
// 새로 설치하지 않고 Node 기본 내장(node:test)만 쓴다. TypeScript 파일은 Node 가
// 직접 읽는다(외부 import 가 없는 순수 파일만 대상 — 그래서 zipManifest/blogText/tagLine
// 은 일부러 import 가 없다).
//
// 실행:  node --test scripts/test-cardnews-blog.mjs
//
// 마지막 그룹은 ZIP 을 실제로 읽는 쪽(네이버 블로그\zip_importer.py)에 넣어 본다.
// 그 폴더나 python 이 없으면 건너뛴다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

import {
  ymdKst,
  buildZipBaseName,
  buildImageFileName,
  buildManuscriptText,
  buildZipManifest,
} from '../src/lib/blog/zipManifest.ts';
import { withTagLine } from '../src/lib/blog/tagLine.ts';
import { parseStructuredBlog, cleanContent } from '../src/lib/blog/blogText.ts';
import { checkSlideImageUrls } from '../src/lib/blog/slideUrlGuard.ts';

// ── 화면(blog-generator downloadZip)이 예전에 인라인으로 하던 일 ─────────────
// zipManifest.ts 로 옮기기 전 코드를 그대로 적어 둔 기준(reference)이다.
// 새 함수가 예전 화면과 똑같은 결과를 내는지 비교하는 데 쓴다.
function legacyBaseName(dateStr, topic, title) {
  const rawTopic = topic.trim() || title.trim() || 'blog';
  const cleanTopic = rawTopic
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\/\\:*?"<>|\[\]]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 30) || 'blog';
  return `${dateStr}_${cleanTopic}`;
}
function legacyImgName(index, rawLabel) {
  const label = rawLabel.trim();
  const cleanLabel = label ? label.replace(/[\/\\:*?"<>|]/g, '_') : `image_${index + 1}`;
  return `${index + 1}_${cleanLabel}.jpg`;
}
function legacyTxt(result) {
  return `[제목]
${result.title}

[메타설명]
${result.metaDescription}

[태그]
${result.tags.map(t => `#${t}`).join(', ')}

[본문]
${withTagLine(result.body, result.tags)}
`;
}

// ── 1. 날짜 ──────────────────────────────────────────────────────────────────
test('ymdKst: 한국 시간 날짜', () => {
  assert.equal(ymdKst(new Date('2026-10-09T14:59:59Z')), '20261009');
  assert.equal(ymdKst(new Date('2026-10-09T15:00:00Z')), '20261010'); // KST 자정 넘김
  assert.equal(ymdKst(new Date('2026-12-31T15:00:00Z')), '20270101'); // 연말 넘김
});

// ── 2. ZIP 이름 ──────────────────────────────────────────────────────────────
test('buildZipBaseName: 예전 화면과 같은 이름', () => {
  const cases = [
    ['20261010', '[1장 표지] 제목: 선거 끝, 아파트 시장은?', ''],
    ['20261010', '  서울/부산\\대구  *?"<>|  ', ''],
    ['20261010', '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라', ''],
    ['20261010', '   ', '비어있는 주제의 제목'],
    ['20261010', '', ''],
    ['20261010', '줄바꿈\n들어간\r\n주제', ''],
    ['20261010', '___앞뒤 밑줄___', ''],
  ];
  for (const [d, topic, title] of cases) {
    assert.equal(buildZipBaseName({ dateStr: d, topic, title }), legacyBaseName(d, topic, title), JSON.stringify(topic));
  }
  assert.equal(buildZipBaseName({ dateStr: '20261010', topic: '', title: '' }), '20261010_blog');
  assert.equal(buildZipBaseName({ dateStr: '20261010', topic: '분양 상담 전 준비 체크리스트' }), '20261010_분양_상담_전_준비_체크리스트');
  // 30자 제한
  const long = buildZipBaseName({ dateStr: '20261010', topic: '가'.repeat(50) });
  assert.equal(long, `20261010_${'가'.repeat(30)}`);
});

test('buildImageFileName: 슬롯 번호와 라벨', () => {
  assert.equal(buildImageFileName(0, ''), '1_image_1.jpg');
  assert.equal(buildImageFileName(3, '   '), '4_image_4.jpg');
  // 앞뒤 공백은 지우고, 금지 문자(/ \ : * ? " < > |)만 _ 로 바꾼다. 안쪽 공백은 그대로다.
  assert.equal(buildImageFileName(1, ' 도입부 / 시장: 분석 '), '2_도입부 _ 시장_ 분석.jpg');
  for (const [i, l] of [[0, ''], [2, 'a/b\\c:d*e?f"g<h>i|j'], [9, '  라벨  ']]) {
    assert.equal(buildImageFileName(i, l), legacyImgName(i, l));
  }
});

// ── 3. 원고 형식 ─────────────────────────────────────────────────────────────
test('buildManuscriptText: 정확한 형식(섹션 머리·태그 쉼표·끝 줄바꿈 1개)', () => {
  const body = '소제목\n첫 문단입니다.\n\n둘째 문단입니다.';
  const tags = ['부동산', '분양'];
  const text = buildManuscriptText({
    title: '제목입니다',
    metaDescription: '메타 설명입니다',
    tags,
    bodyWithTags: withTagLine(body, tags),
  });
  assert.equal(
    text,
    '[제목]\n제목입니다\n\n[메타설명]\n메타 설명입니다\n\n[태그]\n#부동산, #분양\n\n[본문]\n' +
      '소제목\n첫 문단입니다.\n\n둘째 문단입니다.\n\n#부동산 #분양\n',
  );
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'));
  // 예전 화면 코드와 같은 결과
  const result = { title: '제목입니다', metaDescription: '메타 설명입니다', tags, body };
  assert.equal(text, legacyTxt(result));
});

test('buildZipManifest: 그림 없는 슬롯은 건너뛰고 번호는 유지', () => {
  const slots = [
    { id: 'img_1', url: 'https://x.test/a.png', label: '' },
    { id: 'img_2', url: '', label: '' },
    { id: 'img_3', url: 'https://x.test/c.png', label: '' },
  ];
  const m = buildZipManifest({
    dateStr: '20261010', topic: '주제', title: '글제목', metaDescription: '메타', tags: ['a'], bodyWithTags: '본문', slots,
  });
  assert.equal(m.zipFileName, '20261010_주제.zip');
  assert.equal(m.manuscriptFileName, '20261010_주제.txt');
  assert.deepEqual(m.images.map(i => [i.slot, i.fileName, i.url]), [
    [1, '1_image_1.jpg', 'https://x.test/a.png'],
    [3, '3_image_3.jpg', 'https://x.test/c.png'],
  ]);
});

// ── 4. 태그 줄 ───────────────────────────────────────────────────────────────
test('withTagLine: 줄이 쌓이지 않는다', () => {
  assert.equal(withTagLine('본문', null), '본문');
  assert.equal(withTagLine('본문\n\n#a #b', []), '본문');
  assert.equal(withTagLine('본문\n\n#a #b', ['c', '#d']), '본문\n\n#c #d');
  const once = withTagLine('본문', ['x', 'y']);
  assert.equal(withTagLine(once, ['x', 'y']), once);
});

// ── 5. 생성 후처리(블로그 라우트에서 옮겨 온 순수 함수) ──────────────────────
test('parseStructuredBlog: [TITLE]/[BODY]/[META]/[TAGS] 분해', () => {
  const r = parseStructuredBlog(
    '[TITLE]\n제목\n\n[BODY]\n본문 첫 줄\n\n본문 둘째\n\n[META]\n메타\n\n[TAGS]\n태그1, #태그2, 태그3',
  );
  assert.equal(r.title, '제목');
  assert.equal(r.body, '본문 첫 줄\n\n본문 둘째');
  assert.equal(r.metaDescription, '메타');
  assert.deepEqual(r.tags, ['태그1', '태그2', '태그3']);
});

test('parseStructuredBlog: 구분자가 없으면 본문으로 복구하고 기본 태그를 쓴다', () => {
  const r = parseStructuredBlog('그냥 평문입니다.');
  assert.equal(r.body, '그냥 평문입니다.');
  assert.equal(r.title, '블로그 포스팅');
  assert.deepEqual(r.tags, ['블로그', '정보', '포스팅']);
});

test('cleanContent: 네이버는 마크다운·장식 이모지 제거, 해시태그는 보존', () => {
  const src = '## 소제목\n**강조** 문장 ✅ 입니다 📌\n\n#부동산 #분양';
  assert.equal(cleanContent(src, 'naver'), '소제목\n강조 문장  입니다 \n\n#부동산 #분양');
  // 제목은 헤딩 기호를 지우지 않는다(isTitle)
  assert.equal(cleanContent('## 제목', 'naver', true), '## 제목');
  // 티스토리는 헤딩·볼드를 남기고 이모지만 지운다
  assert.equal(cleanContent('## 소제목\n**강조** ✅', 'tistory'), '## 소제목\n**강조** ');
});

// ── 6. ZIP 을 실제로 읽는 쪽(zip_importer.py)에 넣어 본다 ────────────────────
const NAVER_DIR = path.resolve(import.meta.dirname, '..', '..', '..', '네이버 블로그');
const hasPython = spawnSync('python', ['--version']).status === 0;
const hasImporter = existsSync(path.join(NAVER_DIR, 'zip_importer.py'));

test('zip_importer.parse_manuscript / import_cardnews_zip 이 이 ZIP 을 그대로 읽는다', { skip: !(hasPython && hasImporter) && 'python 또는 네이버 블로그\\zip_importer.py 없음' }, async () => {
  const title = '서울 아파트 매매가 87주 연속 상승';
  const body =
    '시장 흐름\n올해 들어 상승세가 이어지고 있습니다. 자세한 수치는 [3] 참고.\n\n' +
    '정책 변수\n대출 규제가 변수입니다.\n\n' +
    '마무리\n궁금한 점은 댓글로 남겨 주세요.';
  const tags = ['서울아파트', '부동산시장', '분양'];
  const bodyWithTags = withTagLine(body, tags);

  const m = buildZipManifest({
    dateStr: '20261010',
    topic: '카드뉴스 테스트',
    title,
    metaDescription: '메타 설명',
    tags,
    bodyWithTags,
    slots: [
      { id: 'img_1', url: 'https://x.test/1.png', label: '' },
      { id: 'img_2', url: 'https://x.test/2.png', label: '' },
      { id: 'img_3', url: '', label: '' },
      { id: 'img_4', url: 'https://x.test/4.png', label: '' },
    ],
  });

  // 바깥 스크립트가 하듯이 manifest 대로 ZIP 을 만든다 (이미지는 가짜 바이트)
  const zip = new JSZip();
  zip.file(m.manuscriptFileName, m.manuscriptText);
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  for (const im of m.images) zip.file(im.fileName, png);
  const tmp = mkdtempSync(path.join(tmpdir(), 'cardnews-blog-'));
  try {
    const zipPath = path.join(tmp, m.zipFileName);
    writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

    const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(NAVER_DIR)})
from zip_importer import import_cardnews_zip, parse_manuscript
import zipfile
with zipfile.ZipFile(${JSON.stringify(zipPath)}) as zf:
    names = zf.namelist()
    txt = zf.read([n for n in names if n.endswith('.txt')][0]).decode('utf-8')
t, b, g = parse_manuscript(txt)
dest = import_cardnews_zip(${JSON.stringify(zipPath)}, posts_dir=${JSON.stringify(path.join(tmp, 'posts'))}, folder_name='t')
print(json.dumps({'title': t, 'body': b, 'tags': g, 'dest': str(dest), 'names': names}, ensure_ascii=False))
`;
    const r = spawnSync('python', ['-c', py], { encoding: 'utf-8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());

    assert.equal(out.title, title);
    assert.equal(out.tags, '#서울아파트, #부동산시장, #분양');
    // 소제목-본문 병합으로 빈 줄 위치만 달라질 뿐, 글자는 하나도 빠지지 않는다
    const squash = s => s.replace(/\s+/g, '');
    assert.equal(squash(out.body), squash(bodyWithTags));
    assert.ok(out.body.includes('[3] 참고'), '본문 중간의 각주 표기 [3] 에서 잘리면 안 된다');

    assert.deepEqual(out.names.filter(n => n.endsWith('.txt')), [m.manuscriptFileName]); // 원고 txt 는 하나
    const folder = out.dest;
    assert.match(folder.replace(/\\/g, '/'), /posts\/2026-10-10\/t$/); // ZIP 파일명 앞 8자리 → 날짜
    // (Windows 의 python 은 텍스트 파일을 CRLF 로 쓴다 — 줄바꿈 종류는 비교에서 뺀다)
    const lf = s => s.replace(/\r\n/g, '\n');
    assert.equal(lf(readFileSync(path.join(folder, 'tags.txt'), 'utf-8')), '서울아파트\n부동산시장\n분양');
    // 그림 없는 슬롯(3번)은 건너뛰고, 남은 것은 표시 순서대로 1,2,3.jpg
    assert.equal(lf(readFileSync(path.join(folder, 'image_order.txt'), 'utf-8')), '1.jpg\n2.jpg\n3.jpg');
    assert.deepEqual(readdirSync(folder).filter(f => f.endsWith('.jpg')).sort(), ['1.jpg', '2.jpg', '3.jpg']);
    const content = lf(readFileSync(path.join(folder, 'content.txt'), 'utf-8'));
    assert.ok(content.startsWith(`${title}\n\n`));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── 7. slideImageUrls 검사 (아무 주소나 받지 않는다) ─────────────────────────
const SB = 'https://abcdwxyz.supabase.co';
const DID = 'f93f602c-8729-4e09-b747-3d55acc6fe3c';
const good = n => Array.from({ length: n }, (_, i) =>
  `${SB}/storage/v1/object/public/card-images/auto/${DID}_1791369553212_${i + 1}.png`);
const check = (urls, over = {}) =>
  checkSlideImageUrls({ urls, designId: DID, slideCount: urls.length, supabaseUrl: SB, ...over });

test('slideImageUrls: 우리 저장소의 이 디자인 그림이면 통과', () => {
  assert.equal(check(good(6)), null);
  // 대문자 designId 도 같은 id 로 본다
  assert.equal(check(good(2), { designId: DID.toUpperCase() }), null);
});

test('slideImageUrls 거절 ①: 외부 주소·남의 디자인·다른 버킷·http 등은 이유와 함께 거절', () => {
  const one = u => check([u], { slideCount: 1 });
  // 외부 호스트
  assert.match(one(`https://evil.example.com/storage/v1/object/public/card-images/auto/${DID}_1.png`), /우리 Supabase 저장소/);
  // 우리 호스트인 척 (서브도메인 덧붙임 / @ 로 속이기)
  assert.match(one(`https://abcdwxyz.supabase.co.evil.com/storage/v1/object/public/card-images/auto/${DID}_1.png`), /우리 Supabase 저장소/);
  assert.match(one(`https://${'abcdwxyz.supabase.co'}@evil.com/storage/v1/object/public/card-images/auto/${DID}_1.png`), /우리 Supabase 저장소/);
  assert.match(one(`https://user:pw@abcdwxyz.supabase.co/storage/v1/object/public/card-images/auto/${DID}_1.png`), /로그인 정보/);
  // http
  assert.match(one(`http://abcdwxyz.supabase.co/storage/v1/object/public/card-images/auto/${DID}_1.png`), /https/);
  // 다른 버킷
  assert.match(one(`${SB}/storage/v1/object/public/other-bucket/auto/${DID}_1.png`), /card-images 버킷/);
  // 같은 버킷이지만 다른 디자인의 그림
  assert.match(one(`${SB}/storage/v1/object/public/card-images/auto/00000000-0000-4000-8000-000000000000_1.png`), /designId/);
  // 상위 경로로 빠져나가기(인코딩 포함), 쿼리, 해시
  assert.match(one(`${SB}/storage/v1/object/public/card-images/auto/../../x/${DID}_1.png`), /card-images 버킷|상위 경로/);
  assert.match(one(`${SB}/storage/v1/object/public/card-images/a/%2e%2e/${DID}_1.png`), /인코딩된 경로 문자/);
  assert.match(one(`${SB}/storage/v1/object/public/card-images/a%2F${DID}_1.png`), /인코딩된 경로 문자/);
  assert.match(one(`${SB}/storage/v1/object/public/card-images/auto/${DID}_1.png?token=x`), /쿼리/);
  assert.match(one(`${SB}/storage/v1/object/public/card-images/auto/${DID}_1.png#x`), /쿼리/);
  // 주소가 아닌 값
  assert.match(one('not a url'), /형식/);
  assert.match(one('file:///C:/secret.png'), /https/);
  // 검증 설정이 없으면 통과시키지 않고 거절한다
  assert.match(check(good(1), { supabaseUrl: '' }), /검증할 수 없습니다/);
  // 어느 번째 주소가 문제인지 알려준다
  const mixed = [...good(2), 'https://evil.example.com/a.png', ...good(1)];
  assert.match(check(mixed), /slideImageUrls\[2\]/);
});

test('slideImageUrls 거절 ②: 개수가 슬라이드 수와 다르면 거절(일부만 새로 그리기 없음)', () => {
  const fewer = check(good(5), { slideCount: 6 });
  assert.match(fewer, /개수\(5\)가 슬라이드 수\(6\)와 다릅니다/);
  assert.match(fewer, /일부만 새로 그리는 방식은 지원하지 않습니다/);
  assert.match(check(good(7), { slideCount: 6 }), /개수\(7\)가 슬라이드 수\(6\)/);
  assert.match(check([], { slideCount: 6 }), /개수\(0\)/);
  // 개수가 맞아도 주소가 틀리면 거절 — 개수 검사가 주소 검사를 건너뛰게 하지 않는다
  assert.match(check([...good(5), 'https://evil.example.com/a.png'], { slideCount: 6 }), /우리 Supabase 저장소/);
});
