-- AlterTable
ALTER TABLE "mgmt_annual_target" ADD COLUMN     "uploadId" TEXT;

-- AlterTable
ALTER TABLE "mgmt_monthly_finance" ADD COLUMN     "uploadId" TEXT;

-- CreateTable
CREATE TABLE "mgmt_data_upload" (
    "id" TEXT NOT NULL,
    "fileNames" JSONB NOT NULL,
    "sheets" JSONB NOT NULL,
    "savedRows" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mgmt_data_upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mgmt_data_upload_createdAt_idx" ON "mgmt_data_upload"("createdAt");

