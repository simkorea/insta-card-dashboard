// 하이브리드 카드(=CSS로 조판 + AI 자산)용 정적 자산을 만든다.
//
// 왜 스크립트인가: 이 그림들은 카드마다 새로 그릴 필요가 없다. 한 번 뽑아
//   public/ 에 두고 계속 재사용한다. 카드 한 장당 AI 호출이 0회가 되는 것이
//   하이브리드 방식의 핵심이다.
//
// 왜 '진한 파란 볼펜 · 순백 배경'인가: 카드에서 mix-blend-mode:multiply 로
//   얹기 때문에 배경이 완전한 흰색이어야 종이에 그린 것처럼 스민다.
//   기존 sketch-apt.png 는 배경이 미색이라 선까지 같이 옅어졌다.
//
// 사용법:
//   node scripts/gen-notebook-assets.mjs            # 없는 것만 생성
//   node scripts/gen-notebook-assets.mjs --force    # 전부 다시 생성
//   node scripts/gen-notebook-assets.mjs pen:key    # 이름으로 골라서

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'notebook-assets');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-3-pro-image', 'gemini-3-pro-image-preview'];
const CONCURRENCY = 3;

// .env.local 에서 키를 읽는다 (Next 밖에서 도는 스크립트라 자동 주입이 없다)
function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const m = env.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
  if (!m) throw new Error('.env.local 에 GEMINI_API_KEY 가 없습니다');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// ── 펜 스케치 ─────────────────────────────────────────────
// 배경이 완전한 흰색이어야 곱하기 합성에서 종이가 그대로 비친다.
const PEN_STYLE = `[그리는 방식]
- 진한 파란색 볼펜 한 자루로만 그린 손그림. 다른 색은 일절 쓰지 않는다
- 선에 필압이 있어 굵기가 조금씩 변하고, 획이 미세하게 흔들린다
- 겹쳐 그은 선과 빗금(해칭)으로만 음영을 표현한다
- 여백이 넉넉한 단순한 선화. 세밀한 묘사는 하지 않는다

[배경 — 가장 중요]
- 배경은 티끌 하나 없는 **완전한 순백(#FFFFFF)**
- 종이 질감, 줄, 격자, 그림자, 테두리, 워터마크를 절대 넣지 말 것
- 그림 하나만 화면 가운데에. 주변에 다른 물체를 그리지 말 것

[글자 금지 — 어기면 못 쓰는 그림이 된다]
- 어떤 언어의 글자도 그리지 말 것. 한글·영문·한자·숫자 전부 해당한다
- 제목, 표제, 라벨, 상호, 도장 안의 글씨, 버튼 위 기호까지 모두 안 된다
- 서류나 간판처럼 원래 글자가 있는 물건을 그릴 때는, 글자 자리에
  **읽을 수 없는 구불구불한 물결선**만 그어 글이 있는 것처럼 보이게 한다`;

