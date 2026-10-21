// 개발용 샘플 데이터 (가짜). 실행: npm run db:seed
// - 2024-10 ~ 2026-09 (24개월), 마지막 달(2026-09)만 DRAFT
// - upsert 방식이라 여러 번 실행해도 중복되지 않는다. (단, 샘플 값은 다시 덮어씀)
// - 배포(Render) 빌드는 npm run db:seed:if-empty — 계정이 하나라도 있으면 아무것도 하지 않는다
//   (재배포 때마다 사용자가 고친 값을 샘플로 덮어쓰지 않도록)
// - INITIAL_ADMIN_ID·INITIAL_ADMIN_PASSWORD 가 있으면 그 관리자 계정을 먼저 만든다
// - 난수는 고정 시드를 써서 실행할 때마다 같은 값이 나온다.
// - 거래처명은 모두 가상 이름이다.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  generateTempPassword,
  hashPassword,
} from "../src/shared/auth/password";
import {
  AuthRole,
  AuthTeam,
  MgmtCostType,
  MgmtEntryStatus,
  PrismaClient,
} from "../src/shared/db/generated/client";

const SEED_USER_ID = "seed";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 고정 시드 난수 (mulberry32)
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20261016);

/** min~max 원 사이의 금액, 천 원 단위로 맞춤 */
function won(min: number, max: number): bigint {
  const value = min + random() * (max - min);
  return BigInt(Math.round(value / 1000) * 1000);
}

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

const audit = { createdById: SEED_USER_ID, updatedById: SEED_USER_ID };

async function seedExpenseCategories() {
  const categories: { name: string; costType: MgmtCostType | null }[] = [
    { name: "광고선전비", costType: MgmtCostType.VARIABLE },
    { name: "접대비", costType: MgmtCostType.VARIABLE },
    { name: "복리후생비", costType: MgmtCostType.FIXED },
    { name: "차량유지비", costType: MgmtCostType.VARIABLE },
    { name: "지급수수료", costType: null }, // 고정/변동 미분류 예시
  ];

  const result = [];
  for (const [index, { name, costType }] of categories.entries()) {
    result.push(
      await prisma.expenseCategory.upsert({
        where: { name },
        update: { costType, sortOrder: index + 1, isActive: true },
        create: { name, costType, sortOrder: index + 1 },
      }),
    );
  }
  return result;
}

async function seedAnnualTargets() {
  const targets = [
    // 2024년: 4분기만 입력 → 1~3분기는 (연간 − 4분기) ÷ 3, 나머지 원은 마지막 빈 분기(3분기)에
    {
      year: 2024,
      revenueTarget: 2_200_000_000n,
      q1Target: null,
      q2Target: null,
      q3Target: null,
      q4Target: 600_000_000n,
    },
    // 2025년: 분기별 목표 모두 입력 (합계 = 연간 목표)
    {
      year: 2025,
      revenueTarget: 2_400_000_000n,
      q1Target: 500_000_000n,
      q2Target: 600_000_000n,
      q3Target: 600_000_000n,
      q4Target: 700_000_000n,
    },
    // 2026년: 분기별 목표 비움 → 연간 ÷ 4
    {
      year: 2026,
      revenueTarget: 2_800_000_000n,
      q1Target: null,
      q2Target: null,
      q3Target: null,
      q4Target: null,
    },
  ];

  for (const { year, ...data } of targets) {
    await prisma.annualTarget.upsert({
      where: { year },
      update: { ...data, updatedById: SEED_USER_ID },
      create: { year, ...data, ...audit },
    });
  }
}

/** 2024-10 ~ 2026-09 (24개월). 마지막 달만 임시저장 */
function recentMonths() {
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const index = 2024 * 12 + 9 + i; // 2024-10 부터
    months.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return months;
}

/** 성장하는 회사처럼: 연도별 매출·경비 규모 */
const GROWTH: Record<number, number> = { 2024: 0.82, 2025: 0.9, 2026: 1 };

