// 채권·채무 관리 샘플 6행 넣기·지우기 (가짜 거래처 — 실제 거래처명 사용 금지)
// 실행: npm run seed:ledger              이번 달(한국 날짜)에 넣기 (다시 실행하면 지우고 새로 넣음)
//       npm run seed:ledger -- --remove   샘플만 지우기 (직접 입력한 행은 그대로)
// ⚠️ 고객사 실제 데이터를 넣기 전에는 --remove 로 지운다
import "dotenv/config";

import { todayKst } from "@/modules/management/data/load-summary-input";
import { prisma } from "@/shared/db/client";

/** 샘플 행 표시 — 작성자 id 로 구분해 지운다 */
const SEED_BY = "seed-ledger";

async function main() {
  const removed = await prisma.ledgerEntry.deleteMany({
    where: { createdById: SEED_BY },
  });
  if (process.argv.includes("--remove")) {
    console.log(`채권·채무 샘플 ${removed.count}행을 지웠습니다.`);
    return;
  }

  const today = todayKst(new Date());
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const day = (d: number) => new Date(Date.UTC(year, month - 1, d));
  const lastDay = new Date(Date.UTC(year, month, 0));
  // 수금 완료일은 오늘 이후가 될 수 없다
  const settled = day(Math.min(10, today.getUTCDate()));

  const base = {
    year,
    month,
    createdById: SEED_BY,
    updatedById: SEED_BY,
  };
  await prisma.ledgerEntry.createMany({
    data: [
      {
        ...base,
        kind: "AR",
        arStatus: "LONG_OVERDUE",
        partnerCode: "0000000087",
        partnerName: "가나상사(샘플)",
        amount: 12_500_000n,
        note: "작년 하반기 납품분",
      },
      {
        ...base,
        kind: "AR",
        arStatus: "COLLECTED",
        partnerCode: "0000000102",
        partnerName: "다라엔지니어링(샘플)",
        amount: 3_300_000n,
        note: "전동밸브 수리",
        settledOn: settled,
      },
      {
        ...base,
        kind: "AR",
        arStatus: "SCHEDULED",
        partnerCode: "0000000215",
        partnerName: "마바플랜트(샘플)",
        amount: 8_800_000n,
        note: "액추에이터 4대",
        dueOn: lastDay,
      },
      {
        ...base,
        kind: "AP",
        purchaseType: "RAW_MATERIAL",
        partnerName: "사아금속(샘플)",
        amount: 4_200_000n,
        note: "알루미늄 하우징",
      },
      {
        ...base,
        kind: "ACCRUED_STAFF",
        partnerName: "홍길동(샘플)",
        amount: 350_000n,
        note: "출장 교통비",
      },
      {
        ...base,
        kind: "ACCRUED_VENDOR",
        expenseType: "OTHER",
        autoTransfer: true,
        partnerName: "자차통신(샘플)",
        amount: 165_000n,
        note: "인터넷 요금 자동이체",
      },
    ],
  });
  console.log(
    `${year}년 ${month}월에 채권·채무 샘플 6행을 넣었습니다. → /management/ledger`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
