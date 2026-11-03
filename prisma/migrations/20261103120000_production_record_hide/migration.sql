-- AlterTable
ALTER TABLE "prod_record" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "prod_record_deletedAt_idx" ON "prod_record"("deletedAt");

