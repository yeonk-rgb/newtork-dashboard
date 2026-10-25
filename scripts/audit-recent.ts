// 최근 변경 기록 보기 (읽기만) — 보는 화면(변경 이력, PR ③)이 생기기 전 확인용
// 실행: npm run audit:recent              최근 20건
//       npm run audit:recent -- 50        최근 50건
//       npm run audit:recent -- 20 ledger 화면 이름으로 거르기 (ledger / receivables …)
import "dotenv/config";

import {
  AUDIT_ACTION_LABEL,
  type AuditAction,
  type AuditChange,
} from "@/shared/audit/types";
import { prisma } from "@/shared/db/client";

const kst = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);

async function main() {
  const take = Number(process.argv[2] ?? 20) || 20;
  const screen = process.argv[3];
  const rows = await prisma.auditLog.findMany({
    where: screen ? { screen } : {},
    orderBy: { occurredAt: "desc" },
    take,
  });
  if (rows.length === 0) {
    console.log("변경 기록이 없습니다.");
    return;
  }
  for (const r of rows) {
    const action = AUDIT_ACTION_LABEL[r.action as AuditAction] ?? r.action;
    console.log(
      `${kst(r.occurredAt)} (한국 시간) · ${r.actorLoginId} · ${r.screen} · ${action} · ${r.targetLabel}`,
    );
    for (const c of r.changes as AuditChange[]) {
      console.log(
        `    ${c.label}: ${c.before ?? "(없음)"} → ${c.after ?? "(없음)"}`,
      );
    }
    if (r.meta) console.log(`    추가 정보: ${JSON.stringify(r.meta)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
