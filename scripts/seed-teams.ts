// 생산·서비스팀 시연용 가짜 데이터 넣기·지우기 (실제 기업 데이터 아님 — 거래처·사람 이름 모두 가상)
// 실행: npm run seed:teams              넣기 (다시 실행하면 지우고 새로 넣음, 오늘(한국 날짜)까지만)
//       npm run seed:teams -- --remove   가짜 데이터만 지우기 (직접 입력·업로드한 행은 그대로)
// - 생산: 친구 저장소 seed_production_demo.py 와 같은 규칙 — 시트 "2025(가상)", 일련번호 "V25-0001", 수주번호 "V25001",
//   출고된 행 일부는 수량 미확정, 수주번호 일부는 사업구분 미분류, 목표는 그 해에 목표가 없을 때만
// - 서비스: 월 3~8건 출장보고서, 비용청구 일부 미입력, 제품 수량 일부 미입력
// - 작성자 id 로 구분해 지운다 (PRODUCTION_SAMPLE_BY / SERVICE_SAMPLE_BY) → 메인 "팀별 현황"에 "샘플 데이터" 배지
// ⚠️ 고객사 실제 데이터를 넣기 전에는 --remove 로 지운다
import "dotenv/config";

import { createHash } from "node:crypto";

import { todayKst } from "@/modules/management/data/load-summary-input";
import { PRODUCTION_SAMPLE_BY } from "@/modules/production/data/sample";
import { SERVICE_SAMPLE_BY } from "@/modules/service/data/sample";
import { prisma } from "@/shared/db/client";
import type { ProdIndustry, SvcBilling } from "@/shared/db/generated/client";

const YEARS = [2025, 2026];
const SEED = 20261020;
const FILE_NAME = "가상_제조내역.xlsx";

// 고정 시드 난수 (mulberry32 — prisma/seed.ts 와 같은 방식)
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(SEED);
const int = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(list: readonly T[]) =>
  list[Math.floor(random() * list.length)];
function weighted<T>(list: readonly (readonly [T, number])[]): T {
  const total = list.reduce((n, [, w]) => n + w, 0);
  let r = random() * total;
  for (const [value, w] of list) {
    r -= w;
    if (r < 0) return value;
  }
  return list.at(-1)![0];
}

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);
function workday(date: Date) {
  let d = date;
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, 1);
  return d;
}

// ---------- 생산 ----------

/** 최종발주처(가상) → 사업구분 */
const CLIENTS: Record<string, ProdIndustry> = {
  새솔정수센터: "WATER",
  가람정수장: "WATER",
  아름정수장: "WATER",
  보람정수장: "WATER",
  누리배수지: "WATER",
  나래하수처리장: "WATER",
  푸른처리장: "WATER",
  라온발전소: "POWER",
  바다가스기지: "GAS",
  다온산업단지: "PRIVATE_PLANT",
  한별정유공장: "PETROLEUM",
  이음오일터미널: "OIL",
  가온화학단지: "PRIVATE_PLANT",
  마루복합단지: "ETC",
};
const SELLERS = [
  "가상엔지니어링",
  "한빛가상설비",
  "누리가상상사",
  "다솜가상테크",
];
const PROJECTS = ["유입수문 교체", "여과지 밸브 개량", "배수지 제어 개선"];
const MODELS = [
  ["01", 18],
  ["02", 32],
  ["03", 20],
  ["04", 18],
  ["05", 12],
] as const;
const MONTHLY_UNITS: Record<number, [number, number]> = {
  2025: [16, 28],
  2026: [20, 34],
};
const MONTHLY_TARGET: Record<number, number> = { 2025: 24, 2026: 28 };
const QTY_BLANK_RATE = 0.08;
const CATEGORY_BLANK_RATE = 0.06;

type RecordData = {
  sheetName: string;
  serialNo: string;
  modelCode: string;
  rpm: string;
  power: string;
  manufacturedDate: Date;
  inspectedDate: Date;
  inspectionNo: string;
  orderNo: string;
  seller: string;
  finalClient: string;
  projectName: string;
  dueDate: Date;
  shippedDate: Date | null;
  quantity: number | null;
  sourceRow: number;
};

