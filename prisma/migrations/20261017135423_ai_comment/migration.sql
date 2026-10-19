-- CreateTable
CREATE TABLE "mgmt_ai_comment" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "inputSummary" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mgmt_ai_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mgmt_ai_comment_year_quarter_createdAt_idx" ON "mgmt_ai_comment"("year", "quarter", "createdAt");

