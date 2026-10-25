-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLoginId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_occurredAt_idx" ON "audit_log"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_screen_occurredAt_idx" ON "audit_log"("screen", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_actorId_occurredAt_idx" ON "audit_log"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- 변경 기록은 수정·삭제할 수 없다 (수기 추가: Prisma 스키마로 표현되지 않는 DB 트리거)
-- 테스트·점검은 트랜잭션 안에서 넣고 되돌린다 (scripts/db-smoke.ts). 로컬 전체 초기화는 prisma migrate reset
CREATE FUNCTION "audit_log_reject_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log 는 수정·삭제할 수 없습니다 (변경 기록 보존)'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "audit_log_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_reject_change"();

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_reject_change"();