const SKETCHES = [
  // 건물
  ['apt-tower', '고층 아파트 타워 한 동. 창문이 격자로 반복되고 옥상에 물탱크가 보인다'],
  ['apt-slab', '판상형 아파트 한 동을 비스듬히 본 모습. 베란다가 층층이 쌓여 있다'],
  ['apt-cluster', '아파트 단지. 높이가 다른 동 서너 채가 나란히 서 있고 사이에 나무가 있다'],
  ['apt-tree', '아파트 한 동과 그 앞의 큰 가로수 한 그루'],
  ['house-small', '작은 단독주택 한 채. 박공지붕과 굴뚝, 창문 두 개'],
  ['building-site', '공사 중인 건물과 타워크레인 한 대'],
  // 돈
  ['money-stack', '지폐 다발 한 뭉치. 띠지로 묶여 있다'],
  ['coins', '동전을 세 무더기로 높이 다르게 쌓아 놓은 모습'],
  ['piggy-bank', '돼지 저금통과 그 위에 넣으려는 동전 한 닢'],
  ['wallet', '반으로 접는 지갑에서 지폐가 삐져나온 모습'],
  ['calculator', '숫자 버튼이 있는 탁상용 계산기'],
  ['stamp', '한국식 원통형 인감도장과 붉은 인주함'],
  // 서류
  ['contract', '한 장짜리 서류. 본문 자리는 글자가 아니라 자와 대고 그은 듯한 **곧고 평평한 가로 직선 여덟 줄**이며, 줄마다 길이가 조금씩 다르다. 아래쪽에 서명 자리의 휘갈긴 곡선 하나와 글씨 없는 빈 동그라미 도장이 있다. 제목 글자, 알파벳, lorem ipsum 같은 흉내 글씨를 단 하나도 그리지 말 것 — 글자처럼 보이는 작은 곡선 무리도 안 된다'],
  ['documents', '서류 여러 장을 클립으로 묶은 뭉치'],
  ['folder', '서류가 꽂힌 파일 폴더'],
  ['clipboard', '체크 표시가 있는 클립보드'],
  // 열쇠·이사
  ['key', '열쇠고리에 달린 집 모양 키홀더와 열쇠 한 개'],
  ['keyring', '열쇠 여러 개가 달린 열쇠 꾸러미'],
  ['moving-box', '테이프로 봉한 이사용 종이 상자 두 개를 쌓아 놓은 모습'],
  ['sofa', '쿠션이 놓인 3인용 소파'],
  // 그래프
  ['chart-up', '오른쪽 위로 올라가는 꺾은선 그래프와 화살표'],
  ['chart-down', '오른쪽 아래로 내려가는 꺾은선 그래프와 화살표'],
  ['chart-bar', '높이가 제각각인 막대 그래프 다섯 개'],
  // 사람
  ['handshake', '두 사람이 악수하는 손'],
  ['person-think', '턱에 손을 대고 생각하는 사람의 상반신'],
  ['family', '어른 두 명과 아이 한 명이 나란히 서 있는 단순한 뒷모습'],
  // 생활·기타
  ['calendar', '날짜 칸이 있는 벽걸이 달력. 한 칸에 동그라미가 쳐져 있다'],
  ['magnifier', '손잡이가 있는 돋보기'],
  ['map-pin', '지도 위에 꽂힌 위치 핀 하나'],
  ['subway', '지하철 전동차 앞머리'],
  ['school', '운동장과 국기 게양대가 있는 학교 건물'],
  ['bench', '나무 공원 벤치와 그 옆의 가로등'],
  ['coffee', '받침 접시 위의 커피잔에서 김이 오르는 모습'],
  ['bulb', '반짝이는 선이 주변에 그려진 전구 하나'],
];

// ── 종이 배경 ─────────────────────────────────────────────
// 카드 전체 바탕. 글이 얹히므로 무늬가 세면 안 된다.
const PAPERS = [
  ['paper-spring', `실제 스프링 노트를 위에서 곧게 내려다보고 찍은 사진. 비율 4:5 세로.
- 크림색 줄노트 한 면. 옅은 하늘색 가로 줄이 일정한 간격으로 그어져 있다
- 왼쪽 가장자리를 따라 검은 금속 스프링 제본 링이 사실적으로 보인다
- 종이 결과 아주 옅은 얼룩, 부드러운 그림자로 실물 느낌
- 글자, 숫자, 그림, 낙서를 절대 넣지 말 것. 완전히 빈 종이여야 한다`],
  ['paper-plain', `실제 크림색 무지 종이를 위에서 곧게 내려다보고 찍은 사진. 비율 4:5 세로.
- 줄이나 격자가 없는 매끈한 미색 종이
- 은은한 종이 결과 가장자리의 아주 옅은 그림자
- 글자, 숫자, 그림, 테두리를 절대 넣지 말 것. 완전히 빈 종이여야 한다`],
  ['paper-grid', `실제 모눈 노트를 위에서 곧게 내려다보고 찍은 사진. 비율 4:5 세로.
- 아주 옅은 회색 모눈이 균일하게 그려진 미색 종이
- 왼쪽에 스프링 자국 없이 깔끔한 낱장
- 종이 결과 부드러운 그림자
- 글자, 숫자, 그림을 절대 넣지 말 것. 완전히 빈 종이여야 한다`],
];

// ── 신문 삽화 컷 ─────────────────────────────────────────
// 노트용 파란 볼펜 그림을 흑백으로 돌려 쓰고 있었는데, 정사각형이라
// 가로로 넓은 컷 상자에서 우표만 하게 보였고 선도 신문 인쇄물처럼
// 굵지 않았다. 신문 전용으로 가로형·검은잉크 판화체를 따로 뽑는다.
const CUT_STYLE = `[그리는 방식]
- 옛 신문 삽화처럼 **검은 잉크 한 가지로만** 그린 판화(engraving). 색을 일절 쓰지 않는다
- 윤곽선은 굵고 단단하게, 음영은 평행 빗금(해칭)과 점묘로만
- 인쇄물처럼 대비가 뚜렷할 것. 회색 톤으로 뭉개지 말 것
- 화면 가로폭을 좌우로 꽉 채우는 구도. 가운데만 작게 그리지 말 것

[배경 — 가장 중요]
- 배경은 티끌 하나 없는 **완전한 순백(#FFFFFF)**
- 종이 질감, 그림자, 테두리, 액자, 워터마크를 절대 넣지 말 것
- 글자·숫자·기호·간판을 절대 넣지 말 것
- 사진처럼 사실적으로 그리지 말 것. 실제 존재하는 특정 건물로 보이면 안 된다`;

