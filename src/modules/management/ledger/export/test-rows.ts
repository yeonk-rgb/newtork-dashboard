// 다운로드 테스트용 행 (*.test.ts 에서만 import) — 2단계 픽스처(ledger-sample.xlsx)와 같은 가짜 거래처 16행
import type { LedgerRow } from "../rules";

let seq = 0;
export function row(patch: Partial<LedgerRow>): LedgerRow {
  seq += 1;
  return {
    id: `r${seq}`,
    kind: "AR",
    arStatus: null,
    purchaseType: null,
    expenseType: null,
    autoTransfer: false,
    partnerCode: null,
    partnerName: "거래처",
    amount: "0",
    note: null,
    dueOn: null,
    settledOn: null,
    updatedAt: "2026-10-25T00:00:00.000Z",
    updatedBy: "윤경영",
    fromUpload: false,
    hidden: false,
    deletedAt: null,
    deletedBy: null,
    ...patch,
  };
}

export const SAMPLE_ROWS: LedgerRow[] = [
  row({
    arStatus: "SCHEDULED",
    partnerCode: "0000000215",
    partnerName: "바사플랜트(가상)",
    amount: "8800000",
    note: "액추에이터 4대",
    dueOn: "2026-10-31",
  }),
  row({
    arStatus: "LONG_OVERDUE",
    partnerCode: "0000000087",
    partnerName: "가나상사(가상)",
    amount: "12500000",
    note: "작년 하반기 납품분",
  }),
  row({
    arStatus: "LONG_OVERDUE",
    partnerCode: "0000000093",
    partnerName: "나다산업(가상)",
    amount: "4400000",
    note: "분할 상환 협의 중",
  }),
  row({
    arStatus: "COLLECTED",
    partnerCode: "0000000102",
    partnerName: "다라엔지니어링(가상)",
    amount: "3300000",
    note: "전동밸브 수리",
    settledOn: "2026-10-25",
  }),
  row({
    arStatus: "COLLECTED",
    partnerCode: "0000000118",
    partnerName: "라마테크(가상)",
    amount: "1650000",
    note: "부품 교체",
    settledOn: "2026-10-25",
  }),
  row({
    arStatus: "COLLECTED",
    partnerCode: "0000000131",
    partnerName: "마바건설(가상)",
    amount: "2200000",
    note: "10/15",
    settledOn: "2026-10-15",
  }),
  row({
    arStatus: "SCHEDULED",
    partnerCode: "0000000222",
    partnerName: "사아워터(가상)",
    amount: "5500000",
  }),
  row({
    arStatus: "SCHEDULED",
    partnerName: "아자에너지(가상)",
    amount: "990000",
    note: "코드 미등록",
  }),
  row({
    kind: "AP",
    purchaseType: "RAW_MATERIAL",
    partnerName: "자차금속(가상)",
    amount: "4200000",
    note: "알루미늄 하우징",
  }),
  row({
    kind: "AP",
    purchaseType: "GOODS",
    partnerName: "차카전기(가상)",
    amount: "1320000",
    note: "모터 부품",
  }),
  row({
    kind: "AP",
    purchaseType: "GOODS",
    partnerName: "카타상사(가상)",
    amount: "660000",
    note: "포장재",
  }),
  row({
    kind: "ACCRUED_STAFF",
    partnerName: "홍길동(가상)",
    amount: "350000",
    note: "출장 교통비",
  }),
  row({
    kind: "ACCRUED_STAFF",
    partnerName: "김철수(가상)",
    amount: "120000",
    note: "회식비 선결제",
  }),
  row({
    kind: "ACCRUED_VENDOR",
    expenseType: "ADVERTISING",
    partnerName: "파하광고(가상)",
    amount: "2200000",
    note: "온라인 광고",
  }),
  // 자동이체 적요가 "10/15" 처럼 날짜 모양이어도 글자로 남아야 함 (원본 E66 은 날짜 서식 m/d)
  row({
    kind: "ACCRUED_VENDOR",
    expenseType: "OTHER",
    autoTransfer: true,
    partnerName: "타파통신(가상)",
    amount: "165000",
    note: "10/15",
  }),
  row({
    kind: "ACCRUED_VENDOR",
    expenseType: "ENTERTAINMENT",
    partnerName: "하가식당(가상)",
    amount: "380000",
    note: "거래처 접대",
  }),
];