function generateProduction(today: Date) {
  const records: RecordData[] = [];
  const orderClient = new Map<string, string>();
  for (const year of YEARS) {
    const sheetName = `${year}(가상)`;
    const yy = String(year % 100).padStart(2, "0");
    let serial = 0;
    let orderSeq = 0;
    for (let month = 1; month <= 12; month++) {
      const first = utc(year, month, 1);
      if (first > today) break;
      let units = int(...MONTHLY_UNITS[year]);
      while (units > 0) {
        orderSeq++;
        const orderNo = `V${yy}${String(orderSeq).padStart(3, "0")}`;
        const client = pick(Object.keys(CLIENTS));
        const seller = pick([...SELLERS, client]); // 직접 거래도 있음
        const project = random() < 0.4 ? pick(PROJECTS) : "";
        const model = weighted(MODELS);
        const rpm = pick(["24", "29", "36", "48"]);
        const power = pick(["380/3/60", "220/1/60", "440/3/60"]);
        const n = Math.min(units, pick([1, 1, 2, 2, 3, 4, 5, 6]));
        units -= n;
        const inspected = workday(addDays(first, int(0, 27)));
        if (inspected > today) break;
        orderClient.set(orderNo, client);
        const due = addDays(inspected, int(5, 14));
        const late = random() < 0.08;
        let shipped: Date | null = late
          ? addDays(due, int(1, 6))
          : addDays(due, -int(0, 4));
        if (shipped < inspected) shipped = inspected;
        if (shipped > today || random() < 0.02) shipped = null; // 아직 출고 전
        for (let i = 0; i < n; i++) {
          serial++;
          records.push({
            sheetName,
            serialNo: `V${yy}-${String(serial).padStart(4, "0")}`,
            modelCode: model,
            rpm,
            power,
            manufacturedDate: utc(year, month, 1),
            inspectedDate: inspected,
            inspectionNo: String(serial).padStart(3, "0"),
            orderNo,
            seller,
            finalClient: client,
            projectName: project,
            dueDate: due,
            shippedDate: shipped,
            // 사람이 입력하는 값(가상): 출고된 행의 수량
            quantity: shipped && random() >= QTY_BLANK_RATE ? 1 : null,
            sourceRow: 9 + serial,
          });
        }
      }
    }
  }
  return { records, orderClient };
}

async function removeProduction() {
  const records = await prisma.prodRecord.deleteMany({
    where: { createdById: PRODUCTION_SAMPLE_BY },
  });
  await prisma.prodUploadBatch.deleteMany({
    where: { uploadedById: PRODUCTION_SAMPLE_BY, records: { none: {} } },
  });
  const categories = await prisma.prodOrderCategory.deleteMany({
    where: { updatedById: PRODUCTION_SAMPLE_BY },
  });
  await prisma.prodMonthlyTarget.deleteMany({
    where: { updatedById: PRODUCTION_SAMPLE_BY },
  });
  await prisma.prodAnnualTarget.deleteMany({
    where: { updatedById: PRODUCTION_SAMPLE_BY },
  });
  return { records: records.count, categories: categories.count };
}