const CUTS = [
  ['apt-skyline', '한국식 아파트 단지 전경. 높이가 다른 동 네다섯 채가 가로로 늘어서 있고 앞쪽에 나무와 낮은 담장'],
  ['apt-single', '한국식 아파트 한 동을 비스듬히 올려다본 모습. 베란다가 층층이 반복되고 옆에 나무 몇 그루'],
  ['construction', '공사 중인 건물과 타워크레인 두 대. 비계가 둘러쳐져 있다'],
  ['money', '지폐 다발과 흩어진 동전 몇 닢이 나란히 놓인 모습'],
  ['calculator-doc', '탁상용 계산기와 그 옆에 펼쳐진 서류 몇 장'],
  ['document', '책상 위에 반듯하게 놓인 평평한 A4 계약 서식 한 장. 위쪽에 빈 제목 칸, 아래에 표 칸과 서명용 밑줄이 그어져 있고 **칸 안은 전부 비어 있다**. 그 옆에 한국식 원통형 인감도장과 붉은 인주함. 두루마리·양피지·깃펜은 절대 그리지 말 것. 글자·문자·숫자를 단 하나도 그리지 말 것 — 칸과 줄만 그린다'],
  ['key-home', '집 모양 키홀더가 달린 열쇠 한 벌이 놓여 있는 모습'],
  ['moving', '테이프로 봉한 이사용 종이 상자 세 개와 그 옆의 의자 하나'],
  ['chart-up', '오른쪽 위로 올라가는 꺾은선 그래프. 축과 눈금이 있고 화살표가 위를 향한다'],
  ['chart-down', '오른쪽 아래로 내려가는 꺾은선 그래프. 축과 눈금이 있고 화살표가 아래를 향한다'],
  ['chart-bar', '높이가 제각각인 막대 그래프 예닐곱 개와 가로축'],
  ['handshake', '두 사람이 악수하는 손과 소매. 가로로 넓게'],
  ['family', '어른 두 명과 아이 한 명이 나란히 서서 건물을 올려다보는 뒷모습'],
  ['city-transit', '한국 도시 전경. 뒤로 아파트와 오피스 건물이 늘어서 있고, 앞쪽 지상 선로를 전동차 한 대가 지나가며 그 옆으로 왕복 도로와 가로수가 있다. 서양식 벽돌 건물, 외벽 비상계단, 고가 철교는 절대 그리지 말 것'],
  ['magnifier-doc', '펼쳐진 서류 위를 큰 돋보기로 들여다보는 모습'],
];

// ── 노트 하단 띠그림 ──────────────────────────────────────
// AI가 통째로 그리던 카드(7/31~8/4)는 지면 아래를 가로로 꽉 채우는 풍경으로
// 마무리한다. 그게 카드의 인상을 크게 좌우했는데, 정사각형 펜 그림을 왼쪽
// 구석에 작게 놓으니 허전해졌다. 하단 전용으로 아주 납작한 그림을 따로 뽑는다.
const BAND_STYLE = `[그리는 방식]
- 진한 파란색 볼펜 한 자루로만 그린 손그림. 다른 색은 일절 쓰지 않는다
- 선이 가늘고 담백하다. 빽빽하게 칠하지 말 것 — 아래에 깔리는 배경 그림이라
  본문 글씨보다 눈에 띄면 안 된다
- 음영은 최소한으로. 넓은 면을 까맣게 채우지 말 것
- **화면 좌우 끝까지 이어지는 가로 풍경**. 가운데만 작게 그리지 말 것
- 아래쪽은 바닥선에 맞춰 가지런히, 위쪽은 하늘이 비도록 여백을 남긴다

[배경 — 가장 중요]
- 배경은 티끌 하나 없는 **완전한 순백(#FFFFFF)**
- 종이 질감, 줄, 격자, 그림자, 테두리, 워터마크를 절대 넣지 말 것
- 어떤 언어의 글자도 그리지 말 것. 간판·표지판의 글씨까지 전부 안 된다`;