async function seedMonthlyFinance(
  categories: Awaited<ReturnType<typeof seedExpenseCategories>>,
) {
  const otherExpenseRange: Record<string, [number, number]> = {
    광고선전비: [1_000_000, 5_000_000],
    접대비: [500_000, 3_000_000],
    복리후생비: [2_000_000, 4_000_000],
    차량유지비: [800_000, 1_500_000],
    지급수수료: [300_000, 1_000_000],
  };

  const months = recentMonths();
  for (const [index, { year, month }] of months.entries()) {
    const isLast = index === months.length - 1;
    const g = GROWTH[year];
    const productSales = won(140_000_000 * g, 220_000_000 * g);
    const goodsSales = won(18_000_000 * g, 40_000_000 * g);
    const data = {
      productSales,
      goodsSales,
      serviceSales: won(8_000_000 * g, 25_000_000 * g),
      goodsPurchase: (goodsSales * 70n) / 100n,
      materialPurchase:
        (productSales * BigInt(35 + Math.floor(random() * 11))) / 100n,
      operatingExpense: won(25_000_000 * g, 38_000_000 * g),
      status: isLast ? MgmtEntryStatus.DRAFT : MgmtEntryStatus.CONFIRMED,
      // 확정일시: 다음 달 5일
      confirmedAt: isLast ? null : new Date(Date.UTC(year, month, 5)),
    };

    const finance = await prisma.monthlyFinance.upsert({
      where: { year_month: { year, month } },
      update: { ...data, updatedById: SEED_USER_ID },
      create: { year, month, ...data, ...audit },
    });

    for (const category of categories) {
      const [min, max] = otherExpenseRange[category.name];
      const amount = won(min, max);
      await prisma.otherExpense.upsert({
        where: {
          monthlyFinanceId_categoryId: {
            monthlyFinanceId: finance.id,
            categoryId: category.id,
          },
        },
        update: { amount },
        create: {
          monthlyFinanceId: finance.id,
          categoryId: category.id,
          amount,
        },
      });
    }
  }
}

async function seedReceivables() {
  // 기준일 2026-10-16. 90일 전 = 2026-07-18
  type Row = {
    customerName: string;
    occurredOn: string;
    amount: bigint;
    collectedOn?: string;
    dueOn?: string;
    note?: string;
  };
  const rows: Row[] = [
    // 수금 완료 (8건)
    {
      customerName: "가나상하수도(가상)",
      occurredOn: "2025-11-10",
      amount: 48_000_000n,
      collectedOn: "2025-12-26",
      dueOn: "2025-12-31",
    },
    {
      customerName: "다라발전(가상)",
      occurredOn: "2025-12-03",
      amount: 125_500_000n,
      collectedOn: "2026-02-02",
      dueOn: "2026-01-31",
    },
    {
      customerName: "마바가스(가상)",
      occurredOn: "2026-01-15",
      amount: 32_400_000n,
      collectedOn: "2026-02-27",
      dueOn: "2026-02-28",
    },
    {
      customerName: "사아오일(가상)",
      occurredOn: "2026-02-20",
      amount: 76_000_000n,
      collectedOn: "2026-04-10",
      dueOn: "2026-04-20",
    },
    {
      customerName: "자차석유(가상)",
      occurredOn: "2026-04-08",
      amount: 19_800_000n,
      collectedOn: "2026-05-29",
      dueOn: "2026-05-31",
    },
    {
      customerName: "카타플랜트(가상)",
      occurredOn: "2026-05-12",
      amount: 210_000_000n,
      collectedOn: "2026-07-15",
      dueOn: "2026-07-31",
    },
    {
      customerName: "가나상하수도(가상)",
      occurredOn: "2026-06-25",
      amount: 55_300_000n,
      collectedOn: "2026-08-20",
      dueOn: "2026-08-31",
    },
    {
      customerName: "파하설비(가상)",
      occurredOn: "2026-08-04",
      amount: 12_600_000n,
      collectedOn: "2026-09-25",
      dueOn: "2026-09-30",
      note: "현장 서비스 대금",
    },
    // 미수 — 90일 이내 (7건)
    {
      customerName: "다라발전(가상)",
      occurredOn: "2026-07-22",
      amount: 98_000_000n,
      dueOn: "2026-10-31",
    },
    {
      customerName: "거너수도(가상)",
      occurredOn: "2026-08-12",
      amount: 41_200_000n,
      dueOn: "2026-10-31",
    },
    {
      customerName: "마바가스(가상)",
      occurredOn: "2026-08-28",
      amount: 27_500_000n,
      dueOn: "2026-11-30",
    },
    {
      customerName: "카타플랜트(가상)",
      occurredOn: "2026-09-05",
      amount: 156_000_000n,
      dueOn: "2026-11-30",
    },
    {
      customerName: "사아오일(가상)",
      occurredOn: "2026-09-18",
      amount: 63_700_000n,
      dueOn: "2026-12-15",
    },
    {
      customerName: "자차석유(가상)",
      occurredOn: "2026-09-30",
      amount: 22_000_000n,
      dueOn: "2026-12-31",
    },
    {
      customerName: "파하설비(가상)",
      occurredOn: "2026-10-08",
      amount: 8_900_000n,
      dueOn: "2026-12-31",
      note: "현장 서비스 대금",
    },
    // 오래된 미수 — 90일 초과 (5건)
    {
      customerName: "거너수도(가상)",
      occurredOn: "2026-01-20",
      amount: 36_000_000n,
      dueOn: "2026-03-31",
      note: "수금 독촉 필요",
    },
    {
      customerName: "더러엔지니어링(가상)",
      occurredOn: "2026-02-14",
      amount: 14_500_000n,
      dueOn: "2026-04-30",
    },
    {
      customerName: "다라발전(가상)",
      occurredOn: "2026-04-03",
      amount: 88_000_000n,
      dueOn: "2026-06-30",
      note: "검수 지연",
    },
    {
      customerName: "머버가스(가상)",
      occurredOn: "2026-05-27",
      amount: 21_300_000n,
      dueOn: "2026-07-31",
    },
    {
      customerName: "가나상하수도(가상)",
      occurredOn: "2026-07-10",
      amount: 47_800_000n,
      dueOn: "2026-08-31",
    },
  ];

  for (const [index, row] of rows.entries()) {
    const id = `seed-receivable-${String(index + 1).padStart(2, "0")}`;
    const data = {
      customerName: row.customerName,
      occurredOn: date(row.occurredOn),
      amount: row.amount,
      isCollected: row.collectedOn !== undefined,
      collectedOn: row.collectedOn ? date(row.collectedOn) : null,
      dueOn: row.dueOn ? date(row.dueOn) : null,
      note: row.note ?? null,
    };
    await prisma.receivable.upsert({
      where: { id },
      update: { ...data, updatedById: SEED_USER_ID },
      create: { id, ...data, ...audit },
    });
  }
}

