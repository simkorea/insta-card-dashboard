// 사진 배경(photoBgUrl)·upload_image·search_images 용 테스트.
// 외부 호출(네트워크·저장소·AI)을 하지 않는다 — 가짜 fetch 와 가짜 저장소를 넣는다.
// Node 내장 node:test 만 쓴다(설치 없음).
//
// 실행:  node --test scripts/test-photo-bg.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkPhotoUrl,
  checkPhotoUrls,
  sniffImage,
  safeBaseName,
  fetchAndPinPhoto,
  removePinned,
  decodeUploadImage,
  uploadMcpImage,
  mapPexelsPhotos,
  mapUnsplashPhotos,
  MAX_UPLOAD_BYTES,
  MAX_BASE64_CHARS,
} from '../src/lib/mcp/photoBg.ts';
import { exactSlideSchema } from '../src/lib/mcp/exactSlides.ts';

const SB = 'https://abcdwxyz.supabase.co';
const OURS = `${SB}/storage/v1/object/public/card-images/mcp-uploads/1_abcd_site.jpg`;

// 짧은 가짜 파일 머리(매직 넘버) + 채우기
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(7)]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(60).fill(7)]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, ...new Array(60).fill(7)]);
const HTML = new TextEncoder().encode('<html><body>not an image</body></html>');
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const GIF = new TextEncoder().encode('GIF89a......');
const b64 = (u8) => Buffer.from(u8).toString('base64');

// 가짜 저장소: 올린 것을 기록하고, 실패하게 만들 수도 있다
function fakeClient({ failUpload = false } = {}) {
  const uploaded = [];
  const removed = [];
  return {
    uploaded,
    removed,
    storage: {
      from(bucket) {
        return {
          async upload(path, body, opts) {
            if (failUpload) return { error: { message: 'boom' } };
            uploaded.push({ bucket, path, bytes: body.length, ...opts });
            return { error: null };
          },
          getPublicUrl: (path) => ({ data: { publicUrl: `${SB}/storage/v1/object/public/${bucket}/${path}` } }),
          async remove(paths) { removed.push(...paths); },
        };
      },
    },
  };
}
const respond = (body, init = {}) => async () => new Response(body, { status: 200, ...init });

// ── 1. 주소 검사 ─────────────────────────────────────────────────────────────
test('허용 출처: pexels·unsplash(쿼리 허용)·우리 card-images 는 통과', () => {
  assert.equal(checkPhotoUrl('https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&w=940', SB), null);
  assert.equal(checkPhotoUrl('https://images.unsplash.com/photo-123?ixid=abc&w=1080', SB), null);
  assert.equal(checkPhotoUrl('https://IMAGES.PEXELS.COM/photos/1/a.jpeg', SB), null); // 대소문자
  assert.equal(checkPhotoUrl(OURS, SB), null);
  assert.equal(checkPhotoUrl('https://images.pexels.com/photos/1/a.jpeg', undefined), null); // 저장소 설정 없어도 외부 허용 출처는 통과
});

test('거절: 외부 호스트·위장 호스트·http·포트·로그인 정보·내부망', () => {
  const no = (u, re) => assert.match(checkPhotoUrl(u, SB), re, u);
  no('https://evil.example.com/a.jpg', /허용되지 않은 출처/);
  no('https://images.pexels.com.evil.com/a.jpg', /허용되지 않은 출처/);          // 접미사 위장
  no('https://evilimages.pexels.com/a.jpg', /허용되지 않은 출처/);
  no('https://images.pexels.com@evil.com/a.jpg', /로그인 정보|허용되지 않은 출처/); // @ 위장
  no('https://user:pw@images.pexels.com/a.jpg', /로그인 정보/);
  no('http://images.pexels.com/a.jpg', /https/);
  no('https://images.pexels.com:8443/a.jpg', /포트/);
  no('https://localhost/a.jpg', /허용되지 않은 출처/);
  no('https://127.0.0.1/a.jpg', /허용되지 않은 출처/);
  no('https://169.254.169.254/latest/meta-data/', /허용되지 않은 출처/);          // 클라우드 메타데이터 주소
  no('https://[::1]/a.jpg', /허용되지 않은 출처/);
  no('file:///C:/secret.png', /https/);
  no('ftp://images.pexels.com/a.jpg', /https/);
  no('not a url', /형식/);
  no('', /비었/);
  no(`https://images.pexels.com/${'a'.repeat(2100)}`, /너무 깁니다/);
});