const BANDS = [
  ['city', '도시 풍경. 높이가 제각각인 건물과 아파트가 좌우로 길게 늘어서 있고, 사이사이에 가로수와 작은 구름 몇 점'],
  ['apt-row', '한국식 아파트 단지 전경. 판상형 동 예닐곱 채가 좌우로 늘어서 있고 앞쪽에 나무와 낮은 울타리'],
  ['house-street', '낮은 단독주택과 상가가 늘어선 동네 골목. 가로등과 나무 몇 그루'],
  ['construction', '공사 중인 건물들과 타워크레인 두 대가 좌우로 늘어선 현장. 비계와 가림막'],
  ['park', '아파트 단지 앞 공원. 벤치와 산책로, 나무들이 좌우로 이어지고 뒤로 건물 실루엣'],
  ['transit', '도시 풍경 앞으로 왕복 도로와 가로수가 지나가고 버스와 승용차 몇 대. 뒤로 아파트와 오피스 건물'],
];

const JOBS = [
  ...BANDS.map(([name, subject]) => ({
    name: `band:${name}`,
    file: join(OUT, 'band', `${name}.png`),
    prompt: `흰 종이에 파란 볼펜으로 그린 손그림. 아주 납작한 가로 21:9 비율.

[무엇을 그리나]
${subject}

${BAND_STYLE}`,
  })),
  ...SKETCHES.map(([name, subject]) => ({
    name: `pen:${name}`,
    file: join(OUT, 'pen', `${name}.png`),
    prompt: `흰 종이에 파란 볼펜으로 그린 손그림 한 장. 정사각형.\n\n[무엇을 그리나]\n${subject}\n\n${PEN_STYLE}`,
  })),
  ...PAPERS.map(([name, prompt]) => ({
    name: `paper:${name}`,
    file: join(OUT, 'paper', `${name}.png`),
    prompt,
  })),
  ...CUTS.map(([name, subject]) => ({
    name: `cut:${name}`,
    file: join(OUT, 'cut', `${name}.png`),
    prompt: `흰 바탕에 검은 잉크로 그린 신문 삽화 한 컷. 가로로 넓은 16:9 비율.

[무엇을 그리나]
${subject}

${CUT_STYLE}`,
  })),
];

// 모델이 주는 원본은 1024px 이상인데 카드에서는 200~380px로 그려진다.
// 그대로 두면 자산만 20MB가 넘어 카드를 여러 장 여는 화면이 무거워진다.
// 선화라 팔레트로 줄여도 선이 뭉개지지 않는다 (실측 76~88% 감소).
const MAX_W = { pen: 720, cut: 960, paper: 900, band: 1080 };

async function shrink(buf, kind) {
  try {
    return await sharp(buf)
      .resize({ width: MAX_W[kind] || 900, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, colors: kind === 'paper' ? 128 : 64 })
      .toBuffer();
  } catch {
    return buf;   // 압축이 실패해도 원본은 남긴다
  }
}

async function generate(key, prompt) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const b64 = parts.find((p) => p.inlineData)?.inlineData?.data;
      if (b64) return b64;
      lastErr = new Error('이미지가 비어서 왔습니다');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));

  const key = apiKey();
  mkdirSync(join(OUT, 'pen'), { recursive: true });
  mkdirSync(join(OUT, 'paper'), { recursive: true });
  mkdirSync(join(OUT, 'cut'), { recursive: true });

  let jobs = JOBS;
  if (only.length) jobs = jobs.filter((j) => only.some((o) => j.name.includes(o)));
  if (!force) jobs = jobs.filter((j) => !existsSync(j.file));

  if (!jobs.length) {
    console.log('생성할 것이 없습니다. 다시 뽑으려면 --force');
    return;
  }
  console.log(`${jobs.length}장 생성 (동시 ${CONCURRENCY})\n`);

  let done = 0;
  const failed = [];
  const queue = [...jobs];

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const b64 = await generate(key, job.prompt);
          const small = await shrink(Buffer.from(b64, 'base64'), job.name.split(':')[0]);
          writeFileSync(job.file, small);
          console.log(`  [${++done}/${jobs.length}] ${job.name}`);
        } catch (e) {
          failed.push(job.name);
          console.log(`  [${++done}/${jobs.length}] ${job.name} — 실패: ${e.message}`);
        }
      }
    })
  );

  console.log(`\n완료 ${jobs.length - failed.length}장 / 실패 ${failed.length}장`);
  if (failed.length) console.log(`실패: ${failed.join(', ')}\n다시: node scripts/gen-notebook-assets.mjs ${failed.join(' ')}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
