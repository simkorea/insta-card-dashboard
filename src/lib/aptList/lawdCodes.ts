// 국토부 실거래가 API는 법정동 코드 앞 5자리(시군구 코드)로 조회한다.
// 사용자가 "안양시 만안구"처럼 이름으로 고를 수 있도록 시군구 목록을 담아둔다.
//
// 전국을 다 넣으면 파일이 너무 커져서, 이 계정이 다루는 수도권을 먼저 담았다.
// 다른 지역이 필요해지면 여기에 추가하면 된다 (행정표준코드관리시스템 code.go.kr).

export type Sigungu = { code: string; sido: string; name: string };

export const SIGUNGU: Sigungu[] = [
  // 서울特別市
  { code: '11110', sido: '서울', name: '종로구' },
  { code: '11140', sido: '서울', name: '중구' },
  { code: '11170', sido: '서울', name: '용산구' },
  { code: '11200', sido: '서울', name: '성동구' },
  { code: '11215', sido: '서울', name: '광진구' },
  { code: '11230', sido: '서울', name: '동대문구' },
  { code: '11260', sido: '서울', name: '중랑구' },
  { code: '11290', sido: '서울', name: '성북구' },
  { code: '11305', sido: '서울', name: '강북구' },
  { code: '11320', sido: '서울', name: '도봉구' },
  { code: '11350', sido: '서울', name: '노원구' },
  { code: '11380', sido: '서울', name: '은평구' },
  { code: '11410', sido: '서울', name: '서대문구' },
  { code: '11440', sido: '서울', name: '마포구' },
  { code: '11470', sido: '서울', name: '양천구' },
  { code: '11500', sido: '서울', name: '강서구' },
  { code: '11530', sido: '서울', name: '구로구' },
  { code: '11545', sido: '서울', name: '금천구' },
  { code: '11560', sido: '서울', name: '영등포구' },
  { code: '11590', sido: '서울', name: '동작구' },
  { code: '11620', sido: '서울', name: '관악구' },
  { code: '11650', sido: '서울', name: '서초구' },
  { code: '11680', sido: '서울', name: '강남구' },
  { code: '11710', sido: '서울', name: '송파구' },
  { code: '11740', sido: '서울', name: '강동구' },

  // 경기도
  { code: '41111', sido: '경기', name: '수원시 장안구' },
  { code: '41113', sido: '경기', name: '수원시 권선구' },
  { code: '41115', sido: '경기', name: '수원시 팔달구' },
  { code: '41117', sido: '경기', name: '수원시 영통구' },
  { code: '41131', sido: '경기', name: '성남시 수정구' },
  { code: '41133', sido: '경기', name: '성남시 중원구' },
  { code: '41135', sido: '경기', name: '성남시 분당구' },
  { code: '41150', sido: '경기', name: '의정부시' },
  { code: '41171', sido: '경기', name: '안양시 만안구' },
  { code: '41173', sido: '경기', name: '안양시 동안구' },
  { code: '41190', sido: '경기', name: '부천시' },
  { code: '41210', sido: '경기', name: '광명시' },
  { code: '41220', sido: '경기', name: '평택시' },
  { code: '41250', sido: '경기', name: '동두천시' },
  { code: '41271', sido: '경기', name: '안산시 상록구' },
  { code: '41273', sido: '경기', name: '안산시 단원구' },
  { code: '41281', sido: '경기', name: '고양시 덕양구' },
  { code: '41285', sido: '경기', name: '고양시 일산동구' },
  { code: '41287', sido: '경기', name: '고양시 일산서구' },
  { code: '41290', sido: '경기', name: '과천시' },
  { code: '41310', sido: '경기', name: '구리시' },
  { code: '41360', sido: '경기', name: '남양주시' },
  { code: '41370', sido: '경기', name: '오산시' },
  { code: '41390', sido: '경기', name: '시흥시' },
  { code: '41410', sido: '경기', name: '군포시' },
  { code: '41430', sido: '경기', name: '의왕시' },
  { code: '41450', sido: '경기', name: '하남시' },
  { code: '41461', sido: '경기', name: '용인시 처인구' },
  { code: '41463', sido: '경기', name: '용인시 기흥구' },
  { code: '41465', sido: '경기', name: '용인시 수지구' },
  { code: '41480', sido: '경기', name: '파주시' },
  { code: '41500', sido: '경기', name: '이천시' },
  { code: '41550', sido: '경기', name: '안성시' },
  { code: '41570', sido: '경기', name: '김포시' },
  { code: '41590', sido: '경기', name: '화성시' },
  { code: '41610', sido: '경기', name: '광주시' },
  { code: '41630', sido: '경기', name: '양주시' },
  { code: '41650', sido: '경기', name: '포천시' },
  { code: '41670', sido: '경기', name: '여주시' },

  // 인천
  { code: '28110', sido: '인천', name: '중구' },
  { code: '28140', sido: '인천', name: '동구' },
  { code: '28177', sido: '인천', name: '미추홀구' },
  { code: '28185', sido: '인천', name: '연수구' },
  { code: '28200', sido: '인천', name: '남동구' },
  { code: '28237', sido: '인천', name: '부평구' },
  { code: '28245', sido: '인천', name: '계양구' },
  { code: '28260', sido: '인천', name: '서구' },
];

export const SIDO_LIST = [...new Set(SIGUNGU.map(s => s.sido))];

export function findSigungu(code: string): Sigungu | undefined {
  return SIGUNGU.find(s => s.code === code);
}

/** "경기 안양시 만안구" 같은 표시용 이름 */
export function sigunguLabel(code: string): string {
  const s = findSigungu(code);
  return s ? `${s.sido} ${s.name}` : code;
}
