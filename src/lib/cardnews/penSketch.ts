// 카드 내용에 맞는 펜 스케치를 고른다.
//
// 왜 규칙 기반인가: 스케치는 public/notebook-assets/pen 에 미리 뽑아둔 정적 파일이다.
// 카드마다 AI를 부르면 하이브리드 방식(카드당 AI 호출 0회)의 의미가 사라진다.
// 규칙으로 못 고르면 카드 순번으로 돌려 쓴다 — 같은 세트에서 같은 그림이
// 연달아 나오지 않게 하는 것이 목적이다.

const RULES: [RegExp, string][] = [
  // '준공'은 뺐다 — "2021년 준공"은 단지 스펙이지 공사 소식이 아니다
  [/공사|착공|시공|크레인|분양가상한/, 'building-site'],
  [/타워|고층|초고층|주상복합/, 'apt-tower'],
  [/단지|아파트|입주|세대|분양/, 'apt-cluster'],
  [/주택|빌라|단독/, 'house-small'],
  [/학교|학군|초품아|교육/, 'school'],
  [/지하철|역세권|노선|전철|GTX/i, 'subway'],
  [/공원|녹지|산책|숲세권/, 'bench'],
  [/카페|상권|편의|스세권/, 'coffee'],
  [/대출|금리|이자|전세|보증금|매매가|시세|억|만 원/, 'money-stack'],
  [/저축|자금|목돈|모으/, 'piggy-bank'],
  [/세금|취득세|양도세|계산/, 'calculator'],
  [/도장|인감|승인|허가/, 'stamp'],
  [/계약|청약|신청|접수/, 'contract'],
  [/서류|규제|법|정책|개정/, 'documents'],
  [/자료|정리|목록|리스트/, 'folder'],
  [/점검|체크|확인|주의/, 'clipboard'],
  [/입주권|열쇠|집들이/, 'key'],
  [/이사|이주|전입/, 'moving-box'],
  [/인테리어|가구|리모델링/, 'sofa'],
  [/상승|급등|오르|신고가|반등/, 'chart-up'],
  [/하락|급락|내리|떨어|하향/, 'chart-down'],
  [/비교|추이|통계|거래량/, 'chart-bar'],
  [/거래|매수|매도|계약금/, 'handshake'],
  [/고민|망설|어떻|why|왜/i, 'person-think'],
  [/신혼|가족|아이|육아|맞벌이/, 'family'],
  [/일정|날짜|기간|마감|시점/, 'calendar'],
  [/분석|조사|살펴|따져/, 'magnifier'],
  [/위치|입지|지역|동네|주변/, 'map-pin'],
  [/지갑|자산|여유/, 'wallet'],
  [/정리하면|핵심|포인트|팁|방법/, 'bulb'],
  [/열쇠고리|보유|소유/, 'keyring'],
  [/동전|소액/, 'coins'],
  [/나무|조경/, 'apt-tree'],
  [/판상|남향|채광/, 'apt-slab'],
];

// 규칙에 안 걸릴 때 순번으로 돌려 쓸 그림들 (부동산 카드에 무난한 것만)
const FALLBACK = ['apt-cluster', 'money-stack', 'map-pin', 'contract', 'chart-up', 'key', 'calendar', 'magnifier'];

export function pickPenSketch(text: string, index = 0): string {
  for (const [re, name] of RULES) {
    if (re.test(text)) return name;
  }
  return FALLBACK[Math.abs(index) % FALLBACK.length];
}

export function penSketchUrl(name: string): string {
  return `/notebook-assets/pen/${name}.png`;
}