async function seedProduction(today: Date) {
  const { records, orderClient } = generateProduction(today);
  const by = PRODUCTION_SAMPLE_BY;
  await prisma.$transaction(async (tx) => {
    const batch = await tx.prodUploadBatch.create({
      data: {
        fileName: FILE_NAME,
        fileHash: createHash("sha256").update(`${by}:${SEED}`).digest("hex"),
        sheetNames: YEARS.map((y) => `${y}(가상)`),
        createdCount: records.length,
        uploadedById: by,
      },
    });
    await tx.prodRecord.createMany({
      data: records.map((r) => ({
        ...r,
        batchId: batch.id,
        createdById: by,
        updatedById: by,
      })),
    });
    // 수주번호별 사업구분 (일부는 미분류, 사람이 지정한 것은 덮어쓰지 않음)
    const taken = new Set(
      (
        await tx.prodOrderCategory.findMany({
          where: { orderNo: { in: [...orderClient.keys()] } },
          select: { orderNo: true },
        })
      ).map((c) => c.orderNo),
    );
    await tx.prodOrderCategory.createMany({
      data: [...orderClient]
        .filter(([o]) => !taken.has(o) && random() >= CATEGORY_BLANK_RATE)
        .map(([orderNo, client]) => ({
          orderNo,
          category: CLIENTS[client],
          updatedById: by,
        })),
    });
    // 목표: 그 해에 목표가 하나도 없을 때만
    for (const year of YEARS) {
      const has =
        (await tx.prodAnnualTarget.count({ where: { year } })) +
        (await tx.prodMonthlyTarget.count({ where: { year } }));
      if (has > 0) continue;
      await tx.prodAnnualTarget.create({
        data: {
          year,
          annualTarget: MONTHLY_TARGET[year] * 12,
          updatedById: by,
        },
      });
      await tx.prodMonthlyTarget.createMany({
        data: Array.from({ length: 12 }, (_, i) => ({
          year,
          month: i + 1,
          target: MONTHLY_TARGET[year],
          updatedById: by,
        })),
      });
    }
  });
  const shipped = records.filter((r) => r.shippedDate).length;
  const blank = records.filter(
    (r) => r.shippedDate && r.quantity === null,
  ).length;
  return { rows: records.length, orders: orderClient.size, shipped, blank };
}

// ---------- 서비스 ----------

const REGIONS = [
  ["경상남도", "창원시"],
  ["경기도", "수원시"],
  ["충청북도", "청주시"],
  ["전라남도", "여수시"],
  ["부산광역시", "강서구"],
  ["강원특별자치도", "원주시"],
] as const;
const PEOPLE = [
  "가상직원A 대리",
  "가상직원B 과장",
  "가상직원C 사원",
  "가상직원D 차장",
];
const PURPOSES = [
  "정기 점검",
  "작동 불량 수리",
  "리밋 스위치 교체",
  "설치 시운전",
];
const SVC_MODELS = ["AVA03", "AVA05", "AVB10", "AVC20"];
const BILLING: readonly (readonly [SvcBilling | null, number])[] = [
  ["PAID", 60],
  ["FREE", 30],
  [null, 10],
];

async function seedService(today: Date) {
  const by = SERVICE_SAMPLE_BY;
  let count = 0;
  for (const year of YEARS) {
    for (let month = 1; month <= 12; month++) {
      if (utc(year, month, 1) > today) break;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let i = int(3, 8); i > 0; i--) {
        const tripStart = utc(year, month, int(1, lastDay));
        if (tripStart > today) continue;
        const [region, sigungu] = random() < 0.1 ? [null, null] : pick(REGIONS);
        await prisma.svcReport.create({
          data: {
            title: pick(PURPOSES),
            requestOrg: pick(Object.keys(CLIENTS)),
            region,
            sigungu,
            tripStart,
            tripEnd: addDays(tripStart, int(0, 1)),
            authorName: pick(PEOPLE),
            billing: weighted(BILLING),
            workType: pick(["점검", "수리", "교체"]),
            note: "시연용 가짜 데이터",
            createdById: by,
            updatedById: by,
            companions: {
              create: Array.from({ length: int(0, 2) }, () => ({
                name: pick(PEOPLE),
              })),
            },
            products: {
              create: Array.from({ length: int(1, 2) }, () => ({
                modelName: pick(SVC_MODELS),
                quantity: random() < 0.15 ? null : int(1, 3),
              })),
            },
          },
        });
        count++;
      }
    }
  }
  return count;
}

async function main() {
  const removed = await removeProduction();
  const reports = await prisma.svcReport.deleteMany({
    where: { createdById: SERVICE_SAMPLE_BY },
  });
  if (process.argv.includes("--remove")) {
    console.log(
      `가짜 데이터 삭제: 제조내역 ${removed.records}행·사업구분 ${removed.categories}건·목표, 출장보고서 ${reports.count}건`,
    );
    return;
  }
  const today = todayKst(new Date());
  const p = await seedProduction(today);
  const s = await seedService(today);
  console.log(
    `생산: 제조내역 ${p.rows}행(수주 ${p.orders}건, 출고 ${p.shipped}행 중 수량 미확정 ${p.blank}행) / 서비스: 출장보고서 ${s}건 — 기준일 ${today.toISOString().slice(0, 10)}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