test('거절: 우리 저장소라도 다른 버킷·쿼리·상위 경로·인코딩 경로는 안 된다', () => {
  const no = (u, re) => assert.match(checkPhotoUrl(u, SB), re, u);
  no(`${SB}/storage/v1/object/public/other-bucket/a.jpg`, /card-images 버킷/);
  no(`${SB}/storage/v1/object/sign/card-images/a.jpg?token=x`, /쿼리|card-images 버킷/);
  no(`${SB}/storage/v1/object/public/card-images/a.jpg?token=x`, /쿼리/);
  no(`${SB}/storage/v1/object/public/card-images/../private/a.jpg`, /card-images 버킷|상위 경로/);
  no(`${SB}/storage/v1/object/public/card-images/a/%2e%2e/b.jpg`, /인코딩된 경로 문자/);
  no(`${SB}/storage/v1/object/public/card-images/a%2Fb.jpg`, /인코딩된 경로 문자/);
  no(`${SB}/rest/v1/card_designs?select=*`, /쿼리|card-images 버킷/);
  no('https://other.supabase.co/storage/v1/object/public/card-images/a.jpg', /허용되지 않은 출처/); // 남의 프로젝트
});

test('checkPhotoUrls: 어느 장이 문제인지 알려 주고, 사진 없는 장은 건너뛴다', () => {
  const s = [{}, { photoBgUrl: 'https://images.pexels.com/photos/1/a.jpeg' }, { photoBgUrl: 'https://evil.example.com/a.jpg' }];
  assert.match(checkPhotoUrls(s, SB), /^slides\[2\]\.photoBgUrl: /);
  assert.equal(checkPhotoUrls(s.slice(0, 2), SB), null);
  assert.equal(checkPhotoUrls([{}, {}], SB), null);
});

test('스키마: photoBgUrl 은 URL 형식이어야 하고 2000자 이하', () => {
  const base = { headline: '제목', body: '본문' };
  assert.equal(exactSlideSchema.safeParse({ ...base, photoBgUrl: 'https://images.pexels.com/a.jpg' }).success, true);
  assert.equal(exactSlideSchema.safeParse({ ...base, photoBgUrl: 'nope' }).success, false);
  assert.equal(exactSlideSchema.safeParse({ ...base, photoBgUrl: `https://a.co/${'a'.repeat(2000)}` }).success, false);
});

// ── 2. 파일 종류(매직 넘버) ──────────────────────────────────────────────────
test('sniffImage: jpg·png·webp 만 알아보고 나머지는 null', () => {
  assert.deepEqual(sniffImage(JPG), { ext: 'jpg', mime: 'image/jpeg' });
  assert.deepEqual(sniffImage(PNG), { ext: 'png', mime: 'image/png' });
  assert.deepEqual(sniffImage(WEBP), { ext: 'webp', mime: 'image/webp' });
  for (const bad of [HTML, SVG, GIF, new Uint8Array(0), Uint8Array.from([0xff, 0xd8]), Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])]) {
    assert.equal(sniffImage(bad), null);
  }
});

test('safeBaseName: ASCII 만, 한글·경로 문자는 _ 로, 비면 img', () => {
  assert.equal(safeBaseName('site-aerial.jpg'), 'site-aerial');
  assert.equal(safeBaseName('조감도 최종.png'), 'img');
  assert.equal(safeBaseName('../../etc/passwd.jpg'), 'etc_passwd');
  assert.equal(safeBaseName('a b/c\\d.webp'), 'a_b_c_d');
  assert.equal(safeBaseName('x'.repeat(100) + '.jpg').length, 40);
});

// ── 3. 내려받아 우리 저장소에 고정 ───────────────────────────────────────────
test('고정: 그림을 받아 card-images/mcp-bg/ 에 올리고 우리 주소를 돌려준다', async () => {
  const c = fakeClient();
  const r = await fetchAndPinPhoto({
    client: c, url: 'https://images.pexels.com/photos/1/a.jpeg', index: 2,
    fetchImpl: respond(JPG, { headers: { 'content-type': 'text/html' } }), // 서버가 거짓말해도 매직 넘버를 본다
    now: () => 1700000000000,
  });
  assert.equal(r.ok, true);
  assert.match(r.path, /^mcp-bg\/1700000000000_[0-9a-f]{8}_s3\.jpg$/);
  assert.equal(r.url, `${SB}/storage/v1/object/public/card-images/${r.path}`);
  assert.equal(r.contentType, 'image/jpeg');
  assert.equal(c.uploaded.length, 1);
  assert.deepEqual([c.uploaded[0].bucket, c.uploaded[0].contentType, c.uploaded[0].upsert], ['card-images', 'image/jpeg', false]);
  assert.equal(c.uploaded[0].bytes, JPG.length);
});

