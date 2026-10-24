// 실제 DB 점검: 스키마(생성된 클라이언트)와 DB 테이블·칸이 맞는지, 화면이 쓰는 주요 조회가 실제로 도는지
// - 단위 테스트는 DB 를 가짜로 바꾸므로 "스키마엔 있는데 DB(마이그레이션)엔 없는 칸"을 못 잡는다 → 이 점검으로 잡는다
// - CI: 빈 DB 에 migrate deploy 직후 실행 / 로컬: 스키마를 바꾼 PR 은 PR 전에 실행
// 실행: npm run db:smoke
import "dotenv/config";

import {
  hasUploadedInput,
  loadLatestAiComment,
} from "@/modules/management/ai/load-comment";
import {
  loadSummaryInput,
  todayKst,
} from "@/modules/management/data/load-summary-input";
import { loadLedgerData } from "@/modules/management/ledger/load-ledger";
import { loadReceivablesData } from "@/modules/management/receivables/load-receivables";
import {
  loadExistingData,
  loadRecentUploads,
} from "@/modules/management/upload/save-upload";
import { findSessionUser } from "@/shared/auth/session";
import { loadUserNames } from "@/shared/auth/user-names";
import { prisma } from "@/shared/db/client";
import { Prisma } from "@/shared/db/generated/client";

type Delegate = { findFirst: (args?: object) => Promise<unknown> };

async function main() {
  const failures: string[] = [];
  const check = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(
        `✗ ${name}\n  ${error instanceof Error ? error.message.split("\n").slice(-3).join(" ") : error}`,
      );
    }
  };

  // 1) 모델마다 모든 칸을 읽어 본다 — DB 에 없는 칸·테이블이 있으면 여기서 실패
  for (const model of Object.values(Prisma.ModelName)) {
    const key = (model[0].toLowerCase() +
      model.slice(1)) as keyof typeof prisma;
    await check(`${model}: 모든 칸 조회`, () =>
      (prisma[key] as unknown as Delegate).findFirst(),
    );
  }

  // 2) 화면이 실제로 쓰는 조회
  const today = todayKst(new Date());
  const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;
  await check("대시보드 지표 조회 (loadSummaryInput)", () =>
    loadSummaryInput(q3, today),
  );
  await check("AI 카드: 업로드 데이터 확인 (hasUploadedInput)", () =>
    hasUploadedInput(q3),
  );
  await check("AI 카드: 최신 분석 (loadLatestAiComment)", () =>
    loadLatestAiComment(2026, 3),
  );
  await check("로그인 세션 조회 (findSessionUser)", () =>
    findSessionUser("smoke-not-a-token", new Date()),
  );
  await check("작성자 이름 조회 (loadUserNames)", () =>
    loadUserNames(["seed", "smoke-unknown"]),
  );
  await check("미수금 관리 목록 (loadReceivablesData)", () =>
    loadReceivablesData(true),
  );
  await check("채권·채무 관리 (loadLedgerData)", () =>
    loadLedgerData({ year: 2026, month: 10 }, true),
  );
  await check("엑셀 업로드: 기존 데이터·이력", () =>
    Promise.all([loadExistingData(), loadRecentUploads()]),
  );

  if (failures.length > 0) {
    console.error(
      `\n${failures.length}건 실패 — 마이그레이션 적용(npm run db:deploy)·클라이언트 생성(npm run db:generate)을 확인하세요.`,
    );
    process.exitCode = 1;
  } else {
    console.log("\nDB 점검 통과");
  }
}

main().finally(() => prisma.$disconnect());