// 직원 계정 7명 (관리자 설정 화면 예시와 같은 구성)
// 초기 비밀번호: .env 의 SEED_INITIAL_PASSWORD, 없으면 실행할 때 만들어서 화면에 한 번만 출력한다 (코드·git에 남기지 않음)
// 이미 있는 계정은 건드리지 않는다 (비밀번호·권한을 덮어쓰지 않음)
const SEED_ACCOUNTS: {
  loginId: string;
  name: string;
  role: AuthRole;
  viewTeams: AuthTeam[];
  editTeams: AuthTeam[];
}[] = [
  {
    loginId: "admin",
    name: "관리자",
    role: AuthRole.ADMIN,
    viewTeams: [],
    editTeams: [],
  },
  {
    loginId: "dual_member",
    name: "정겸직",
    role: AuthRole.MEMBER,
    viewTeams: [AuthTeam.production, AuthTeam.service],
    editTeams: [],
  },
  {
    loginId: "mgmt_member",
    name: "윤경영",
    role: AuthRole.MANAGEMENT,
    viewTeams: [],
    editTeams: [],
  },
  {
    loginId: "prod_leader",
    name: "김생산",
    role: AuthRole.LEADER,
    viewTeams: [AuthTeam.production],
    editTeams: [AuthTeam.production],
  },
  {
    loginId: "prod_member",
    name: "이생산",
    role: AuthRole.MEMBER,
    viewTeams: [AuthTeam.production],
    editTeams: [],
  },
  {
    loginId: "svc_leader",
    name: "박서비스",
    role: AuthRole.LEADER,
    viewTeams: [AuthTeam.service],
    editTeams: [AuthTeam.service],
  },
  {
    loginId: "svc_member",
    name: "최서비스",
    role: AuthRole.MEMBER,
    viewTeams: [AuthTeam.service],
    editTeams: [],
  },
];

