-- CreateEnum
CREATE TYPE "ProdIndustry" AS ENUM ('WATER', 'POWER', 'GAS', 'OIL', 'PETROLEUM', 'PRIVATE_PLANT', 'ETC');

-- CreateEnum
CREATE TYPE "SvcBilling" AS ENUM ('PAID', 'FREE');

-- CreateTable
CREATE TABLE "prod_upload_batch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "sheetNames" JSONB NOT NULL DEFAULT '[]',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "overwrittenCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "keptCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prod_upload_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_record" (
    "id" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL DEFAULT '',
    "bushSize" TEXT NOT NULL DEFAULT '',
    "rpm" TEXT NOT NULL DEFAULT '',
    "power" TEXT NOT NULL DEFAULT '',
    "manufacturedDate" DATE,
    "inspectedDate" DATE,
    "inspectionNo" TEXT NOT NULL DEFAULT '',
    "orderNo" TEXT NOT NULL DEFAULT '',
    "soNo" TEXT NOT NULL DEFAULT '',
    "customerOrderNo" TEXT NOT NULL DEFAULT '',
    "seller" TEXT NOT NULL DEFAULT '',
    "finalClient" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "dueDate" DATE,
    "shippedDate" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "etc" TEXT NOT NULL DEFAULT '',
    "note2" TEXT NOT NULL DEFAULT '',
    "opun" TEXT NOT NULL DEFAULT '',
    "clun" TEXT NOT NULL DEFAULT '',
    "oplo" TEXT NOT NULL DEFAULT '',
    "cllo" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER,
    "sourceRow" INTEGER NOT NULL,
    "importWarnings" JSONB NOT NULL DEFAULT '[]',
    "batchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_order_category" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "category" "ProdIndustry" NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_order_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_annual_target" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualTarget" INTEGER,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_annual_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod_monthly_target" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prod_monthly_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_report" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '',
    "requestOrgType" TEXT NOT NULL DEFAULT '',
    "requestOrg" TEXT NOT NULL DEFAULT '',
    "siteContact" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "region" TEXT,
    "sigungu" TEXT,
    "tripStart" DATE,
    "tripEnd" DATE,
    "extraTrip" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT NOT NULL DEFAULT '',
    "writtenAt" TIMESTAMP(3),
    "happyCallDate" DATE,
    "workType" TEXT NOT NULL DEFAULT '',
    "faultDescription" TEXT NOT NULL DEFAULT '',
    "workDescription" TEXT NOT NULL DEFAULT '',
    "workResult" TEXT NOT NULL DEFAULT '',
    "billing" "SvcBilling",
    "quoteType" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL DEFAULT '',
    "approver" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "svc_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_report_companion" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "svc_report_companion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svc_report_product" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "serialNo" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER,

    CONSTRAINT "svc_report_product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prod_upload_batch_fileHash_key" ON "prod_upload_batch"("fileHash");

-- CreateIndex
CREATE INDEX "prod_record_serialNo_idx" ON "prod_record"("serialNo");

-- CreateIndex
CREATE INDEX "prod_record_shippedDate_idx" ON "prod_record"("shippedDate");

-- CreateIndex
CREATE INDEX "prod_record_dueDate_idx" ON "prod_record"("dueDate");

-- CreateIndex
CREATE INDEX "prod_record_orderNo_idx" ON "prod_record"("orderNo");

-- CreateIndex
CREATE INDEX "prod_record_seller_idx" ON "prod_record"("seller");

-- CreateIndex
CREATE UNIQUE INDEX "prod_record_sheetName_serialNo_key" ON "prod_record"("sheetName", "serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "prod_order_category_orderNo_key" ON "prod_order_category"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "prod_annual_target_year_key" ON "prod_annual_target"("year");

-- CreateIndex
CREATE UNIQUE INDEX "prod_monthly_target_year_month_key" ON "prod_monthly_target"("year", "month");

-- CreateIndex
CREATE INDEX "svc_report_tripStart_idx" ON "svc_report"("tripStart");

-- CreateIndex
CREATE INDEX "svc_report_region_sigungu_idx" ON "svc_report"("region", "sigungu");

-- CreateIndex
CREATE INDEX "svc_report_companion_reportId_idx" ON "svc_report_companion"("reportId");

-- CreateIndex
CREATE INDEX "svc_report_product_reportId_idx" ON "svc_report_product"("reportId");

-- AddForeignKey
ALTER TABLE "prod_record" ADD CONSTRAINT "prod_record_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "prod_upload_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_report_companion" ADD CONSTRAINT "svc_report_companion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "svc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "svc_report_product" ADD CONSTRAINT "svc_report_product_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "svc_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

