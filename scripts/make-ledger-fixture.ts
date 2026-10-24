// 채권·채무 엑셀 이관 테스트용 픽스처 만들기 (가짜 거래처 — 실제 거래처명 사용 금지)
// 고객사 원본 빈 양식(ledger-template.xlsx)을 열어 서식·병합·수식·H열 메모는 그대로 두고 값만 채운다
// 실행: npx tsx scripts/make-ledger-fixture.ts  → src/modules/management/ledger/__fixtures__/
//
// ledger-sample.xlsx — 정상 파일. 일부러 넣은 경우:
// - A6 코드를 숫자 118 로 저장 → "0000000118" 로 0 채움
// - 7행·27행 빈 행, 28행은 코드 없는 거래처
// - E8 적요 = 날짜 10/15 (당월수금완료 그룹 → 완료일 후보)
// - 66행(연두 배경, 적요 "자동이체") 업체 — 원본 SUM(D67:D79) 범위 밖
// - F열 수식에 계산값(result)을 넣어 원본 총액 비교가 되게 함 (원본 양식은 계산값이 없음)
//
// ledger-sample-issues.xlsx — 미리보기 경고 확인용 (위 파일에서):
// - H31 메모 삭제 → 당월수금예정 그룹(25·26·28행) 미분류
// - F41 계산값 6,000,000 → 외상매입금 총액 불일치 (행 합계 6,180,000)
// - 29행 0원 → 제외, A30 코드만 → 건너뜀
// - E26 적요 = 날짜 10/20 (당월수금예정 그룹 → 완료일로 쓰지 않고 글자 "10/20"으로만)
import ExcelJS from "exceljs";
import path from "node:path";

const DIR = path.join(
  process.cwd(),
  "src/modules/management/ledger/__fixtures__",
);

type Row = [
  row: number,
  code: string | number | null,
  name: string,
  amount: number,
  note?: string,
];

const ROWS: Row[] = [
  // 외상매출금 — 장기미수 (F3:F4, 빨간 글씨)
  [3, "0000000087", "가나상사(가상)", 12_500_000, "작년 하반기 납품분"],
  [4, "0000000093", "나다산업(가상)", 4_400_000, "분할 상환 협의 중"],
  // 외상매출금 — 당월수금완료 (F5:F24)
  [5, "0000000102", "다라엔지니어링(가상)", 3_300_000, "전동밸브 수리"],
  [6, 118, "라마테크(가상)", 1_650_000, "부품 교체"],
  [8, "0000000131", "마바건설(가상)", 2_200_000],
  // 외상매출금 — 당월수금예정 (F25:F37)
  [25, "0000000215", "바사플랜트(가상)", 8_800_000, "액추에이터 4대"],
  [26, "0000000222", "사아워터(가상)", 5_500_000],
  [28, null, "아자에너지(가상)", 990_000, "코드 미등록"],
  // 외상매입금 (F41:F49)
  [41, null, "자차금속(가상)", 4_200_000, "알루미늄 하우징"],
  [42, null, "차카전기(가상)", 1_320_000, "모터 부품"],
  [43, null, "카타상사(가상)", 660_000, "포장재"],
  // 미지급비용-직원 (F53:F62)
  [53, null, "홍길동(가상)", 350_000, "출장 교통비"],
  [54, null, "김철수(가상)", 120_000, "회식비 선결제"],
  // 미지급비용-업체 — 66행 = 자동이체(연두, E66:F66 병합 "자동이체"는 원본 그대로)
  [66, null, "타파통신(가상)", 165_000],
  [67, null, "파하광고(가상)", 2_200_000, "온라인 광고"],
  [68, null, "하가식당(가상)", 380_000, "거래처 접대"],
];

/** F열 병합 범위의 첫 칸 → SUM 범위 (원본 수식 그대로) */
const TOTALS: [cell: string, from: number, to: number][] = [
  ["F5", 5, 24],
  ["F25", 25, 37],
  ["F41", 41, 49],
  ["F53", 53, 62],
  ["F67", 67, 79],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DIR, "ledger-template.xlsx"));
  const ws = wb.worksheets[0];

  for (const [r, code, name, amount, note] of ROWS) {
    if (code !== null) ws.getCell(`A${r}`).value = code;
    ws.getCell(`C${r}`).value = name;
    ws.getCell(`D${r}`).value = amount;
    // 66행 적요(E66:F66 병합 "자동이체")는 원본 그대로 둔다
    if (note !== undefined && r !== 66) ws.getCell(`E${r}`).value = note;
  }

  for (const [cell, from, to] of TOTALS) {
    const result = ROWS.filter(([r]) => r >= from && r <= to).reduce(
      (sum, [, , , amount]) => sum + amount,
      0,
    );
    ws.getCell(cell).value = { formula: `SUM(D${from}:D${to})`, result };
  }

  // 수금완료 그룹 적요에 날짜 (원본 E5:E13 은 날짜 서식 m/d)
  ws.getCell("E8").value = new Date(Date.UTC(2026, 9, 15));

  await save(wb, "ledger-sample.xlsx");

  // 경고 확인용
  ws.getCell("H31").value = null;
  ws.getCell("F41").value = { formula: "SUM(D41:D49)", result: 6_000_000 };
  ws.getCell("C29").value = "차파상사(가상)";
  ws.getCell("D29").value = 0;
  ws.getCell("A30").value = "0000000300";
  const e26 = ws.getCell("E26");
  e26.value = new Date(Date.UTC(2026, 9, 20));
  e26.numFmt = 'm"/"d;@';
  await save(wb, "ledger-sample-issues.xlsx");
}

async function save(wb: ExcelJS.Workbook, name: string) {
  const out = path.join(DIR, name);
  await wb.xlsx.writeFile(out);
  console.log(`만들었습니다: ${path.relative(process.cwd(), out)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
