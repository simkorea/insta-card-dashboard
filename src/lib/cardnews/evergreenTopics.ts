// 언제 올려도 되는 부동산 주제.
//
// 왜 필요한가: 지금 우리 콘텐츠는 전부 뉴스다. 아침 크론도 뉴스, 대시보드
// '오늘의 소재'도 오늘 기사. 그런데 뉴스는 상한다 — 8/12 기사를 8/20에
// 올릴 이유가 없다. 만든 81개 중 4개만 발행된 채 37개가 쌓인 게 그래서다.
// 밀린 것을 예약으로 줄 세워도 뉴스는 기다리는 동안 낡는다.
//
// 이 주제들은 안 낡는다. 아무 날에나 올려도 되고, 저장·공유로 남는다.
//
// 왜 AI로 뽑지 않는가: ① 지금 Gemini 월 한도가 차 있어서 AI에 기대면
// 기능이 그냥 죽는다 ② 매번 다른 말을 지어내면 계정 톤이 흔들린다
// ③ 부동산은 틀린 정보가 곧 손해라, 주제만큼은 사람이 고른 목록이 낫다.
// 고르는 것만 날짜로 돌린다.

export type EvergreenTopic = {
  axis: string;      // 분류 (화면에 묶어 보여준다)
  title: string;     // 그대로 카드뉴스 주제로 넘어간다
};

const POOL: EvergreenTopic[] = [
  // 청약·분양 — 이 계정의 본업
  { axis: '청약·분양', title: '청약 넣기 전에 확인할 7가지' },
  { axis: '청약·분양', title: '특별공급, 나는 어디에 해당될까' },
  { axis: '청약·분양', title: '분양가상한제 단지가 싼 이유와 조건' },
  { axis: '청약·분양', title: '청약 가점 계산에서 자주 틀리는 부분' },
  { axis: '청약·분양', title: '모델하우스에서 꼭 물어봐야 할 질문' },
  { axis: '청약·분양', title: '분양권 전매, 언제부터 되나' },

  // 임장 — 저장이 많이 되는 유형
  { axis: '임장', title: '아파트 임장 체크리스트 10가지' },
  { axis: '임장', title: '낮에 보면 안 보이는 것, 밤에 가서 볼 것' },
  { axis: '임장', title: '같은 단지인데 동·층마다 값이 다른 이유' },
  { axis: '임장', title: '역세권이라는 말에 속지 않는 법' },
  { axis: '임장', title: '학군 볼 때 실제로 확인해야 하는 것' },

  // 계약 — 사고 예방, 공유가 많이 된다
  { axis: '계약', title: '전세계약 전 위험 신호 5가지' },
  { axis: '계약', title: '등기부등본에서 이것만은 꼭 보세요' },
  { axis: '계약', title: '계약금 넣기 전 마지막 점검' },
  { axis: '계약', title: '확정일자·전입신고, 왜 같은 날 해야 하나' },
  { axis: '계약', title: '가계약금 돌려받을 수 있는 경우' },

  // 돈 — 실수요자가 가장 많이 찾는 축
  { axis: '자금', title: '첫 집 살 때 빠뜨리는 부대비용' },
  { axis: '자금', title: '취득세, 얼마나 나오는지 한눈에' },
  { axis: '자금', title: 'LTV·DSR, 내 한도는 어떻게 정해지나' },
  { axis: '자금', title: '중도금 대출과 잔금 대출의 차이' },
  { axis: '자금', title: '보금자리론·디딤돌, 누가 받을 수 있나' },

  // 세금 — 검색이 꾸준하다
  { axis: '세금', title: '1주택 비과세, 놓치기 쉬운 조건' },
  { axis: '세금', title: '양도세 계산에서 자주 하는 착각' },
  { axis: '세금', title: '보유세 줄이는 합법적인 방법' },
  { axis: '세금', title: '증여와 상속, 무엇이 유리한가' },

  // 입주·거주 — 발행 후 문의로 이어진다
  { axis: '입주', title: '입주 전 사전점검에서 볼 것' },
  { axis: '입주', title: '하자보수 신청, 기한을 넘기지 마세요' },
  { axis: '입주', title: '입주장에 전세가 싸지는 이유' },
  { axis: '재개발', title: '재건축·재개발 단계별로 무슨 일이 일어나나' },
  { axis: '재개발', title: '조합원 입주권과 분양권의 차이' },
];

/**
 * 오늘 보여줄 주제를 고른다.
 *
 * 날짜로 시작점을 돌려 매일 다른 묶음이 보이게 한다. 무작위가 아니라
 * 날짜 기반이라, 같은 날 새로고침해도 목록이 바뀌지 않는다 — 눌러보려던
 * 주제가 사라지면 성가시다.
 *
 * 분류를 번갈아 가며 뽑는다. 예전에는 목록에서 연달아 6개를 잘라 왔는데,
 * 목록이 분류끼리 붙어 있어서 어떤 날은 6개 중 5개가 '계약'이었다.
 * 골라 쓰라고 늘어놓은 자리인데 다 같은 종류면 고를 게 없다.
 */
export function pickEvergreen(count = 6, seed = new Date()): EvergreenTopic[] {
  const dayIndex = Math.floor(
    Date.UTC(seed.getFullYear(), seed.getMonth(), seed.getDate()) / 86400000
  );

  // 분류별로 묶되, 목록에 나온 순서는 그대로 둔다
  const axes: string[] = [];
  const byAxis = new Map<string, EvergreenTopic[]>();
  for (const t of POOL) {
    if (!byAxis.has(t.axis)) { byAxis.set(t.axis, []); axes.push(t.axis); }
    byAxis.get(t.axis)!.push(t);
  }

  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const out: EvergreenTopic[] = [];
  const want = Math.min(count, POOL.length);

  // 분류를 한 바퀴씩 돌며 하나씩 집는다. 날짜에 따라 시작 분류와
  // 각 분류 안에서의 시작 위치가 같이 밀린다.
  for (let round = 0; out.length < want; round++) {
    let addedThisRound = false;
    for (let a = 0; a < axes.length && out.length < want; a++) {
      const list = byAxis.get(axes[mod(dayIndex + a, axes.length)])!;
      const idx = mod(dayIndex + round, list.length);
      const pick = list[idx];
      if (round < list.length && !out.includes(pick)) {
        out.push(pick);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break; // 더 뽑을 게 없다
  }
  return out;
}

export const EVERGREEN_TOTAL = POOL.length;
