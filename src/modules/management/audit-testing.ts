// 변경 이력 테스트 도우미 (*.test.ts 에서만 import) — 실제 DB 처럼 트랜잭션이 끝까지 성공해야 쓰기가 반영되는 가짜 DB
import type { AuditChange } from "@/shared/audit/types";

export type FakeAuditRow = {
  action: string;
  screen: string;
  area: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  actorId: string;
  actorLoginId: string;
  changes: AuditChange[];
  meta?: Record<string, unknown>;
};

/**
 * table: 모델 이름 → 행 목록 (반영된 것만).
 * $transaction(fn): fn 안의 쓰기는 임시로 모았다가 fn 이 끝까지 성공하면 반영, 에러면 버림
 */
export function createFakeTransactionalDb<
  Row extends { id: string; updatedAt: Date },
>(model: "ledgerEntry" | "receivable", initial: Row[]) {
  const committed = { rows: [...initial], audit: [] as FakeAuditRow[] };
  let failAudit: Error | null = null;
  let seq = 0;

  function txClient(pending: { rows: Row[]; audit: FakeAuditRow[] }) {
    const visible = () => pending.rows;
    return {
      [model]: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          visible().find((r) => r.id === where.id) ?? null,
        create: async ({ data }: { data: Partial<Row> }) => {
          seq += 1;
          const row = {
            id: `new-${seq}`,
            updatedAt: new Date("2026-10-25T00:00:00Z"),
            deletedAt: null,
            ...data,
          } as unknown as Row;
          pending.rows.push(row);
          return row;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; updatedAt: Date; deletedAt: unknown };
          data: Partial<Row>;
        }) => {
          const i = pending.rows.findIndex(
            (r) =>
              r.id === where.id &&
              r.updatedAt.getTime() === where.updatedAt.getTime(),
          );
          if (i < 0) return { count: 0 };
          pending.rows[i] = {
            ...pending.rows[i],
            ...data,
            updatedAt: new Date(pending.rows[i].updatedAt.getTime() + 1000),
          };
          return { count: 1 };
        },
      },
      auditLog: {
        create: async ({ data }: { data: FakeAuditRow }) => {
          if (failAudit) throw failAudit;
          pending.audit.push(data);
          return data;
        },
      },
    };
  }

  const db = {
    ...txClient(committed),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pending = {
        rows: committed.rows.map((r) => ({ ...r })),
        audit: [...committed.audit],
      };
      const result = await fn(txClient(pending));
      committed.rows = pending.rows;
      committed.audit = pending.audit;
      return result;
    },
  };

  return {
    db,
    committed,
    /** 다음 기록부터 실패시키기 (null 이면 정상) */
    setAuditFailure: (e: Error | null) => {
      failAudit = e;
    },
  };
}
