-- AlterTable
ALTER TABLE "mgmt_data_upload" ADD COLUMN     "detail" JSONB;

-- AlterTable
ALTER TABLE "mgmt_ledger_entry" ADD COLUMN     "uploadId" TEXT;

-- CreateIndex
CREATE INDEX "mgmt_ledger_entry_uploadId_idx" ON "mgmt_ledger_entry"("uploadId");