async function seedUsers() {
  const existing = new Set(
    (
      await prisma.authUser.findMany({
        where: { loginId: { in: SEED_ACCOUNTS.map((a) => a.loginId) } },
        select: { loginId: true },
      })
    ).map((u) => u.loginId),
  );
  const missing = SEED_ACCOUNTS.filter((a) => !existing.has(a.loginId));
  if (missing.length === 0) {
    console.log("계정: 7개 모두 이미 있음 (비밀번호·권한은 그대로)");
    return;
  }

  const fromEnv = process.env.SEED_INITIAL_PASSWORD?.trim();
  const password = fromEnv || generateTempPassword();
  const passwordHash = await hashPassword(password);
  for (const account of missing) {
    await prisma.authUser.create({
      data: {
        ...account,
        passwordHash,
        mustChangePassword: true,
        createdById: SEED_USER_ID,
        updatedById: SEED_USER_ID,
      },
    });
  }

  const ids = missing.map((a) => a.loginId).join(", ");
  console.log(`계정 ${missing.length}개 생성: ${ids}`);
  if (fromEnv) {
    console.log("  초기 비밀번호: .env 의 SEED_INITIAL_PASSWORD");
  } else if (process.env.INITIAL_ADMIN_ID) {
    // 배포 빌드 로그에 비밀번호를 남기지 않는다 — 최초 관리자가 [비밀번호 초기화]로 발급
    console.log(
      "  초기 비밀번호: 무작위(표시 안 함) — 관리자 설정 화면의 [비밀번호 초기화]로 발급하세요",
    );
  } else {
    console.log("");
    console.log("  ┌──────────────────────────────────────────────");
    console.log(`  │ 초기 비밀번호 (위 계정 공통): ${password}`);
    console.log("  │ ⚠️ 지금 한 번만 표시됩니다. DB에는 해시만 저장됩니다.");
    console.log("  │ 첫 로그인 때 각자 새 비밀번호로 바꾸게 됩니다.");
    console.log("  │ 잊었으면 admin 으로 로그인해 [비밀번호 초기화]를 쓰세요.");
    console.log("  └──────────────────────────────────────────────");
    console.log("");
  }
}

// 최초 관리자 (배포용): 환경변수로 받은 아이디·비밀번호, 첫 로그인 때 변경 강제. 이미 있으면 건드리지 않는다
async function seedInitialAdmin() {
  const loginId = process.env.INITIAL_ADMIN_ID?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "";
  if (!loginId && !password) return;
  if (!loginId || !password) {
    throw new Error(
      "INITIAL_ADMIN_ID 와 INITIAL_ADMIN_PASSWORD 를 함께 지정하세요.",
    );
  }
  // 관리자 화면의 아이디 규칙(admin/schemas.ts LOGIN_ID_RULE)과 같게
  if (!/^[a-z0-9_]{3,30}$/.test(loginId)) {
    throw new Error(
      "INITIAL_ADMIN_ID 는 영문 소문자·숫자·밑줄(_) 3~30자여야 합니다.",
    );
  }
  if (password.length < 8) {
    throw new Error("INITIAL_ADMIN_PASSWORD 는 8자 이상이어야 합니다.");
  }

  const exists = await prisma.authUser.findUnique({ where: { loginId } });
  if (exists) {
    console.log(`최초 관리자: ${loginId} 이미 있음 (비밀번호·권한은 그대로)`);
    return;
  }
  await prisma.authUser.create({
    data: {
      loginId,
      name: "관리자",
      role: AuthRole.ADMIN,
      viewTeams: [],
      editTeams: [],
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      createdById: SEED_USER_ID,
      updatedById: SEED_USER_ID,
    },
  });
  console.log(
    `최초 관리자 생성: ${loginId} (비밀번호: INITIAL_ADMIN_PASSWORD)`,
  );
}

async function main() {
  if (
    process.env.SEED_ONLY_IF_EMPTY === "true" &&
    (await prisma.authUser.count()) > 0
  ) {
    console.log("시드 건너뜀: 이미 계정이 있는 DB (SEED_ONLY_IF_EMPTY)");
    return;
  }
  await seedInitialAdmin();
  await seedUsers();
  const categories = await seedExpenseCategories();
  await seedAnnualTargets();
  await seedMonthlyFinance(categories);
  await seedReceivables();
  console.log("시드 완료");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