test('고정: fetch 는 리다이렉트를 따라가지 않고(manual) 시간 제한을 둔다', async () => {
  let seen;
  await fetchAndPinPhoto({
    client: fakeClient(), url: 'https://images.pexels.com/a.jpeg',
    fetchImpl: async (u, init) => { seen = init; return new Response(PNG, { status: 200 }); },
  });
  assert.equal(seen.redirect, 'manual');
  assert.ok(seen.signal instanceof AbortSignal);
});

test('고정 거절: 리다이렉트·HTTP 오류·그림 아님·너무 큼·네트워크 오류 — 아무것도 올리지 않는다', async () => {
  const run = async (fetchImpl, extra = {}) => {
    const c = fakeClient();
    const r = await fetchAndPinPhoto({ client: c, url: 'https://images.pexels.com/a.jpeg', fetchImpl, ...extra });
    assert.equal(c.uploaded.length, 0, '실패했는데 올라갔다');
    return r;
  };
  let r = await run(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/a.jpg' } }));
  assert.equal(r.ok, false); assert.match(r.error, /리다이렉트/);

  r = await run(async () => new Response('nope', { status: 404 }));
  assert.match(r.error, /HTTP 404/);

  r = await run(respond(HTML, { headers: { 'content-type': 'image/jpeg' } })); // 이름만 그림
  assert.match(r.error, /그림 파일이 아닙니다/);
  r = await run(respond(SVG)); assert.match(r.error, /그림 파일이 아닙니다/);
  r = await run(respond(GIF)); assert.match(r.error, /그림 파일이 아닙니다/);

  // 선언된 크기가 한도 초과
  r = await run(respond(JPG, { headers: { 'content-length': String(9 * 1024 * 1024) } }));
  assert.match(r.error, /너무 큽니다/);
  // 선언은 작게 하고 실제로는 큰 경우 — 읽으면서 센다
  r = await run(respond(new Uint8Array(2000).fill(1)), { maxBytes: 1000 });
  assert.match(r.error, /너무 큽니다/);

  r = await run(async () => { throw new Error('ECONNRESET'); });
  assert.match(r.error, /내려받지 못했습니다.*ECONNRESET/);

  // 저장소 오류
  const c = fakeClient({ failUpload: true });
  const bad = await fetchAndPinPhoto({ client: c, url: 'https://images.pexels.com/a.jpeg', fetchImpl: respond(JPG) });
  assert.equal(bad.ok, false); assert.match(bad.error, /저장소 업로드 실패: boom/);
});

test('removePinned: 올린 것을 지운다(없으면 아무것도 안 함)', async () => {
  const c = fakeClient();
  await removePinned(c, ['mcp-bg/a.jpg', 'mcp-bg/b.jpg']);
  assert.deepEqual(c.removed, ['mcp-bg/a.jpg', 'mcp-bg/b.jpg']);
  const c2 = fakeClient();
  await removePinned(c2, []);
  assert.deepEqual(c2.removed, []);
  // 지우다 던져도 호출한 쪽을 깨뜨리지 않는다
  await removePinned({ storage: { from: () => ({ remove: async () => { throw new Error('x'); } }) } }, ['a']);
});

// ── 4. upload_image ──────────────────────────────────────────────────────────
test('upload_image: png·jpg·webp 를 받아 mcp-uploads/ 에 올린다', async () => {
  for (const [name, bytes, ext] of [['site.png', PNG, 'png'], ['site.JPG', JPG, 'jpg'], ['site.jpeg', JPG, 'jpg'], ['조감도.webp', WEBP, 'webp']]) {
    const d = decodeUploadImage(name, b64(bytes));
    assert.equal(d.ok, true, name);
    const c = fakeClient();
    const up = await uploadMcpImage({ client: c, bytes: d.bytes, kind: d.kind, safeName: d.safeName, now: () => 5 });
    assert.equal(up.ok, true);
    assert.match(up.path, new RegExp(`^mcp-uploads/5_[0-9a-f]{8}_(site|img)\\.${ext}$`));
    assert.equal(c.uploaded[0].contentType, { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext]);
  }
});

test('upload_image: data URL 접두사·줄바꿈이 섞여도 받는다', () => {
  const body = b64(PNG).replace(/(.{20})/g, '$1\n');
  assert.equal(decodeUploadImage('a.png', `data:image/png;base64,${body}`).ok, true);
});

test('upload_image 거절: 확장자 없음·SVG/GIF/HTML·이름과 내용 불일치·깨진 base64·빈 값', () => {
  const no = (name, b, re) => { const d = decodeUploadImage(name, b); assert.equal(d.ok, false, name); assert.match(d.error, re, name); };
  no('site', b64(PNG), /\.png/);
  no('site.svg', b64(SVG), /\.png/);
  no('site.gif', b64(GIF), /\.png/);
  no('site.png', b64(SVG), /그림 파일이 아닙니다/);       // 확장자만 png
  no('site.png', b64(HTML), /그림 파일이 아닙니다/);
  no('site.png', b64(GIF), /그림 파일이 아닙니다/);
  no('site.jpg', b64(PNG), /내용은 png/);                   // 이름은 jpg, 내용은 png
  no('site.png', '!!!not base64!!!', /base64 형식/);
  no('site.png', 'abcde', /base64 형식/);                   // 길이 % 4 == 1
  no('site.png', '', /비었/);
  no('site.png', 'data:image/png;base64,', /비었/);
});

test('upload_image 거절: 6MB 초과(디코딩 후)와 base64 상한 초과', () => {
  const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  big.set(PNG);
  const d = decodeUploadImage('big.png', b64(big));
  assert.equal(d.ok, false);
  assert.match(d.error, /너무 큽니다/);
  // 경계: 정확히 6MB 는 통과
  const edge = new Uint8Array(MAX_UPLOAD_BYTES);
  edge.set(PNG);
  assert.equal(decodeUploadImage('edge.png', b64(edge)).ok, true);
  // 디코딩도 하기 전에 거른다
  const huge = decodeUploadImage('huge.png', 'A'.repeat(MAX_BASE64_CHARS + 100));
  assert.equal(huge.ok, false);
  assert.match(huge.error, /너무 큽니다/);
});

// ── 5. search_images 결과 모양 ───────────────────────────────────────────────
test('Pexels 결과 → [{url,thumb,width,height,credit}], credit 형식 "Photo by 이름 on Pexels"', () => {
  const json = {
    photos: [
      { photographer: 'Jane Kim', width: 4000, height: 6000, src: { large2x: 'https://images.pexels.com/photos/1/l2x.jpeg', large: 'https://images.pexels.com/photos/1/l.jpeg', medium: 'https://images.pexels.com/photos/1/m.jpeg' } },
      { photographer: '', width: 1, height: 2, src: { large: 'https://images.pexels.com/photos/2/l.jpeg' } },     // large2x 없음 → large, 이름 없음
      { photographer: 'Evil', width: 1, height: 1, src: { large2x: 'https://evil.example.com/x.jpg' } },         // 허용 출처 밖 → 뺀다
      { photographer: 'NoSrc' },                                                                               // 주소 없음 → 뺀다
    ],
  };
  const out = mapPexelsPhotos(json);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    url: 'https://images.pexels.com/photos/1/l2x.jpeg',
    thumb: 'https://images.pexels.com/photos/1/m.jpeg',
    width: 4000, height: 6000,
    credit: 'Photo by Jane Kim on Pexels',
  });
  assert.equal(out[1].credit, 'Photo by Unknown on Pexels');
  assert.equal(out[1].thumb, out[1].url);
  assert.deepEqual(mapPexelsPhotos({}), []);
  // 돌려준 url 은 전부 save_cardnews_exact 가 받는 주소다
  for (const p of out) assert.equal(checkPhotoUrl(p.url, SB), null);
});

test('Unsplash 결과 → 같은 모양, credit "Photo by 이름 on Unsplash"', () => {
  const json = { results: [{ width: 3000, height: 4000, urls: { regular: 'https://images.unsplash.com/photo-1?w=1080', small: 'https://images.unsplash.com/photo-1?w=400' }, user: { name: 'Lee' } }, { urls: { regular: 'https://cdn.evil.com/x.jpg' } }] };
  const out = mapUnsplashPhotos(json);
  assert.deepEqual(out, [{ url: 'https://images.unsplash.com/photo-1?w=1080', thumb: 'https://images.unsplash.com/photo-1?w=400', width: 3000, height: 4000, credit: 'Photo by Lee on Unsplash' }]);
  assert.equal(checkPhotoUrl(out[0].url, SB), null);
});
