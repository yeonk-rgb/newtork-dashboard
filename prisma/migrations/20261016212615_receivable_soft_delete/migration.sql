-- AlterTable
ALTER TABLE "mgmt_receivable" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "mgmt_receivable_deletedAt_idx" ON "mgmt_receivable"("deletedAt");

