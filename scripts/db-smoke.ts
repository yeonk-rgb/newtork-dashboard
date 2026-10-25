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
import {
  loadHistoryForExport,
  loadHistoryPage,
  loadRowHistory,
} from "@/modules/management/history/load-history";
import { loadEntryExportData } from "@/modules/management/entry/export/load-entry-export";
import { parseHistoryFilter } from "@/modules/management/history/rules";
import { loadLedgerData } from "@/modules/management/ledger/load-ledger";
import { countExisting } from "@/modules/management/ledger/import/save-import";
import { loadReceivablesData } from "@/modules/management/receivables/load-receivables";
import {
  loadExistingData,
  loadRecentUploads,
} from "@/modules/management/upload/save-upload";
import { recordAudit } from "@/shared/audit/record";
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
  await check("월간 입력 엑셀: 월별 값·지출 항목 (loadEntryExportData)", () =>
    loadEntryExportData([7, 8, 9].map((month) => ({ year: 2026, month }))),
  );
  await check("채권·채무 이관: 같은 달 기존 행 수 (countExisting)", () =>
    countExisting(2026, 10),
  );
  await check("엑셀 업로드: 기존 데이터·이력", () =>
    Promise.all([loadExistingData(), loadRecentUploads()]),
  );
  {
    // 변경 이력: 검색(대소문자 무시)·사람 목록(groupBy)·행 이력(이관 줄) — 관리자(대표) / 경영지원팀 조건 둘 다
    const filter = parseHistoryFilter(
      { q: "a", from: "2020-01-01" },
      todayKst(new Date()),
    );
    const admin = { canView: true, canSeeAdmin: true, canExport: true };
    const mgmt = { canView: true, canSeeAdmin: false, canExport: false };
    await check("변경 이력 목록 (loadHistoryPage)", () =>
      Promise.all([
        loadHistoryPage(filter, admin),
        loadHistoryPage(filter, mgmt),
      ]),
    );
    await check("변경 이력 엑셀 (loadHistoryForExport)", () =>
      loadHistoryForExport(filter, admin),
    );
    const ledgerRow = await prisma.ledgerEntry.findFirst({
      select: { id: true },
      orderBy: { uploadId: { sort: "asc", nulls: "last" } },
    });
    await check("행 이력 (loadRowHistory)", () =>
      Promise.all([
        loadRowHistory("LedgerEntry", ledgerRow?.id ?? "none"),
        loadRowHistory("Receivable", "none"),
      ]),
    );
  }

  // 3) 변경 기록(audit_log): 수정·삭제 차단 트리거, 기록이 실패하면 저장도 취소 — 모두 트랜잭션 안에서 하고 되돌린다
  class Rollback extends Error {}
  const inRollback = async (
    fn: (tx: Prisma.TransactionClient) => Promise<void>,
  ) => {
    try {
      await prisma.$transaction(async (tx) => {
        await fn(tx);
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }
  };
  const smokeEntry = {
    occurredAt: new Date(),
    actor: { id: "smoke", loginId: "smoke" },
    area: "management" as const,
    screen: "smoke",
    target: { type: "Smoke", id: "smoke", label: "db:smoke 점검 (되돌림)" },
  };
  await check("변경 기록: 수정·삭제 차단 트리거 (되돌림)", () =>
    inRollback(async (tx) => {
      await recordAudit(tx, { ...smokeEntry, action: "HIDE" });
      const row = await tx.auditLog.findFirstOrThrow({
        where: { screen: "smoke" },
      });
      for (const [name, sql] of [
        [
          "수정",
          tx.auditLog.update({
            where: { id: row.id },
            data: { targetLabel: "x" },
          }),
        ],
        ["삭제", tx.auditLog.delete({ where: { id: row.id } })],
      ] as const) {
        await tx.$executeRawUnsafe("SAVEPOINT audit_smoke");
        const blocked = await sql.then(
          () => false,
          (e: unknown) => String(e).includes("audit_log"),
        );
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT audit_smoke");
        if (!blocked) {
          throw new Error(
            `기록 ${name}이 막히지 않습니다 — db push 로만 반영했다면 트리거가 없습니다. npm run db:deploy 로 마이그레이션을 적용하세요.`,
          );
        }
      }
    }),
  );
  await check("변경 기록: 기록이 실패하면 저장도 취소", async () => {
    const marker = `__audit_smoke_${Date.now()}`;
    await prisma
      .$transaction(async (tx) => {
        await tx.ledgerEntry.create({
          data: {
            year: 2000,
            month: 1,
            kind: "ACCRUED_STAFF",
            partnerName: marker,
            amount: 1n,
            createdById: "smoke",
            updatedById: "smoke",
          },
        });
        // 금지 칸(비밀번호) → 기록 거부 → 트랜잭션 전체 취소
        await recordAudit(tx, {
          ...smokeEntry,
          action: "UPDATE",
          changes: [
            { field: "password", label: "비밀번호", before: null, after: "x" },
          ],
        });
      })
      .catch(() => undefined);
    const left = await prisma.ledgerEntry.count({
      where: { partnerName: marker },
    });
    if (left !== 0)
      throw new Error(`저장이 취소되지 않았습니다 (${left}행 남음)`);
  });

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
